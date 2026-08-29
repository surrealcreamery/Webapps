// src/services/deckBuilderService.js
// Consumer Deck Builder API layer.
//  - Card search / decklist resolve → public read-only actions on JUDGE_API_URL.
//  - Save / list / submit decks → DECK_API_URL, authenticated by an events OTP session token.
//  - Phone OTP → guestId → sessionToken/customerId, reusing the events/Twilio endpoints.

import {
  JUDGE_API_URL, DECK_API_URL, OTP_VERIFY_URL, CHECK_GUEST_STATUS_URL, EVENTS_API_URL,
} from '@/constants/events/eventsConstants';

const postJson = async (url, payload) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data = {};
  try { data = await res.json(); } catch { /* ignore non-JSON */ }
  if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

// Normalize an E.164 US number from arbitrary input (the PhoneInput component already
// yields +1XXXXXXXXXX, but be defensive about raw digits).
export const toE164 = (raw) => {
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const d = raw.replace(/\D/g, '');
  return d.length === 10 ? `+1${d}` : (d.length === 11 && d[0] === '1' ? `+${d}` : `+${d}`);
};

// ---------- Card search (public) ----------

// Search cards by name. Returns raw judge-api card rows.
export const searchCards = async ({ name, game = 'pokemon', limit = 50 }) => {
  const data = await postJson(JUDGE_API_URL, { action: 'browseCards', name, game, limit });
  return data.cards || data.items || [];
};

// Resolve a pasted decklist ([{ name, setCode?, number?, quantity }]) to full cards.
export const resolveDecklist = async (cards) => {
  const data = await postJson(JUDGE_API_URL, { action: 'resolveDeckCards', cards });
  return data.cards || data.resolved || [];
};

// Map a raw search/resolve card row → the deck card shape we store.
export const toDeckCard = (c, quantity = 1) => ({
  id: c.id,
  name: c.name,
  quantity,
  category: c.category || c.supertype || 'Other',
  setCode: c.setCode || c.set?.ptcgoCode || c.set?.id || '',
  number: c.number || '',
  imageUrl: c.imageUrl || c.images?.large || c.images?.small || '',
  imageUrlSmall: c.imageUrlSmall || c.images?.small || c.images?.large || '',
});

// ---------- OTP → session ----------

export const sendOtp = (phone) =>
  postJson(OTP_VERIFY_URL, { action: 'sendOtp', to: toE164(phone), channel: 'sms' });

// Verify the OTP, resolve the guest, and mint a session. Returns { sessionToken, customerId, firstName, guestId }.
export const verifyOtpAndCreateSession = async (phone, code) => {
  const to = toE164(phone);
  const otp = await postJson(OTP_VERIFY_URL, { action: 'verifyOtp', to, channel: 'sms', code });
  const approved = otp.valid === true || otp.status === 'approved';
  if (!approved) throw new Error('That code didn’t match. Please try again.');

  // Find the guest tied to this phone.
  const status = await postJson(CHECK_GUEST_STATUS_URL, { action: 'checkGuestStatus', mobileNumber: to });
  const account = (status.accounts && status.accounts[0]) || null;
  const guestId = account?.['Guest ID'] || account?.guestId || null;
  const firstName = account?.['First Name'] || account?.firstName || '';
  if (!guestId) {
    // Verified but no guest record — they'll need to register (e.g. via an event) first.
    return { sessionToken: null, customerId: null, firstName, guestId: null, needsRegistration: true };
  }

  const session = await postJson(EVENTS_API_URL, { action: 'createAccountSession', guestId });
  return {
    sessionToken: session.sessionToken || null,
    customerId: session.customerId || null,
    firstName: session.firstName || firstName,
    guestId,
    needsRegistration: !session.sessionToken,
  };
};

// ---------- Consumer decks ----------

export const saveConsumerDeck = ({ sessionToken, deck, playerName }) =>
  postJson(DECK_API_URL, { action: 'saveConsumerDeck', sessionToken, deck, playerName });

export const getConsumerDecks = async (sessionToken) => {
  const data = await postJson(DECK_API_URL, { action: 'getConsumerDecks', sessionToken });
  return data.decks || [];
};

export const deleteConsumerDeck = ({ sessionToken, deckId }) =>
  postJson(DECK_API_URL, { action: 'deleteConsumerDeck', sessionToken, deckId });

export const submitDeckForProxies = ({ sessionToken, deckId }) =>
  postJson(DECK_API_URL, { action: 'submitDeckForProxies', sessionToken, deckId });
