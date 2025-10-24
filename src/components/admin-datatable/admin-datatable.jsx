import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Typography,
  CircularProgress,
  Drawer,
  IconButton,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Checkbox,
  MenuItem,
  Toolbar,
  Tooltip,
  FormGroup,
  FormControlLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  FilterList as FilterListIcon,
  ViewColumn as ViewColumnIcon,
  ViewList as ViewListIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { getAuth } from 'firebase/auth';

export default function AdminDataTable({
  title,
  data: dataProp,
  columns = [],
  views = [],
  currentView,
  defaultView = [],
  searchKeys = [],
  filters: filtersProp,
  onFilterChange,
  onRefresh = () => {},
  onAddClick,
  onRowClick = () => {},
  onViewChange = () => {},
  getRowId = row => row.id,
  bulkActions = [],
  enableRowSelection = false,
  onScrollEnd = () => {},
  getRowSx,
  headerContent, // New prop for breadcrumbs or other header elements
}) {
  const auth = getAuth();
  const [search, setSearch] = useState('');
  const filters = filtersProp || {};
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(defaultView);
  const [selected, setSelected] = useState([]);
  const lastSelectedId = useRef(null);
  const tableContainerRef = useRef(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const searchBarRef = useRef(null);
  const [searchBarHeight, setSearchBarHeight] = useState(0);

  const selectionBarHeight = (enableRowSelection && selected.length > 0) ? 64 : 0;

  useEffect(() => {
    if (searchBarRef.current) {
      setSearchBarHeight(searchBarRef.current.offsetHeight);
    }
  }, [selected.length]); // Recalculate if selection bar appears/disappears

  useEffect(() => {
    setIsFetchingMore(false);
  }, [dataProp]);

  const handleScroll = useCallback(() => {
    const element = tableContainerRef.current;
    if (!element || isFetchingMore) return;
    const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 200;
    if (isAtBottom) {
      setIsFetchingMore(true);
      onScrollEnd();
    }
  }, [isFetchingMore, onScrollEnd]);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    setVisibleColumns(defaultView);
  }, [defaultView]);

  const data = Array.isArray(dataProp) ? dataProp : [];

  useEffect(() => {
    setLastUpdated(new Date().toLocaleString());
  }, [search, sortColumn, sortDirection]);

  const handleRow = (row) => {
    if (typeof onRowClick === 'function') {
      onRowClick(row);
    }
  };

  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
      const aV = (a[sortColumn] || '').toString().toLowerCase();
      const bV = (b[sortColumn] || '').toString().toLowerCase();
      if (aV < bV) return sortDirection === 'asc' ? -1 : 1;
      if (aV > bV) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortColumn, sortDirection]);

  const filteredData = useMemo(() => {
    return sorted.filter(row => {
      if (row.isSummary) return true;
      const matchesSearch = searchKeys.some(k =>
        (row[k] || '').toString().toLowerCase().includes(search.toLowerCase())
      );
      if (!matchesSearch) return false;
      return Object.entries(filters).every(([key, val]) => {
        if (!val || val.length === 0) return true;
        const cell = (row[key] || '').toString();
        if (Array.isArray(val)) {
          return val.includes('All Locations') || val.includes(cell);
        } else {
          return val === 'All Locations' || cell === val;
        }
      });
    });
  }, [sorted, search, searchKeys, filters]);

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = filteredData.filter(n => !n.isSummary).map((n) => getRowId(n));
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleRowCheckboxClick = (event, id) => {
    const row = data.find(r => getRowId(r) === id);
    if (row?.isSummary) return;

    const isShiftPressed = event.nativeEvent.shiftKey;

    if (enableRowSelection && isShiftPressed && lastSelectedId.current) {
      const allVisibleIds = filteredData.map(r => getRowId(r));
      const lastIndex = allVisibleIds.indexOf(lastSelectedId.current);
      const currentIndex = allVisibleIds.indexOf(id);
      
      if (lastIndex === -1) {
        handleSingleClick(id);
        return;
      }

      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);
      const rangeIds = allVisibleIds.slice(start, end + 1);
      
      const newSelected = [...new Set([...selected, ...rangeIds.filter(i => !i.startsWith('summary-'))])];
      setSelected(newSelected);

    } else {
      handleSingleClick(id);
    }
  };

  const handleSingleClick = (id) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1),
      );
    }
    setSelected(newSelected);
    lastSelectedId.current = id;
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;

  return (
    <Box sx={{ width:'100%', height: '100%', position: 'relative' }}>
      {enableRowSelection && selected.length > 0 && (
        <Toolbar
          sx={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1150,
            bgcolor: 'white', borderBottom: '1px solid #ddd',
            minHeight: '64px !important'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Typography color="text.primary" variant="subtitle1" component="div">
              {selected.length} selected
            </Typography>
            {bulkActions.filter(a => a.renderType === 'buttonWithText').map(action => (
                <Box key={action.label} onClick={() => action.action(selected)} sx={{ display:'flex', alignItems:'center', cursor:'pointer', color:'primary.main', '&:hover':{ opacity:0.8 }, ml: 2 }}>
                  {React.cloneElement(action.icon, { fontSize: 'small' })}
                  <Typography variant="body2" sx={{ ml:0.5 }}>{action.label}</Typography>
                </Box>
            ))}
          </Box>
          <Box>
            {bulkActions.filter(a => !a.renderType || a.renderType === 'icon').map(action => (
                <Tooltip title={action.label} key={action.label}>
                  <IconButton onClick={() => action.action(selected)}>
                    {action.icon || <DeleteIcon />}
                  </IconButton>
                </Tooltip>
            ))}
          </Box>
        </Toolbar>
      )}
      
      <Box 
        ref={searchBarRef} 
        sx={{ 
          position:'absolute', 
          top: selectionBarHeight,
          left:0, 
          right:0, 
          zIndex:1100, 
          bgcolor:'white', 
          borderBottom:'1px solid #ddd', 
          px:2, py:1, 
          transition: 'top 0.3s', 
        }}>
        <TextField fullWidth size="small" placeholder={`Search by ${searchKeys.join(', ')}`} value={search} onChange={e => setSearch(e.target.value)} InputProps={{ startAdornment: ( <InputAdornment position="start"> <SearchIcon color="primary" /> </InputAdornment> ) }} />
        <Box sx={{ display:'flex', gap:2, mt:1 }}>
          <Box onClick={() => onRefresh()} sx={{ display:'flex', alignItems:'center', cursor:'pointer', color:'primary.main', '&:hover':{ opacity:0.8 } }}>
            <RefreshIcon fontSize="small" /> <Typography variant="body2" sx={{ ml:0.5 }}>Refresh</Typography>
          </Box>
          {typeof onAddClick === 'function' && (
            <Box onClick={onAddClick} sx={{ display:'flex', alignItems:'center', cursor:'pointer', color:'primary.main', '&:hover':{ opacity:0.8 } }}>
              <AddIcon fontSize="small" /> <Typography variant="body2" sx={{ ml:0.5 }}>Add</Typography>
            </Box>
          )}
          <Box onClick={() => setFilterOpen(true)} sx={{ display:'flex', alignItems:'center', cursor:'pointer', color:'primary.main', '&:hover':{ opacity:0.8 } }}>
            <FilterListIcon fontSize="small" /> <Typography variant="body2" sx={{ ml:0.5 }}>Filters</Typography>
          </Box>
          <Box onClick={() => setColumnOpen(true)} sx={{ display:'flex', alignItems:'center', cursor:'pointer', color:'primary.main', '&:hover':{ opacity:0.8 } }}>
            <ViewColumnIcon fontSize="small" /> <Typography variant="body2" sx={{ ml:0.5 }}>Columns</Typography>
          </Box>
          <Box onClick={() => setViewOpen(true)} sx={{ display:'flex', alignItems:'center', cursor:'pointer', color:'primary.main', '&:hover':{ opacity:0.8 } }}>
            <ViewListIcon fontSize="small" /> <Typography variant="body2" sx={{ ml:0.5 }}>Views</Typography>
          </Box>
        </Box>
      </Box>

      <Box
        ref={tableContainerRef}
        sx={{
          pt: `${searchBarHeight + selectionBarHeight}px`,
          px: 2,
          pb: 2,
          overflow: 'auto',
          height: '100%',
          transition: 'padding-top 0.3s',
        }}
      >
        {/* Render breadcrumbs here, below the search bar */}
        {headerContent && (
          <Box sx={{ py: 2, borderBottom: 1, borderColor: 'divider' }}>
            {headerContent}
          </Box>
        )}
        
        <Box sx={{ py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="text.secondary">Last updated: {lastUpdated}</Typography>
        </Box>

        <Table size="small" stickyHeader sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              {enableRowSelection && ( <TableCell padding="checkbox" sx={{ bgcolor: 'background.paper', top: 0, zIndex: 10 }}> <Checkbox color="primary" indeterminate={selected.length > 0 && selected.length < filteredData.filter(r => !r.isSummary).length} checked={filteredData.filter(r => !r.isSummary).length > 0 && selected.length === filteredData.filter(r => !r.isSummary).length} onChange={handleSelectAllClick} /> </TableCell> )}
              {visibleColumns.map(key => {
                const col = columns.find(c => c.key===key);
                return (
                  <TableCell 
                    key={key} 
                    style={{ width: col?.width }} 
                    sx={{ 
                      fontWeight:'bold', 
                      cursor:col?.sortable?'pointer':'default', 
                      whiteSpace:'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      bgcolor: 'background.paper',
                      top: 0,
                      ...col?.sx 
                    }} 
                    onClick={() => col?.sortable && handleSort(key)}
                  >
                    <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                      {col?.label} {col?.sortable && sortColumn===key && ( <Typography fontSize="0.75rem">{sortDirection==='asc'?'▲':'▼'}</Typography> )}
                    </Box>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.length > 0 ? (
              filteredData.map((row, idx) => {
                const rowId = getRowId(row) || idx;
                const isItemSelected = isSelected(rowId);
                return (
                <TableRow
                  key={rowId} hover role={enableRowSelection ? "checkbox" : "button"}
                  aria-checked={isItemSelected} tabIndex={-1} selected={isItemSelected}
                  sx={getRowSx ? getRowSx(row) : {}}
                >
                  {enableRowSelection && (
                    <TableCell padding="checkbox" onClick={(event) => handleRowCheckboxClick(event, rowId)}>
                      {!row.isSummary && <Checkbox color="primary" checked={isItemSelected} />}
                    </TableCell>
                  )}
                  {visibleColumns.map(key => {
                    const col = columns.find(c => c.key === key);
                    const cellValue = row[key];
                    return (
                      <TableCell key={key} style={{ width: col?.width }} sx={{...col?.sx, cursor: 'pointer'}} onClick={() => !row.isSummary && handleRow(row)}>
                        <Typography noWrap component="div" title={String(cellValue || '')}>
                          {col?.formatter ? col.formatter(cellValue, row) : col?.render ? col.render(row) : cellValue}
                        </Typography>
                      </TableCell>
                    );
                  })}
                </TableRow>
              )})
            ) : (
              <TableRow><TableCell colSpan={visibleColumns.length + (enableRowSelection ? 1 : 0)}>{data.length ? 'No results found.' : 'Loading…'}</TableCell></TableRow>
            )}
            {isFetchingMore && ( <TableRow><TableCell colSpan={visibleColumns.length + (enableRowSelection ? 1 : 0)} sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={24} /><Typography variant="body2" sx={{ mt: 1 }}>Loading more...</Typography></TableCell></TableRow> )}
          </TableBody>
        </Table>
      </Box>

      {/* Drawers */}
      <Drawer anchor="right" open={filterOpen} onClose={() => setFilterOpen(false)} PaperProps={{ sx: { top:48, height:'calc(100%-48px)', width:300, zIndex:1200 } }}>
        <Box sx={{ p:2 }}>
          <Box sx={{ display:'flex', alignItems:'center', mb:2 }}>
            <Typography variant="h6" sx={{ flexGrow:1 }}>Filter Columns</Typography><IconButton onClick={()=>setFilterOpen(false)}><CloseIcon/></IconButton>
          </Box>
          <Divider sx={{ mb:2 }} />
          {columns.filter(c => c.filter).map(col => (
            <Box key={col.key} sx={{ mb:2 }}>
              <Typography variant="subtitle2">{col.label}</Typography>
              {col.filter.type === 'select' && (
                <TextField select fullWidth size="small" value={filters[col.key] || 'All Locations'} onChange={e => onFilterChange && onFilterChange(col.key, e.target.value)}>
                  {Array.isArray(col.filter.options) && col.filter.options.map(opt => ( <MenuItem key={opt} value={opt}>{opt}</MenuItem> ))}
                </TextField>
              )}
              {col.filter.type === 'checkbox' && (
                <FormGroup>
                  {Array.isArray(col.filter.options) && col.filter.options.map(opt => (
                    <FormControlLabel 
                      key={opt}
                      control={
                        <Checkbox 
                          checked={(filters[col.key] || []).includes(opt)}
                          onChange={(e) => {
                            if (!onFilterChange) return;
                            const currentValues = filters[col.key] || [];
                            const newValues = e.target.checked
                              ? [...currentValues, opt]
                              : currentValues.filter(v => v !== opt);
                            onFilterChange(col.key, newValues);
                          }}
                          name={opt}
                        />
                      }
                      label={opt}
                    />
                  ))}
                </FormGroup>
              )}
            </Box>
          ))}
        </Box>
      </Drawer>

      <Drawer anchor="right" open={columnOpen} onClose={() => setColumnOpen(false)} PaperProps={{ sx: { top:48, height:'calc(100%-48px)', width:300, zIndex:1200 } }}>
        <Box sx={{ p:2 }}>
          <Box sx={{ display:'flex', alignItems:'center', mb:2 }}>
            <Typography variant="h6" sx={{ flexGrow:1 }}>Select Columns</Typography><IconButton onClick={()=>setColumnOpen(false)}><CloseIcon/></IconButton>
          </Box>
          <Divider sx={{ mb:2 }} />
          {columns.map(col=>( <Box key={col.key} sx={{display:'flex',alignItems:'center',mb:1}}> <Checkbox checked={visibleColumns.includes(col.key)} onChange={e=>{ const next = e.target.checked ? [...visibleColumns, col.key] : visibleColumns.filter(k=>k!==col.key); setVisibleColumns(next); }}/> <Typography sx={{ ml:1 }}>{col.label}</Typography> </Box> ))}
        </Box>
      </Drawer>

      <Drawer anchor="right" open={viewOpen} onClose={()=>setViewOpen(false)} PaperProps={{ sx: { top:48, height:'calc(100%-48px)', width:300, zIndex:1200 } }}>
        <Box sx={{ p:2 }}>
          <Box sx={{ display:'flex', alignItems:'center', mb:2 }}>
            <Typography variant="h6" sx={{ flexGrow:1 }}>Choose View</Typography><IconButton onClick={()=>setViewOpen(false)}><CloseIcon/></IconButton>
          </Box>
          <Divider sx={{ mb:2 }} />
          <List>
            {views.map(v => ( <ListItemButton key={v.id} selected={v.id === currentView} onClick={() => { onViewChange(v.id); setViewOpen(false); }}><ListItemText primary={v.label} /></ListItemButton> ))}
          </List>
        </Box>
      </Drawer>
    </Box>
  );
}

