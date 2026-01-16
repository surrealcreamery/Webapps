import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  TextField,
  InputAdornment,
  Typography,
  CircularProgress,
  Drawer,
  IconButton,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  MenuItem,
  Toolbar,
  Tooltip,
  FormGroup,
  FormControlLabel,
  Chip,
  Tab,
  Tabs,
  FormControl,
  Select,
  Avatar,
  Stack,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Icon } from '@iconify/react';

// Iconify wrapper for consistent sizing
const Iconify = ({ icon, width = 20, sx, ...other }) => (
  <Box component={Icon} icon={icon} sx={{ width, height: width, flexShrink: 0, ...sx }} {...other} />
);

// Status Label component (similar to Minimal's Label)
function StatusLabel({ status, color = 'default', variant = 'soft' }) {
  const colorMap = {
    success: { bg: 'success.lighter', text: 'success.dark' },
    warning: { bg: 'warning.lighter', text: 'warning.dark' },
    error: { bg: 'error.lighter', text: 'error.dark' },
    info: { bg: 'info.lighter', text: 'info.dark' },
    default: { bg: 'grey.200', text: 'grey.800' },
    primary: { bg: 'primary.lighter', text: 'primary.dark' },
  };

  const colors = colorMap[color] || colorMap.default;

  return (
    <Chip
      label={status}
      size="small"
      sx={{
        height: 24,
        minWidth: 24,
        borderRadius: '6px',
        fontWeight: 600,
        fontSize: '1.2rem',
        textTransform: 'capitalize',
        bgcolor: colors.bg,
        color: colors.text,
        '& .MuiChip-label': {
          px: 1,
        },
      }}
    />
  );
}

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
  headerContent,
  // New Minimal-style props
  tabs = [], // Array of { value, label, count } for filter tabs
  activeTab,
  onTabChange,
  initialRowsToShow = 25, // Initial number of rows to display
  rowsToLoadOnScroll = 25, // Number of rows to add when scrolling
  onEditRow,
  onDeleteRow,
  statusField, // Field name to render as status chip
  statusColorMap = {}, // Map of status value to color
  avatarField, // Field to show avatar
  primaryField, // Primary field (name)
  secondaryField, // Secondary field (email)
}) {
  const [search, setSearch] = useState('');
  const filters = filtersProp || {};
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(defaultView);
  const [selected, setSelected] = useState([]);
  const lastSelectedId = useRef(null);
  const tableContainerRef = useRef(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Infinite scroll state - number of rows currently visible
  const [visibleRowCount, setVisibleRowCount] = useState(initialRowsToShow);

  // Reset visible row count when data or filters change
  useEffect(() => {
    setVisibleRowCount(initialRowsToShow);
    setIsLoadingMore(false);
  }, [dataProp, search, filters, initialRowsToShow]);

  useEffect(() => {
    setVisibleColumns(defaultView);
  }, [defaultView]);

  const data = Array.isArray(dataProp) ? dataProp : [];

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

  // Visible data (infinite scroll)
  const visibleData = useMemo(() => {
    return filteredData.slice(0, visibleRowCount);
  }, [filteredData, visibleRowCount]);

  // Check if there are more rows to load
  const hasMoreRows = visibleRowCount < filteredData.length;

  // Handle scroll to load more rows
  const handleScroll = useCallback(() => {
    const element = tableContainerRef.current;
    if (!element || isLoadingMore) return;

    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    if (isNearBottom) {
      if (hasMoreRows) {
        // Load more rows from existing data
        setIsLoadingMore(true);
        setTimeout(() => {
          setVisibleRowCount(prev => Math.min(prev + rowsToLoadOnScroll, filteredData.length));
          setIsLoadingMore(false);
        }, 300);
      } else {
        // All current data is shown, request more data from server
        onScrollEnd();
      }
    }
  }, [isLoadingMore, hasMoreRows, rowsToLoadOnScroll, filteredData.length, onScrollEnd]);

  // Attach scroll listener
  useEffect(() => {
    const container = tableContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = filteredData.filter(n => !n.isSummary).map((n) => getRowId(n));
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleRowCheckboxClick = (event, id) => {
    event.stopPropagation();
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

      const newSelected = [...new Set([...selected, ...rangeIds.filter(i => !String(i).startsWith('summary-'))])];
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

  // Render cell with special handling for status, avatar+name, etc.
  const renderCell = (row, col) => {
    const key = col.key;
    const cellValue = row[key];

    // Status field rendering
    if (statusField && key === statusField) {
      const statusColor = statusColorMap[cellValue] || 'default';
      return <StatusLabel status={cellValue} color={statusColor} />;
    }

    // Avatar + Name + Email combined field
    if (primaryField && key === primaryField && avatarField) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={row[avatarField]}
            alt={cellValue}
            sx={{ width: 40, height: 40 }}
          >
            {cellValue?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Stack spacing={0}>
            <Typography variant="body2" fontWeight={600}>
              {cellValue}
            </Typography>
            {secondaryField && row[secondaryField] && (
              <Typography variant="caption" color="text.disabled">
                {row[secondaryField]}
              </Typography>
            )}
          </Stack>
        </Box>
      );
    }

    // Default rendering
    if (col?.formatter) return col.formatter(cellValue, row);
    if (col?.render) return col.render(row);
    return cellValue;
  };

  return (
    <Card sx={{ borderRadius: 2, display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      {/* Filter Tabs */}
      {tabs.length > 0 && (
        <Tabs
          value={activeTab || tabs[0]?.value}
          onChange={(e, v) => onTabChange && onTabChange(v)}
          sx={{
            px: 2.5,
            boxShadow: (theme) => `inset 0 -2px 0 0 ${alpha(theme.palette.grey[500], 0.08)}`,
          }}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={tab.label}
              iconPosition="end"
              icon={
                tab.count !== undefined && (
                  <Chip
                    label={tab.count}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '1.2rem',
                      fontWeight: 600,
                      ml: 1,
                      bgcolor: activeTab === tab.value ? 'primary.main' : 'grey.200',
                      color: activeTab === tab.value ? 'white' : 'text.secondary',
                    }}
                  />
                )
              }
            />
          ))}
        </Tabs>
      )}

      {/* Toolbar */}
      <Box sx={{ p: 2.5, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', flexShrink: 0 }}>
        {/* Search */}
        <TextField
          size="small"
          placeholder={`Search${searchKeys.length ? ` by ${searchKeys.join(', ')}` : ''}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="solar:magnifer-linear" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={onRefresh} size="small">
              <Iconify icon="solar:refresh-bold" />
            </IconButton>
          </Tooltip>
          {typeof onAddClick === 'function' && (
            <Tooltip title="Add">
              <IconButton onClick={onAddClick} size="small" color="primary">
                <Iconify icon="solar:add-circle-bold" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Filters">
            <IconButton onClick={() => setFilterOpen(true)} size="small">
              <Iconify icon="solar:filter-bold" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Columns">
            <IconButton onClick={() => setColumnOpen(true)} size="small">
              <Iconify icon="solar:checklist-bold" />
            </IconButton>
          </Tooltip>
          {views.length > 0 && (
            <Tooltip title="Views">
              <IconButton onClick={() => setViewOpen(true)} size="small">
                <Iconify icon="solar:list-bold" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Breadcrumbs/Header content */}
      {headerContent && (
        <Box sx={{ px: 2.5, pb: 2 }}>
          {headerContent}
        </Box>
      )}

      {/* Selection toolbar */}
      {enableRowSelection && selected.length > 0 && (
        <Toolbar
          sx={{
            pl: 2,
            pr: 1,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            color: 'primary.main',
          }}
        >
          <Typography sx={{ flex: '1 1 100%' }} variant="subtitle1">
            {selected.length} selected
          </Typography>
          {bulkActions.map((action) => (
            <Tooltip key={action.label} title={action.label}>
              <IconButton onClick={() => action.action(selected)} color="primary">
                {action.icon || <Iconify icon="solar:trash-bin-trash-bold" />}
              </IconButton>
            </Tooltip>
          ))}
        </Toolbar>
      )}

      {/* Table wrapper to constrain horizontal overflow */}
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        <TableContainer
          ref={tableContainerRef}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'auto',
          }}
        >
          <Table size="medium" stickyHeader>
          <TableHead>
            <TableRow>
              {enableRowSelection && (
                <TableCell
                  padding="checkbox"
                  sx={{
                    bgcolor: 'background.neutral',
                    borderBottom: (theme) => `1px dashed ${theme.palette.divider}`,
                  }}
                >
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < filteredData.filter(r => !r.isSummary).length}
                    checked={filteredData.filter(r => !r.isSummary).length > 0 && selected.length === filteredData.filter(r => !r.isSummary).length}
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
              )}
              {visibleColumns.map((key) => {
                const col = columns.find((c) => c.key === key);
                return (
                  <TableCell
                    key={key}
                    style={{ width: col?.width }}
                    sx={{
                      bgcolor: 'background.neutral',
                      color: 'text.secondary',
                      fontWeight: 600,
                      fontSize: '1.4rem',
                      cursor: col?.sortable ? 'pointer' : 'default',
                      borderBottom: (theme) => `1px dashed ${theme.palette.divider}`,
                      whiteSpace: 'nowrap',
                      ...col?.sx,
                    }}
                    onClick={() => col?.sortable && handleSort(key)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {col?.label}
                      {col?.sortable && sortColumn === key && (
                        <Typography component="span" fontSize="1.2rem">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                );
              })}
              {(onEditRow || onDeleteRow) && (
                <TableCell
                  sx={{
                    width: 88,
                    bgcolor: 'background.neutral',
                    borderBottom: (theme) => `1px dashed ${theme.palette.divider}`,
                  }}
                />
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleData.length > 0 ? (
              visibleData.map((row, idx) => {
                const rowId = getRowId(row) || idx;
                const isItemSelected = isSelected(rowId);
                const isLastRow = idx === visibleData.length - 1 && !hasMoreRows;
                return (
                  <TableRow
                    key={rowId}
                    hover
                    selected={isItemSelected}
                    sx={{
                      cursor: 'pointer',
                      '&:last-of-type td': { border: 0 },
                      ...(getRowSx ? getRowSx(row) : {}),
                    }}
                  >
                    {enableRowSelection && (
                      <TableCell
                        padding="checkbox"
                        sx={{ borderBottom: isLastRow ? 0 : (theme) => `1px dashed ${theme.palette.divider}` }}
                      >
                        {!row.isSummary && (
                          <Checkbox
                            checked={isItemSelected}
                            onClick={(e) => handleRowCheckboxClick(e, rowId)}
                          />
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.map((key) => {
                      const col = columns.find((c) => c.key === key);
                      return (
                        <TableCell
                          key={key}
                          style={{ width: col?.width }}
                          sx={{
                            borderBottom: isLastRow ? 0 : (theme) => `1px dashed ${theme.palette.divider}`,
                            ...col?.sx,
                          }}
                          onClick={() => !row.isSummary && onRowClick(row)}
                        >
                          {renderCell(row, col)}
                        </TableCell>
                      );
                    })}
                    {(onEditRow || onDeleteRow) && (
                      <TableCell
                        sx={{ borderBottom: isLastRow ? 0 : (theme) => `1px dashed ${theme.palette.divider}` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                          {onEditRow && (
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => onEditRow(row)}>
                                <Iconify icon="solar:pen-bold" width={18} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {onDeleteRow && (
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => onDeleteRow(row)} color="error">
                                <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (enableRowSelection ? 1 : 0) + (onEditRow || onDeleteRow ? 1 : 0)}
                  sx={{ textAlign: 'center', py: 8 }}
                >
                  <Typography color="text.secondary">
                    {data.length ? 'No results found' : 'Loading...'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {/* Loading more indicator */}
            {isLoadingMore && (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (enableRowSelection ? 1 : 0) + (onEditRow || onDeleteRow ? 1 : 0)}
                  sx={{ textAlign: 'center', py: 2, border: 0 }}
                >
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {/* End of data indicator */}
            {!hasMoreRows && visibleData.length > 0 && (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (enableRowSelection ? 1 : 0) + (onEditRow || onDeleteRow ? 1 : 0)}
                  sx={{ textAlign: 'center', py: 2, border: 0, color: 'text.secondary' }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Showing all {filteredData.length} results
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </TableContainer>
      </Box>

      {/* Drawers */}
      <Drawer
        anchor="right"
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        PaperProps={{ sx: { width: 320 } }}
      >
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>Filters</Typography>
            <IconButton onClick={() => setFilterOpen(false)} size="small">
              <Iconify icon="solar:close-circle-bold" />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2.5 }} />
          {columns.filter((c) => c.filter).map((col) => (
            <Box key={col.key} sx={{ mb: 2.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{col.label}</Typography>
              {col.filter.type === 'select' && (
                <FormControl fullWidth size="small">
                  <Select
                    value={filters[col.key] || ''}
                    onChange={(e) => onFilterChange && onFilterChange(col.key, e.target.value)}
                    displayEmpty
                  >
                    <MenuItem value="">All</MenuItem>
                    {Array.isArray(col.filter.options) && col.filter.options.map((opt) => (
                      <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {col.filter.type === 'checkbox' && (
                <List disablePadding>
                  {Array.isArray(col.filter.options) && col.filter.options.map((opt) => {
                    const isChecked = (filters[col.key] || []).includes(opt);
                    return (
                      <ListItemButton
                        key={opt}
                        onClick={() => {
                          if (!onFilterChange) return;
                          const currentValues = filters[col.key] || [];
                          const newValues = isChecked
                            ? currentValues.filter((v) => v !== opt)
                            : [...currentValues, opt];
                          onFilterChange(col.key, newValues);
                        }}
                        sx={{
                          minHeight: 40,
                          borderRadius: 1,
                          mb: 0.5,
                          px: 1.5,
                          bgcolor: isChecked ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'transparent',
                          '&:hover': {
                            bgcolor: (theme) => isChecked
                              ? alpha(theme.palette.primary.main, 0.16)
                              : alpha(theme.palette.grey[500], 0.08),
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Checkbox
                            size="small"
                            checked={isChecked}
                            sx={{ p: 0 }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={opt}
                          primaryTypographyProps={{
                            variant: 'body2',
                            fontWeight: isChecked ? 600 : 400,
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </Box>
          ))}
        </Box>
      </Drawer>

      <Drawer
        anchor="right"
        open={columnOpen}
        onClose={() => setColumnOpen(false)}
        PaperProps={{ sx: { width: 320 } }}
      >
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>Columns</Typography>
            <IconButton onClick={() => setColumnOpen(false)} size="small">
              <Iconify icon="solar:close-circle-bold" />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2.5 }} />
          <List disablePadding>
            {columns.map((col) => {
              const isChecked = visibleColumns.includes(col.key);
              return (
                <ListItemButton
                  key={col.key}
                  onClick={() => {
                    const next = isChecked
                      ? visibleColumns.filter((k) => k !== col.key)
                      : [...visibleColumns, col.key];
                    setVisibleColumns(next);
                  }}
                  sx={{
                    minHeight: 40,
                    borderRadius: 1,
                    mb: 0.5,
                    px: 1.5,
                    bgcolor: isChecked ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    '&:hover': {
                      bgcolor: (theme) => isChecked
                        ? alpha(theme.palette.primary.main, 0.16)
                        : alpha(theme.palette.grey[500], 0.08),
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox
                      size="small"
                      checked={isChecked}
                      sx={{ p: 0 }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={col.label}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: isChecked ? 600 : 400,
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Drawer>

      <Drawer
        anchor="right"
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        PaperProps={{ sx: { width: 320 } }}
      >
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>Views</Typography>
            <IconButton onClick={() => setViewOpen(false)} size="small">
              <Iconify icon="solar:close-circle-bold" />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2.5 }} />
          <List disablePadding>
            {views.map((v, idx) => {
              const viewId = v.id || v.name || idx;
              const viewLabel = v.label || v.name || `View ${idx + 1}`;
              const isActive = viewId === currentView;
              return (
                <ListItemButton
                  key={viewId}
                  onClick={() => {
                    onViewChange(viewId);
                    if (v.columns) {
                      setVisibleColumns(v.columns);
                    }
                    setViewOpen(false);
                  }}
                  sx={{
                    minHeight: 40,
                    borderRadius: 1,
                    mb: 0.5,
                    px: 1.5,
                    color: isActive ? 'primary.main' : 'text.secondary',
                    bgcolor: isActive ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    '&:hover': {
                      bgcolor: (theme) => isActive
                        ? alpha(theme.palette.primary.main, 0.16)
                        : alpha(theme.palette.grey[500], 0.08),
                    },
                  }}
                >
                  <ListItemText
                    primary={viewLabel}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Drawer>
    </Card>
  );
}
