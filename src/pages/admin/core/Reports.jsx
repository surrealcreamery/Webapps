import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Box,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Snackbar,
    Alert,
    Typography
} from '@mui/material';
import { format, parseISO, eachDayOfInterval, subDays, startOfDay, addDays, isAfter, getDay, subYears, setDay, subWeeks, addWeeks } from 'date-fns';
import {
    useDailyRevenue,
    useRetrieveNetSales,
    useRetrieveLabor,
    useRetrieveOrdersByDay,
    useTeamMembers,
    useTriageUploadedCsv,
    useLocations
} from '@/contexts/admin/AdminDataContext';

import ReportSelectionList from '@/pages/admin/reports/ReportSelectionList';
import DailyPnLReport from '@/pages/admin/reports/DailyPnLReport';
import ReportDetailModal from '@/pages/admin/reports/ReportDetailModal';
import HistoricalSalesReport from '@/pages/admin/reports/HistoricalSalesReport';
import GoogleDriveFileListerModal from '@/pages/admin/reports/GoogleDriveFileListerModal'; // Import the new modal

const DAYS_PER_PAGE = 30;

export default function Reports({ fetchedPermissions }) {
    const [selectedReportName, setSelectedReportName] = useState(null);
    const { data: rawReportsData, isLoading: isLoadingReports, error: reportsError, refetch } = useDailyRevenue();
    const { data: locations = [], isLoading: isLoadingLocations } = useLocations();
    const { data: teamMembers, isLoading: isLoadingTeamMembers } = useTeamMembers();
    const retrieveNetSalesMutation = useRetrieveNetSales();
    const retrieveLaborMutation = useRetrieveLabor();
    const retrieveOrdersMutation = useRetrieveOrdersByDay();
    const triageMutation = useTriageUploadedCsv();
    const [isUpdateDialogOpen, setUpdateDialogOpen] = useState(false);
    const [rowsToUpdate, setRowsToUpdate] = useState([]);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [ordersData, setOrdersData] = useState(null);
    const [isOrdersLoading, setIsOrdersLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info', duration: 4000 });
    const [tableKey, setTableKey] = useState(0);
    const [isFileListerOpen, setIsFileListerOpen] = useState(false); // New state for the modal
    const [dateRange, setDateRange] = useState(() => ({ start: subDays(startOfDay(new Date()), DAYS_PER_PAGE - 1), end: addDays(startOfDay(new Date()), 14), }));

    const MOCK_SALES_LAST_YEAR = useMemo(() =>
        eachDayOfInterval({ start: subYears(new Date(), 2), end: new Date() }).map(date => ({
            Date: date.toISOString(),
            netSales: 800 + Math.random() * 400 + (getDay(date) >= 5 ? 300 : 0)
        })),
        []
    );
    const reportPerms = useMemo(() => fetchedPermissions?.Reports || fetchedPermissions, [fetchedPermissions]);
    const permittedLocations = useMemo(() => {
        if (!reportPerms?.view || isLoadingLocations || !locations) return [];
        if (reportPerms.allLocations === true) return locations;
        const hasSpecificLocations = Array.isArray(reportPerms.allowedLocations) && reportPerms.allowedLocations.length > 0;
        if (hasSpecificLocations) {
            const allowedIds = new Set(reportPerms.allowedLocations);
            return locations.filter(loc => allowedIds.has(loc['Location ID']));
        }
        return [];
    }, [reportPerms, locations, isLoadingLocations]);
    const initialFilterState = useMemo(() => {
        if (!permittedLocations) return { 'Location Name': [] };
        if (permittedLocations.length === 1) {
            return { 'Location Name': [permittedLocations[0]['Location Name']] };
        }
        if (permittedLocations.length > 1) {
            return { 'Location Name': ['All Locations'] };
        }
        return { 'Location Name': [] };
    }, [permittedLocations]);
    const [filters, setFilters] = useState(initialFilterState);
    useEffect(() => {
        setFilters(initialFilterState);
    }, [initialFilterState]);
    const hasAccess = reportPerms?.view && permittedLocations.length > 0;
    useEffect(() => {
        if (reportsError) {
            setSnackbar({ open: true, message: `Problem retrieving reports: ${reportsError.message}`, severity: 'error', duration: 6000 });
        }
    }, [reportsError]);
    const squareIdToAirtableIdMap = useMemo(() => {
        if (!locations) return new Map();
        const map = new Map();
        locations.forEach(loc => {
            if (loc['Square Location ID']) map.set(loc['Square Location ID'], loc['Location ID']);
            if (loc['Surreal Creamery Square Location ID']) map.set(loc['Surreal Creamery Square Location ID'], loc['Location ID']);
        });
        return map;
    }, [locations]);
    const airtableIdToLocationDetailsMap = useMemo(() => {
        if (!locations) return new Map();
        return new Map(locations.map(loc => [loc['Location ID'], loc]));
    }, [locations]);
    const permissionFilteredReports = useMemo(() => {
        if (!rawReportsData || !reportPerms || !locations) return [];
        const permittedAirtableIdsSet = new Set(permittedLocations.map(loc => loc['Location ID']));
        return rawReportsData.filter(report => {
            const reportSquareId = report['Surreal Creamery Square Location ID'] || report['Square Location ID'];
            if (!reportSquareId) return false;
            const masterAirtableId = squareIdToAirtableIdMap.get(reportSquareId.trim());
            return permittedAirtableIdsSet.has(masterAirtableId);
        });
    }, [rawReportsData, reportPerms, locations, permittedLocations, squareIdToAirtableIdMap]);
    const tableData = useMemo(() => {
        if (!permissionFilteredReports || !locations) return [];
        const selectedLocationNames = filters['Location Name'] || [];
        const isAllSelected = selectedLocationNames.includes('All Locations');
        const relevantReports = isAllSelected
            ? permissionFilteredReports
            : permissionFilteredReports.filter(report => {
                const reportSquareId = report['Surreal Creamery Square Location ID'] || report['Square Location ID'];
                const masterAirtableId = squareIdToAirtableIdMap.get(reportSquareId?.trim());
                const locationDetails = airtableIdToLocationDetailsMap.get(masterAirtableId);
                return selectedLocationNames.includes(locationDetails?.['Location Name']);
            });
        const reportsMap = new Map();
        relevantReports.forEach(report => {
            if (report && report.Date) {
                const dateKey = format(parseISO(report.Date), 'yyyy-MM-dd');
                if (!reportsMap.has(dateKey)) {
                    reportsMap.set(dateKey, { contributingReports: [], Labor: 0, Retail: 0, 'Surreal Creamery DoorDash': 0, 'Surreal Creamery UberEats': 0, 'Surreal Creamery GrubHub': 0, 'Breaking Batter DoorDash': 0, 'Breaking Batter UberEats': 0 });
                }
                const entry = reportsMap.get(dateKey);
                entry.contributingReports.push(report);
                entry.Labor += (report.Labor || 0);
                entry.Retail += report.Retail || 0;
                entry['Surreal Creamery DoorDash'] += report['Surreal Creamery DoorDash'] || 0;
                entry['Surreal Creamery UberEats'] += report['Surreal Creamery UberEats'] || 0;
                entry['Surreal Creamery GrubHub'] += report['Surreal Creamery GrubHub'] || 0;
                entry['Breaking Batter DoorDash'] += report['Breaking Batter DoorDash'] || 0;
                entry['Breaking Batter UberEats'] += report['Breaking Batter UberEats'] || 0;
            }
        });
        const datesToDisplay = eachDayOfInterval({ start: dateRange.start, end: dateRange.end }).reverse();
        const today = startOfDay(new Date());
        const dailyRows = datesToDisplay.map(date => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const aggregatedReport = reportsMap.get(dateKey);
            const isFuture = isAfter(date, today);
            let locationName = isAllSelected
                ? (permittedLocations.length > 1 ? 'All Permitted Locations' : permittedLocations[0]?.['Location Name'] || 'All Locations')
                : (selectedLocationNames.length > 1 ? 'Multiple Locations' : selectedLocationNames[0]);
            if (aggregatedReport) {
                const netSales = aggregatedReport.Retail + (aggregatedReport['Surreal Creamery DoorDash'] || 0) + (aggregatedReport['Surreal Creamery UberEats'] || 0) + (aggregatedReport['Surreal Creamery GrubHub'] || 0) + (aggregatedReport['Breaking Batter DoorDash'] || 0) + (aggregatedReport['Breaking Batter UberEats'] || 0);
                const uniqueAirtableIds = new Set(aggregatedReport.contributingReports.map(r => squareIdToAirtableIdMap.get(r['Surreal Creamery Square Location ID'] || r['Square Location ID'])));
                const dailyOverhead = Array.from(uniqueAirtableIds).reduce((sum, id) => sum + (airtableIdToLocationDetailsMap.get(id)?.Overhead || 0), 0);
                const laborCost = aggregatedReport.Labor * 1.1135;
                const cogs = netSales * 0.30;
                const profitLoss = netSales - laborCost - cogs - dailyOverhead;
                const breakeven = (laborCost + dailyOverhead) > 0 ? (laborCost + dailyOverhead) / 0.70 : 0;
                let laborDetails = (!isAllSelected && selectedLocationNames.length === 1 && aggregatedReport.contributingReports.length === 1) ? aggregatedReport.contributingReports[0]['Labor Details'] || null : null;
                return { id: dateKey, Date: date.toISOString(), 'Location Name': locationName, ...aggregatedReport, netSales, cogs, profitLoss, breakeven, overhead: dailyOverhead, Labor: laborCost, 'Labor Details': laborDetails, laborPercentage: (netSales > 0 && laborCost > 0) ? (laborCost / netSales) * 100 : null, isFuture };
            } else {
                 let dailyOverhead = null;
                 if (!isFuture) {
                     dailyOverhead = isAllSelected 
                        ? permittedLocations.reduce((sum, loc) => sum + (loc.Overhead || 0), 0)
                        : permittedLocations.filter(loc => selectedLocationNames.includes(loc['Location Name'])).reduce((sum, loc) => sum + (loc.Overhead || 0), 0);
                 }
                return { id: dateKey, Date: date.toISOString(), 'Location Name': locationName, Labor: null, Retail: null, netSales: null, cogs: null, profitLoss: isFuture || dailyOverhead === 0 ? null : -dailyOverhead, overhead: isFuture ? null : dailyOverhead, breakeven: isFuture || dailyOverhead === null || dailyOverhead === 0 ? null : dailyOverhead / 0.70, laborPercentage: null, isFuture, 'Labor Details': null };
            }
        });
        const monthlyTotals = {};
        dailyRows.forEach(row => {
            if (row.isSummary || row.isFuture || row.netSales === null) return;
            const month = format(parseISO(row.Date), 'yyyy-MM');
            if (!monthlyTotals[month]) {
                monthlyTotals[month] = { Labor: 0, netSales: 0, cogs: 0, overhead: 0, profitLoss: 0, breakeven: 0, Retail: 0, 'Surreal Creamery DoorDash': 0, 'Surreal Creamery UberEats': 0, 'Surreal Creamery GrubHub': 0, 'Breaking Batter DoorDash': 0, 'Breaking Batter UberEats': 0 };
            }
            Object.keys(monthlyTotals[month]).forEach(key => { if (typeof row[key] === 'number') monthlyTotals[month][key] += row[key]; });
        });
        const dataWithTotals = [];
        const processedMonths = new Set();
        dailyRows.forEach(row => {
            const month = format(parseISO(row.Date), 'yyyy-MM');
            if (!processedMonths.has(month) && !row.isFuture && monthlyTotals[month]) {
                const totals = monthlyTotals[month];
                dataWithTotals.push({ isSummary: true, id: `summary-${month}`, Date: `${format(parseISO(row.Date), 'MMMM yyyy')} Totals`, 'Location Name': row['Location Name'], ...totals, laborPercentage: (totals.netSales > 0 && totals.Labor > 0) ? (totals.Labor / totals.netSales) * 100 : null, });
                processedMonths.add(month);
            }
            dataWithTotals.push(row);
        });
        return dataWithTotals;
    }, [dateRange, filters, locations, permissionFilteredReports, airtableIdToLocationDetailsMap, permittedLocations, squareIdToAirtableIdMap]);

    const handleLoadMore = useCallback(() => setDateRange(prev => ({ ...prev, start: subDays(prev.start, DAYS_PER_PAGE) })), []);
    
    const handleOpenUploadModal = useCallback(() => {
        setIsFileListerOpen(true);
    }, []);

    const handleCloseUploadModal = useCallback(() => {
        setIsFileListerOpen(false);
    }, []);

    const handleSnackbarClose = useCallback((_, reason) => { if (reason === 'clickaway') return; setSnackbar(prev => ({ ...prev, open: false })); }, []);
    
    const handleFilterChange = useCallback((key, value) => {
        if (key === 'Location Name') {
            const currentSelection = filters[key] || [];
            const isChecking = value.length > currentSelection.length;
            const changedItem = isChecking ? value.find(item => !currentSelection.includes(item)) : currentSelection.find(item => !value.includes(item));
            let newSelection;
            if (changedItem === 'All Locations' || (!isChecking && value.filter(v => v !== 'All Locations').length === 0)) {
                newSelection = ['All Locations'];
            } else {
                newSelection = value.filter(item => item !== 'All Locations');
            }
            setFilters(prev => ({ ...prev, [key]: newSelection }));
        } else {
            setFilters(prev => ({ ...prev, [key]: value }));
        }
    }, [filters]);

    const handleOpenUpdateDialog = useCallback((selectedIds) => {
        const validIds = selectedIds.filter(id => { const row = tableData.find(r => r.id === id); return row && !row.isSummary && !row.isFuture; });
        if (validIds.length === 0) {
            setSnackbar({ open: true, message: 'Please select past dates to update.', severity: 'warning', duration: 4000 });
            return;
        }
        setRowsToUpdate(validIds);
        setUpdateDialogOpen(true);
    }, [tableData]);

    const handleCloseUpdateDialog = () => {
        setUpdateDialogOpen(false);
        setRowsToUpdate([]);
    };

    const handleRetrieveNetSales = async () => {
        const selectedDates = rowsToUpdate.map(id => tableData.find(row => row.id === id)?.Date).filter(Boolean).map(date => format(parseISO(date), 'yyyy-MM-dd'));
        handleCloseUpdateDialog();
        if (selectedDates.length === 0) return;
        try {
            setSnackbar({ open: true, message: (<Box sx={{ display: 'flex', alignItems: 'center' }}><CircularProgress size={20} sx={{ mr: 2 }} />Retrieving Retail Sales Data...</Box>), severity: 'info', duration: null });
            await retrieveNetSalesMutation.mutateAsync({ dates: selectedDates });
            setSnackbar({ open: true, message: (<Box sx={{ display: 'flex', alignItems: 'center' }}><CircularProgress size={20} sx={{ mr: 2 }} />Updating the Resultset...</Box>), severity: 'info', duration: null });
            await refetch();
            setSnackbar({ open: true, message: 'Resultset Updated Successfully!', severity: 'success', duration: 4000 });
            setTableKey(prev => prev + 1);
        } catch (error) {
            setSnackbar({ open: true, message: `Problem updating reports: ${error.message}`, severity: 'error', duration: 6000 });
        }
    };

    const handleRetrieveLabor = async () => {
        const selectedDates = rowsToUpdate.map(id => tableData.find(row => row.id === id)?.Date).filter(Boolean).map(date => format(parseISO(date), 'yyyy-MM-dd'));
        handleCloseUpdateDialog();
        if (selectedDates.length === 0) return;
        try {
            setSnackbar({ open: true, message: (<Box sx={{ display: 'flex', alignItems: 'center' }}><CircularProgress size={20} sx={{ mr: 2 }} />Retrieving Labor Data...</Box>), severity: 'info', duration: null });
            await retrieveLaborMutation.mutateAsync({ dates: selectedDates });
            setSnackbar({ open: true, message: (<Box sx={{ display: 'flex', alignItems: 'center' }}><CircularProgress size={20} sx={{ mr: 2 }} />Updating the Resultset...</Box>), severity: 'info', duration: null });
            await refetch();
            setSnackbar({ open: true, message: 'Labor Data Updated Successfully!', severity: 'success', duration: 4000 });
            setTableKey(prev => prev + 1);
        } catch (error) {
            setSnackbar({ open: true, message: `Problem updating labor data: ${error.message}`, severity: 'error', duration: 6000 });
        }
    };

    const handleRowClick = async (row) => {
        if (row.isSummary) return;
        setDetailModalOpen(true);
        setIsOrdersLoading(true);
        setSelectedReport(null);
        setOrdersData(null);
        try {
            const selectedLocationNames = filters['Location Name'] || [];
            if (selectedLocationNames.length !== 1 || selectedLocationNames.includes('All Locations')) {
                setSelectedReport({ ...row, isError: true, errorMessage: "Hourly data is only available for a single selected location." });
                return;
            }
            const location = locations.find(loc => loc['Location Name'] === selectedLocationNames[0]);
            if (!location) throw new Error("Could not find location details.");
            const targetDate = parseISO(row.Date);
            const rawReportForDay = permissionFilteredReports.find(r => {
                if (format(parseISO(r.Date), 'yyyy-MM-dd') !== format(targetDate, 'yyyy-MM-dd')) return false;
                const reportSquareId = r['Surreal Creamery Square Location ID'] || r['Square Location ID'];
                return reportSquareId === location['Square Location ID'] || reportSquareId === location['Surreal Creamery Square Location ID'];
            });
            const squareIdForRequest = rawReportForDay ? (rawReportForDay['Surreal Creamery Square Location ID'] || rawReportForDay['Square Location ID']) : location['Square Location ID'];
            if (!squareIdForRequest) throw new Error(`Could not determine a valid Square ID for "${location['Location Name']}" to fetch data.`);
            const targetDayOfWeek = getDay(targetDate);
            const historicalAnchorDate = setDay(subYears(targetDate, 1), targetDayOfWeek);
            const historicalPastIds = Array.from({ length: 4 }).map((_, i) => `${format(subWeeks(historicalAnchorDate, i), 'yyyy-MM-dd')}_${squareIdForRequest}`);
            const historicalForwardIds = Array.from({ length: 4 }).map((_, i) => `${format(addWeeks(historicalAnchorDate, i + 1), 'yyyy-MM-dd')}_${squareIdForRequest}`);
            const recentMatchingDays = tableData.filter(r => !r.isSummary && !r.isFuture && getDay(parseISO(r.Date)) === targetDayOfWeek).slice(0, 4);
            const recentWeekDayIds = recentMatchingDays.map(r => `${format(parseISO(r.Date), 'yyyy-MM-dd')}_${squareIdForRequest}`);
            let allIdsToFetch = [...historicalPastIds, ...historicalForwardIds, ...recentWeekDayIds];
            let currentDayId = null;
            if (!row.isFuture) {
                currentDayId = `${format(targetDate, 'yyyy-MM-dd')}_${squareIdForRequest}`;
                allIdsToFetch.unshift(currentDayId);
            }
            const results = await retrieveOrdersMutation.mutateAsync({ uniqueIds: [...new Set(allIdsToFetch)] });
            const freshDataForDay = results.find(res => res && res['Unique ID'] === currentDayId) || {};
            const combinedData = { ...row, ...freshDataForDay, ...(rawReportForDay || {}) };
            const finalReportData = { ...row, ...combinedData };
            setOrdersData({
                current: freshDataForDay,
                historical: results.filter(res => res && historicalPastIds.includes(res['Unique ID'])),
                historicalForward: results.filter(res => res && historicalForwardIds.includes(res['Unique ID'])),
                recent: results.filter(res => res && recentWeekDayIds.includes(res['Unique ID'])),
            });
            setSelectedReport(finalReportData);
        } catch (err) {
            console.error("Error in handleRowClick:", err);
            setSelectedReport({ ...row, isError: true, errorMessage: `Failed to fetch hourly data: ${err.message}` });
        } finally {
            setIsOrdersLoading(false);
        }
    };

    const handleCloseDetailModal = useCallback(() => {
        setDetailModalOpen(false);
        setSelectedReport(null);
        setOrdersData(null);
    }, []);

    const handleProcessFile = useCallback((googleFile) => {
        handleCloseUploadModal(); // Close the modal after a file is picked
        if (!googleFile || !googleFile.id) return;
        setSnackbar({ open: true, message: `Processing file: ${googleFile.name}...`, severity: 'info', duration: null });
        triageMutation.mutate({ googleFileId: googleFile.id }, {
            onSuccess: () => {
                setSnackbar({ open: true, message: 'File processed successfully! Data is refreshing.', severity: 'success' });
                refetch();
            },
            onError: (error) => {
                setSnackbar({ open: true, message: `Processing failed: ${error.message}`, severity: 'error' });
            },
        });
    }, [triageMutation, refetch, handleCloseUploadModal]);

    if (isLoadingReports || isLoadingTeamMembers || isLoadingLocations) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
    }

    if (!selectedReportName) {
        return <ReportSelectionList onSelectReport={setSelectedReportName} />;
    }

    const goBack = () => setSelectedReportName(null);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
            {selectedReportName === 'Daily Profit and Loss' && (
                hasAccess ? (
                    <DailyPnLReport
                        tableData={tableData}
                        permittedLocations={permittedLocations}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onRowClick={handleRowClick}
                        onRefresh={refetch}
                        onScrollEnd={handleLoadMore}
                        onGoBack={goBack}
                        onOpenUploadModal={handleOpenUploadModal}
                        onOpenUpdateDialog={handleOpenUpdateDialog}
                        permissions={reportPerms}
                        tableKey={tableKey}
                    />
                ) : (
                    <Box sx={{ p: 4, textAlign: 'center', mt: 4 }}>
                        <Typography variant="h6">Access Denied</Typography>
                        <Typography>You do not have permission to view any reports.</Typography>
                    </Box>
                )
            )}
            {selectedReportName === 'Historical Sales Report' && (
                 hasAccess ? (
                    <HistoricalSalesReport
                        allReports={permissionFilteredReports}
                        onGoBack={goBack}
                    />
                 ) : (
                    <Box sx={{ p: 4, textAlign: 'center', mt: 4 }}>
                        <Typography variant="h6">Access Denied</Typography>
                        <Typography>You do not have permission to view any reports.</Typography>
                    </Box>
                 )
            )}
            <Dialog open={isUpdateDialogOpen} onClose={handleCloseUpdateDialog} fullWidth maxWidth="xs">
                <DialogTitle>Update Rows</DialogTitle>
                <DialogContent>
                    <Typography gutterBottom>You have selected {rowsToUpdate.length} report(s). Choose an action to perform.</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                        <Button variant="outlined" onClick={handleRetrieveNetSales}>Retrieve Retail Net Sales</Button>
                        <Button variant="outlined" onClick={handleRetrieveLabor}>Retrieve Labor</Button>
                    </Box>
                </DialogContent>
                <DialogActions><Button onClick={handleCloseUpdateDialog}>Cancel</Button></DialogActions>
            </Dialog>
            <Snackbar open={snackbar.open} autoHideDuration={snackbar.duration} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }} icon={typeof snackbar.message === 'object' ? false : undefined}>{snackbar.message}</Alert>
            </Snackbar>
            <ReportDetailModal
                open={isDetailModalOpen}
                onClose={handleCloseDetailModal}
                report={selectedReport}
                ordersData={ordersData}
                isLoadingOrders={isOrdersLoading}
                tableData={tableData}
                teamMembers={teamMembers}
                lastYearData={MOCK_SALES_LAST_YEAR}
            />
            <GoogleDriveFileListerModal
                open={isFileListerOpen}
                onClose={handleCloseUploadModal}
                onProcessFile={handleProcessFile}
                setSnackbar={setSnackbar}
            />
        </Box>
    );
}