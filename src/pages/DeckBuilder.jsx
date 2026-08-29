// src/pages/DeckBuilder.jsx
// Consumer-facing Pokémon deck builder. Players search/add cards (or paste a decklist),
// then verify their phone to save, and submit a deck to the store for proxy printing.
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box, Container, Typography, TextField, Button, IconButton, Grid, Card, CardMedia,
  CardActionArea, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Alert, Snackbar, Chip, Stack, Divider, InputAdornment, Tooltip, List, ListItem,
  ListItemText, Menu, MenuItem,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import SaveIcon from '@mui/icons-material/Save';
import PrintIcon from '@mui/icons-material/Print';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import OtpInput from '@/components/events/OtpInput';
import { PhoneInputComponent } from '@/components/events/PhoneInput';
import {
  searchCards, resolveDecklist, toDeckCard, sendOtp, verifyOtpAndCreateSession,
  saveConsumerDeck, getConsumerDecks, deleteConsumerDeck, submitDeckForProxies,
} from '@/services/deckBuilderService';

const SESSION_KEY = 'sc_deck_session';
const DRAFT_KEY = 'sc_deck_draft';

const loadJson = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const saveJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

const emptyDeck = () => ({ deckId: null, deckName: 'My Deck', cards: [] });

export default function DeckBuilder() {
  const [session, setSession] = useState(() => loadJson(SESSION_KEY, null)); // { sessionToken, customerId, firstName }
  const [deck, setDeck] = useState(() => loadJson(DRAFT_KEY, null) || emptyDeck());

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const [myDecksOpen, setMyDecksOpen] = useState(false);
  const [myDecks, setMyDecks] = useState([]);
  const [loadingDecks, setLoadingDecks] = useState(false);

  const [auth, setAuth] = useState({ open: false, step: 'phone', phone: '', code: '', busy: false, err: '' });
  const pendingAction = useRef(null); // function to run after successful auth

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Persist the working deck so building survives a reload / the phone-verify step.
  useEffect(() => { saveJson(DRAFT_KEY, deck); }, [deck]);
  useEffect(() => { if (session) saveJson(SESSION_KEY, session); }, [session]);

  const deckCount = deck.cards.reduce((s, c) => s + (c.quantity || 0), 0);

  // Group the deck by category (Pokémon / Trainer / Energy) like the Surreal Admin deck list.
  const CATEGORY_ORDER = ['Pokémon', 'Trainer', 'Energy', 'Other'];
  const catOf = (cat) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('pok')) return 'Pokémon';
    if (c.includes('trainer') || c.includes('supporter') || c.includes('item') || c.includes('stadium') || c.includes('tool')) return 'Trainer';
    if (c.includes('energy')) return 'Energy';
    return 'Other';
  };
  const groupedDeck = useMemo(() => {
    const groups = {};
    for (const c of deck.cards) { const k = catOf(c.category); (groups[k] ||= []).push(c); }
    return CATEGORY_ORDER
      .filter((k) => groups[k]?.length)
      .map((k) => ({ category: k, cards: groups[k], count: groups[k].reduce((s, x) => s + (x.quantity || 0), 0) }));
  }, [deck.cards]);

  const openAddCard = () => { setError(''); setAddOpen(true); };

  // ---------- search ----------
  const runSearch = useCallback(async (e) => {
    e?.preventDefault?.();
    const name = query.trim();
    if (name.length < 2) { setError('Type at least 2 characters to search.'); return; }
    setSearching(true); setError('');
    try {
      setResults(await searchCards({ name, limit: 60 }));
    } catch (err) {
      setError(err.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  // ---------- deck edits ----------
  const addCard = (raw) => {
    setDeck((d) => {
      const existing = d.cards.find((c) => c.id === raw.id);
      if (existing) return { ...d, cards: d.cards.map((c) => c.id === raw.id ? { ...c, quantity: Math.min(99, (c.quantity || 0) + 1) } : c) };
      return { ...d, cards: [...d.cards, toDeckCard(raw, 1)] };
    });
  };
  const setQty = (id, qty) => setDeck((d) => ({
    ...d,
    cards: qty <= 0 ? d.cards.filter((c) => c.id !== id) : d.cards.map((c) => c.id === id ? { ...c, quantity: Math.min(99, qty) } : c),
  }));
  const removeCard = (id) => setDeck((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== id) }));
  const clearDeck = () => setDeck(emptyDeck());

  // ---------- decklist import ----------
  // Parses lines like "3 Pikachu", "2 Charizard ex SVI 4", "1x Professor's Research".
  const parseDecklist = (text) => text.split('\n').map((line) => {
    const m = line.trim().match(/^(\d+)\s*x?\s+(.+)$/i);
    if (!m) return null;
    const quantity = parseInt(m[1], 10) || 1;
    const rest = m[2].trim();
    // Try to peel a trailing "SET NUMBER" (e.g. "SVI 4"); otherwise resolve by name only.
    const sn = rest.match(/^(.*?)\s+([A-Z0-9]{2,5})\s+([A-Za-z0-9]+)$/);
    if (sn) return { name: sn[1].trim(), setCode: sn[2], number: sn[3], quantity };
    return { name: rest, quantity };
  }).filter(Boolean);

  const doImport = async () => {
    const parsed = parseDecklist(importText);
    if (!parsed.length) { setError('Couldn’t read any lines. Use “2 Card Name” per line.'); return; }
    setImporting(true); setError('');
    try {
      const resolved = await resolveDecklist(parsed);
      // resolved rows should carry a quantity or align by index; merge into the deck.
      setDeck((d) => {
        const next = [...d.cards];
        resolved.forEach((r, i) => {
          const qty = r.quantity || parsed[i]?.quantity || 1;
          if (!r.id) return;
          const ex = next.find((c) => c.id === r.id);
          if (ex) ex.quantity = Math.min(99, (ex.quantity || 0) + qty);
          else next.push(toDeckCard(r, qty));
        });
        return { ...d, cards: next };
      });
      const missing = parsed.length - resolved.filter((r) => r.id).length;
      setNotice(missing > 0 ? `Imported ${resolved.length} card(s); ${missing} not found.` : `Imported ${resolved.length} card(s).`);
      setImportOpen(false); setImportText('');
    } catch (err) {
      setError(err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  // ---------- auth gating ----------
  const requireSession = (fn) => {
    if (session?.sessionToken) { fn(); return; }
    pendingAction.current = fn;
    setAuth({ open: true, step: 'phone', phone: '', code: '', busy: false, err: '' });
  };

  const sendCode = async () => {
    setAuth((a) => ({ ...a, busy: true, err: '' }));
    try {
      await sendOtp(auth.phone);
      setAuth((a) => ({ ...a, step: 'code', busy: false }));
    } catch (err) {
      setAuth((a) => ({ ...a, busy: false, err: err.message || 'Could not send code.' }));
    }
  };
  const confirmCode = async () => {
    setAuth((a) => ({ ...a, busy: true, err: '' }));
    try {
      const s = await verifyOtpAndCreateSession(auth.phone, auth.code);
      if (!s.sessionToken) {
        setAuth((a) => ({ ...a, busy: false, err: 'We couldn’t find your account. Register at an event first, then come back.' }));
        return;
      }
      const newSession = { sessionToken: s.sessionToken, customerId: s.customerId, firstName: s.firstName || '' };
      setSession(newSession);
      setAuth({ open: false, step: 'phone', phone: '', code: '', busy: false, err: '' });
      const fn = pendingAction.current; pendingAction.current = null;
      if (fn) setTimeout(() => fn(newSession), 0);
    } catch (err) {
      setAuth((a) => ({ ...a, busy: false, err: err.message || 'Verification failed.' }));
    }
  };

  // ---------- save / submit ----------
  const persistDeck = async (sess) => {
    const token = (sess || session).sessionToken;
    const res = await saveConsumerDeck({ sessionToken: token, deck, playerName: (sess || session).firstName || '' });
    setDeck((d) => ({ ...d, deckId: res.deckId }));
    return res.deckId;
  };
  const handleSave = () => requireSession(async (sess) => {
    if (!deck.cards.length) { setError('Add some cards first.'); return; }
    try { await persistDeck(sess); setNotice('Deck saved to your account.'); }
    catch (err) { setError(err.message || 'Save failed.'); }
  });
  const handleSubmit = () => requireSession(async (sess) => {
    if (!deck.cards.length) { setError('Add some cards first.'); return; }
    try {
      const id = deck.deckId || await persistDeck(sess);
      await submitDeckForProxies({ sessionToken: (sess || session).sessionToken, deckId: id });
      setNotice('Submitted! The store will print proxies for this deck.');
    } catch (err) { setError(err.message || 'Submit failed.'); }
  });

  // ---------- my decks ----------
  const openMyDecks = () => requireSession(async (sess) => {
    setMyDecksOpen(true); setLoadingDecks(true);
    try { setMyDecks(await getConsumerDecks((sess || session).sessionToken)); }
    catch (err) { setError(err.message || 'Could not load your decks.'); }
    finally { setLoadingDecks(false); }
  });
  const loadDeck = (d) => { setDeck({ deckId: d.deckId, deckName: d.deckName, cards: d.cards || [] }); setMyDecksOpen(false); setNotice(`Loaded “${d.deckName}”.`); };
  const removeSavedDeck = async (d) => {
    if (!window.confirm(`Delete “${d.deckName}”?`)) return;
    try { await deleteConsumerDeck({ sessionToken: session.sessionToken, deckId: d.deckId }); setMyDecks((list) => list.filter((x) => x.deckId !== d.deckId)); }
    catch (err) { setError(err.message || 'Delete failed.'); }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h3" fontWeight={800}>Deck Builder</Typography>
          <Typography variant="body2" color="text.secondary">Build a Pokémon deck, save it, and submit it to have us print playtest proxies.</Typography>
        </Box>
        <Button variant="text" startIcon={<FolderOpenIcon />} onClick={openMyDecks}>My Decks</Button>
      </Stack>

      <Card variant="outlined" sx={{ maxWidth: 720, mx: 'auto' }}>
        {/* Deck header: name, count, secondary actions */}
        <Box sx={{ p: 2 }}>
          <TextField
            variant="standard" fullWidth value={deck.deckName}
            onChange={(e) => setDeck((d) => ({ ...d, deckName: e.target.value }))}
            InputProps={{ style: { fontSize: 22, fontWeight: 800 } }}
          />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
            <Chip size="small" label={`${deckCount} card${deckCount !== 1 ? 's' : ''}`} />
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Paste a decklist">
              <Button size="small" variant="text" onClick={() => setImportOpen(true)} startIcon={<PlaylistAddIcon />}>Import</Button>
            </Tooltip>
            {deck.cards.length > 0 && <Button size="small" color="inherit" onClick={clearDeck}>Clear</Button>}
          </Stack>
        </Box>

        {/* Primary call to action */}
        <Box sx={{ px: 2, pb: 2 }}>
          <Button
            fullWidth size="large" variant="contained" startIcon={<AddIcon />} onClick={openAddCard}
            sx={{ py: 1.25, fontWeight: 700, fontSize: 16, borderRadius: 2 }}
          >
            Add a Card
          </Button>
        </Box>
        <Divider />

        {/* Deck list, grouped by category like Surreal Admin */}
        {deck.cards.length === 0 ? (
          <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>Your deck is empty.</Typography>
            <Typography variant="body2" color="text.secondary">Tap <b>Add a Card</b> to search and build your deck, or <b>Import</b> a decklist.</Typography>
          </Box>
        ) : (
          <Box sx={{ px: 2, py: 1.5 }}>
            {groupedDeck.map(({ category, cards, count }) => (
              <Box key={category} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'text.secondary' }}>{category} ({count})</Typography>
                {cards.map((c) => (
                  <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box component="img" src={c.imageUrlSmall || c.imageUrl} alt="" sx={{ width: 32, height: 45, objectFit: 'contain', borderRadius: 0.5, bgcolor: 'grey.100', flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{c.name}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">{c.setCode} {c.number}</Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={0.25}>
                      <IconButton size="small" onClick={() => setQty(c.id, (c.quantity || 0) - 1)}><RemoveIcon fontSize="small" /></IconButton>
                      <Typography sx={{ minWidth: 20, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{c.quantity}</Typography>
                      <IconButton size="small" onClick={() => setQty(c.id, (c.quantity || 0) + 1)}><AddIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => removeCard(c.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </Stack>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        )}
        <Divider />
        <Stack spacing={1} sx={{ p: 2 }}>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSave} disabled={!deck.cards.length}>Save deck</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handleSubmit} disabled={!deck.cards.length}>Submit for proxy printing</Button>
          {session?.firstName && <Typography variant="caption" color="text.secondary" align="center">Signed in as {session.firstName}</Typography>}
        </Stack>
      </Card>

      {/* Add a card dialog — search, then tap a card to add it to the deck */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Add a Card</DialogTitle>
        <DialogContent dividers>
          <Box component="form" onSubmit={runSearch} sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              autoFocus fullWidth size="small" placeholder="Search cards by name…" value={query}
              onChange={(e) => setQuery(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Button type="submit" variant="contained" disabled={searching}>{searching ? <CircularProgress size={20} color="inherit" /> : 'Search'}</Button>
          </Box>
          {results.length === 0 && !searching ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
              Search a card by name, then tap it to add it to your deck.
            </Typography>
          ) : (
            <Grid container spacing={1.5}>
              {results.map((c) => {
                const inDeck = deck.cards.find((x) => x.id === c.id)?.quantity || 0;
                return (
                  <Grid item xs={4} sm={3} md={2} key={c.id}>
                    <Card variant="outlined" sx={{ position: 'relative', borderColor: inDeck ? 'primary.main' : 'divider' }}>
                      <CardActionArea onClick={() => addCard(c)}>
                        <CardMedia component="img" image={c.images?.small || c.imageUrlSmall || c.images?.large || c.imageUrl} alt={c.name} sx={{ aspectRatio: '63/88', objectFit: 'contain', bgcolor: 'grey.100' }} />
                        {inDeck > 0 && <Chip size="small" color="primary" label={`×${inDeck}`} sx={{ position: 'absolute', top: 4, right: 4, height: 20, fontWeight: 700 }} />}
                        <Box sx={{ px: 0.5, py: 0.5 }}>
                          <Typography variant="caption" noWrap display="block">{c.name}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">{c.set?.ptcgoCode || c.set?.id || ''} {c.number}</Typography>
                        </Box>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>{deckCount} card{deckCount !== 1 ? 's' : ''} in deck</Typography>
          <Button variant="contained" onClick={() => setAddOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onClose={() => !importing && setImportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Paste a decklist</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>One card per line, e.g. <code>3 Pikachu</code> or <code>2 Charizard ex SVI 4</code>.</Typography>
          <TextField multiline minRows={8} fullWidth value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'4 Pikachu\n2 Professor’s Research'} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)} disabled={importing}>Cancel</Button>
          <Button variant="contained" onClick={doImport} disabled={importing}>{importing ? 'Importing…' : 'Import'}</Button>
        </DialogActions>
      </Dialog>

      {/* My decks dialog */}
      <Dialog open={myDecksOpen} onClose={() => setMyDecksOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>My Decks</DialogTitle>
        <DialogContent>
          {loadingDecks ? <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
            : myDecks.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>No saved decks yet.</Typography>
            : (
              <List>
                {myDecks.map((d) => (
                  <ListItem key={d.deckId} disableGutters
                    secondaryAction={<IconButton edge="end" onClick={() => removeSavedDeck(d)}><DeleteOutlineIcon /></IconButton>}>
                    <ListItemText
                      primary={<>{d.deckName} {d.submitted && <Chip size="small" color="success" label="Submitted" sx={{ ml: 1 }} />}</>}
                      secondary={`${d.cardCount} cards`}
                      sx={{ cursor: 'pointer' }} onClick={() => loadDeck(d)}
                    />
                  </ListItem>
                ))}
              </List>
            )}
        </DialogContent>
        <DialogActions><Button onClick={() => setMyDecksOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Auth (phone OTP) modal */}
      <Dialog open={auth.open} onClose={() => !auth.busy && setAuth((a) => ({ ...a, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle>Verify your phone</DialogTitle>
        <DialogContent>
          {auth.err && <Alert severity="error" sx={{ mb: 2 }}>{auth.err}</Alert>}
          {auth.step === 'phone' ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>We’ll text you a code to save decks to your account.</Typography>
              <TextField fullWidth label="Mobile number" value={auth.phone}
                onChange={(e) => setAuth((a) => ({ ...a, phone: e.target.value }))}
                InputProps={{ inputComponent: PhoneInputComponent }} />
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Enter the 6-digit code we sent to {auth.phone}.</Typography>
              <OtpInput onCodeChange={(code) => setAuth((a) => ({ ...a, code }))} />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuth((a) => ({ ...a, open: false }))} disabled={auth.busy}>Cancel</Button>
          {auth.step === 'phone'
            ? <Button variant="contained" onClick={sendCode} disabled={auth.busy || !auth.phone}>{auth.busy ? 'Sending…' : 'Send code'}</Button>
            : <Button variant="contained" onClick={confirmCode} disabled={auth.busy || (auth.code || '').length < 6}>{auth.busy ? 'Verifying…' : 'Verify'}</Button>}
        </DialogActions>
      </Dialog>

      <Snackbar open={!!notice} autoHideDuration={4000} onClose={() => setNotice('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setNotice('')} sx={{ width: '100%' }}>{notice}</Alert>
      </Snackbar>
      <Snackbar open={!!error} autoHideDuration={5000} onClose={() => setError('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setError('')} sx={{ width: '100%' }}>{error}</Alert>
      </Snackbar>
    </Container>
  );
}
