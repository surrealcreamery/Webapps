import React, { useMemo } from 'react';
import AdminDataTable from '@/components/admin-datatable/admin-datatable';
import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import UpdateIcon from '@mui/icons-material/Update';
import { format, parseISO } from 'date-fns';

// Formatting helpers specific to this report's columns
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const safeCurrencyFormat = (value) => value == null ? '—' : currencyFormatter.format(value);
const formatProfitLoss = (value) => {
    if (value == null) return '—';
    return (
        <Typography component="span" sx={{ color: value >= 0 ? 'success.main' : 'error.main', fontWeight: 500 }}>
            {currencyFormatter.format(value)}
        </Typography>
    );
};
const formatLaborWithPercentage = (value, row) => {
    return row.laborPercentage != null
        ? `${safeCurrencyFormat(value)} (${row.laborPercentage.toFixed(1)}%)`
        : safeCurrencyFormat(value);
};

export default function DailyPnLReport({
    tableData,
    permittedLocations,
    filters,
    onFilterChange,
    onRowClick,
    onRefresh,
    onScrollEnd,
    onGoBack,
    onOpenUploadModal,
    onOpenUpdateDialog,
    permissions,
    tableKey
}) {

    const columns = useMemo(() => {
        // --- THIS LOGIC DEFINES 'filterOptions' AND MUST BE INCLUDED ---
        const allLocationNames = permittedLocations.map(l => l['Location Name']);
        let filterOptions = permittedLocations.length > 1
            ? ['All Locations', ...allLocationNames]
            : allLocationNames;
        
        return [
            { key: 'Date', label: 'Date', sortable: true, formatter: (value, row) => row.isSummary ? value : (value ? format(parseISO(value), "EEEE, MMMM do yyyy") : 'N/A') },
            // This column definition requires the 'filterOptions' variable from above
            { key: 'Location Name', label: 'Location', sortable: true, filter: { type: 'checkbox', options: filterOptions } },
            { key: 'profitLoss', label: 'Profit / Loss', sortable: true, formatter: formatProfitLoss },
            { key: 'breakeven', label: 'Breakeven', sortable: true, formatter: safeCurrencyFormat },
            { key: 'netSales', label: 'Net Sales', sortable: true, formatter: safeCurrencyFormat },
            // --- ADDED COLUMNS ---
            { key: 'Retail', label: 'Retail Sales', sortable: true, formatter: safeCurrencyFormat },
            { key: 'Surreal Creamery DoorDash', label: 'SC DoorDash', sortable: true, formatter: safeCurrencyFormat },
            { key: 'Surreal Creamery UberEats', label: 'SC UberEats', sortable: true, formatter: safeCurrencyFormat },
            { key: 'Surreal Creamery GrubHub', label: 'SC GrubHub', sortable: true, formatter: safeCurrencyFormat },
            { key: 'Breaking Batter DoorDash', label: 'BB DoorDash', sortable: true, formatter: safeCurrencyFormat },
            { key: 'Breaking Batter UberEats', label: 'BB UberEats', sortable: true, formatter: safeCurrencyFormat },
            // --- END OF ADDED COLUMNS ---
            { key: 'cogs', label: 'COGS', sortable: true, formatter: safeCurrencyFormat },
            { key: 'Labor', label: 'Labor Cost', sortable: true, formatter: formatLaborWithPercentage },
            { key: 'overhead', label: 'Overhead', sortable: true, formatter: safeCurrencyFormat },
        ];
    }, [permittedLocations]);

    const views = useMemo(() => [{ name: 'All Sales Data', columns: columns.map(c => c.key) }], [columns]);

    const defaultView = useMemo(() => columns.map(c => c.key), [columns]);    const bulkActions = [{ label: 'Update Row', icon: <UpdateIcon />, action: onOpenUpdateDialog, renderType: 'buttonWithText' }];
    const getRowSx = (row) => row.isSummary ? { backgroundColor: theme => theme.palette.action.hover, '& .MuiTableCell-root .MuiTypography-root': { fontWeight: 'bold' } } : (row.isFuture ? { backgroundColor: '#fafafa', color: '#bdbdbd', '& .MuiTableCell-root': { color: '#bdbdbd' } } : {});

    return (
        <>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                <Breadcrumbs aria-label="breadcrumb">
                    <Link
                        underline="hover"
                        color="inherit"
                        href="#"
                        onClick={(e) => { e.preventDefault(); onGoBack(); }}
                    >
                        Reports
                    </Link>
                    <Typography color="text.primary">Daily Profit and Loss</Typography>
                </Breadcrumbs>
            </Box>
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {permissions?.view ? (
                    <AdminDataTable
                        sx={{ mt: 0 }}
                        key={tableKey}
                        title="Daily Profit & Loss"
                        data={tableData}
                        columns={columns}
                        defaultView={defaultView}
                        views={views}
                        filters={filters}
                        onFilterChange={onFilterChange}
                        getRowId={(row) => row.id}
                        onRefresh={onRefresh}
                        onScrollEnd={onScrollEnd}
                        getRowSx={getRowSx}
                        enableRowSelection={permissions?.update}
                        bulkActions={permissions?.update ? bulkActions : []}
                        searchKeys={['Date', 'Location Name']}
                        onRowClick={onRowClick}
                        onAddClick={permissions?.create ? onOpenUploadModal : undefined}
                    />
                ) : (
                    <Box sx={{ p: 4, textAlign: 'center', mt: 4 }}>
                        <Typography variant="h6">Access Denied</Typography>
                        <Typography>You do not have permission to view reports.</Typography>
                    </Box>
                )}
            </Box>
        </>
    );
}