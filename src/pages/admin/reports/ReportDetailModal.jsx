import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
    Box, Paper, Typography, CircularProgress, Dialog, Button,
    IconButton, Switch, AppBar, Toolbar, Divider,
    ToggleButtonGroup, ToggleButton, FormControlLabel, DialogContent
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UpdateIcon from '@mui/icons-material/Update';
import { format, parseISO } from 'date-fns';

// --- Child Components for the Modal ---
import ProfitabilityChart from '@/components/reports/ProfitabilityChart';
import HourlyRevenueChart from '@/components/reports/HourlyRevenueChart';
import LaborDetailTable from '@/components/reports/LaborDetailTable';
import HourlyBreakevenAnalysis from '@/components/reports/HourlyBreakevenAnalysis';
import SalesForecastChart from '@/components/reports/SalesForecastChart';

// --- Helper Functions ---
const safeParseJson = (data) => {
    if (typeof data !== 'string') return data;
    if (data.trim() === '') return [];
    try {
        return JSON.parse(data);
    } catch (error) {
        console.error("Failed to parse JSON data:", error, "Original data:", data);
        return [];
    }
};

const ReportDetailModal = ({ open, onClose, report, ordersData, isLoadingOrders, tableData, teamMembers, lastYearData }) => {
    const [modalView, setModalView] = useState('actual');
    const [aggregateSources, setAggregateSources] = useState(true);
    const [refreshNonce, setRefreshNonce] = useState(0);

    const laborDetails = useMemo(() => {
        if (!report || !report['Labor Details']) return [];
        const parsed = safeParseJson(report['Labor Details']);
        return Array.isArray(parsed) ? parsed : Object.values(parsed || {});
    }, [report]);

    const handleRefresh = () => setRefreshNonce(prev => prev + 1);

    const revenueSources = useMemo(() => {
        if (!report) return [];
        const { Retail = 0, 'Surreal Creamery DoorDash': scdd = 0, 'Surreal Creamery UberEats': scue = 0, 'Surreal Creamery GrubHub': scgh = 0, 'Breaking Batter DoorDash': bbdd = 0, 'Breaking Batter UberEats': bbue = 0 } = report;
        const sources = (aggregateSources ?
            [
                { label: 'Retail', value: Retail, color: '#64b5f6' },
                { label: 'DoorDash', value: scdd + bbdd, color: '#ffb74d' },
                { label: 'UberEats', value: scue + bbue, color: '#ba68c8' },
                { label: 'GrubHub', value: scgh, color: '#4db6ac' },
            ] : [
                { label: 'Retail', value: Retail, color: '#64b5f6' },
                { label: 'SC DoorDash', value: scdd, color: '#ffb74d' },
                { label: 'SC UberEats', value: scue, color: '#ba68c8' },
                { label: 'SC GrubHub', value: scgh, color: '#4db6ac' },
                { label: 'BB DoorDash', value: bbdd, color: '#ffd54f' },
                { label: 'BB UberEats', value: bbue, color: '#e57373' },
            ]);
        if (report.isFuture) return sources;
        return sources.filter(s => s.value > 0);
    }, [report, aggregateSources]);

    useEffect(() => {
        if (open) {
            setModalView('actual');
            setRefreshNonce(0);
        }
    }, [open]);

    // Shows a loading spinner while the async operation in the parent runs
    if (isLoadingOrders || !report) {
        return (
            <Dialog fullScreen open={open} onClose={onClose}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2 }}>Loading Report Details...</Typography>
                </Box>
            </Dialog>
        );
    }

    const isFutureReport = report.isFuture;
    const showForecast = isFutureReport || modalView === 'projected';

    return (
        <Dialog fullScreen open={open} onClose={onClose} PaperProps={{ sx: { display: 'flex', flexDirection: 'column', height: '100vh' } }}>
            <AppBar position="static" sx={{ bgcolor: 'background.paper', color: 'text.primary', flexShrink: 0 }} elevation={1}>
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close"><CloseIcon /></IconButton>
                    <Typography variant="h6" sx={{ ml: 2, flex: 1 }}>{showForecast ? 'Sales Forecast' : 'Sales Details'} for {report.isSummary ? report.Date : format(parseISO(report.Date), 'EEEE, MMMM do yyyy')}</Typography>
                    {showForecast && (<Button color="inherit" startIcon={<UpdateIcon />} onClick={handleRefresh}> Refresh Forecast </Button>)}
                </Toolbar>
            </AppBar>
            <DialogContent sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
                <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%' }}>
                    {report.isError ? (<Typography color="error">{report.errorMessage}</Typography>) : isFutureReport ? (
                        <SalesForecastChart targetDateString={report.Date} reportData={tableData} lastYearData={lastYearData} refreshNonce={refreshNonce} ordersData={ordersData} revenueSources={revenueSources} isLoadingOrders={isLoadingOrders} />
                    ) : (
                        <>
                            <ToggleButtonGroup color="primary" value={modalView} exclusive fullWidth onChange={(e, newValue) => { if (newValue) setModalView(newValue); }} sx={{ mb: 2 }}>
                                <ToggleButton value="actual">Actuals</ToggleButton>
                                <ToggleButton value="projected">Projected</ToggleButton>
                            </ToggleButtonGroup>
                            {modalView === 'actual' && (
                                <>
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <FormControlLabel control={<Switch checked={aggregateSources} onChange={(e) => setAggregateSources(e.target.checked)} />} label="Show Aggregated Sources" />
                                    </Box>
                                    <ProfitabilityChart report={report} revenueSources={revenueSources} />
                                    <Divider sx={{ my: 2 }} />
                                    <HourlyRevenueChart ordersData={ordersData?.current} revenueSources={revenueSources} aggregateSources={aggregateSources} />
                                    <LaborDetailTable laborDetails={laborDetails} teamMembers={teamMembers} />
                                    <HourlyBreakevenAnalysis
                                        report={report}
                                        laborDetails={laborDetails}
                                        ordersData={ordersData?.current}
                                    />
                                </>
                            )}
                            {modalView === 'projected' && (
                                <SalesForecastChart targetDateString={report.Date} reportData={tableData} lastYearData={lastYearData} actualSales={report.netSales} refreshNonce={refreshNonce} ordersData={ordersData} revenueSources={revenueSources} isLoadingOrders={isLoadingOrders} />
                            )}
                        </>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );
};

ReportDetailModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    report: PropTypes.object,
    ordersData: PropTypes.object,
    isLoadingOrders: PropTypes.bool.isRequired,
    tableData: PropTypes.array.isRequired,
    teamMembers: PropTypes.array,
    lastYearData: PropTypes.array.isRequired,
};

export default ReportDetailModal;