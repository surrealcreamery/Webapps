import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Typography,
    Paper,
    CircularProgress,
    ToggleButtonGroup,
    ToggleButton,
    Breadcrumbs,
    Link,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    MenuItem,
    Checkbox,
    ListItemText
} from '@mui/material';
import { Chart, useChart } from '@/components/chart';
import {
    format,
    parseISO,
    sub,
    startOfDay,
    endOfDay,
    isWithinInterval,
    startOfWeek,
    startOfMonth,
    getWeek,
    eachDayOfInterval,
    eachWeekOfInterval,
    eachMonthOfInterval
} from 'date-fns';

// --- HELPER FUNCTIONS ---
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '$0.00';
    return currencyFormatter.format(value);
};

// --- CONSTANTS ---
const REVENUE_SOURCES = [
    { key: 'Retail', color: '#1976d2' },
    { key: 'Surreal Creamery DoorDash', color: '#ef5350' },
    { key: 'Surreal Creamery UberEats', color: '#8e24aa' },
    { key: 'Surreal Creamery GrubHub', color: '#388e3c' },
    { key: 'Breaking Batter DoorDash', color: '#ff9800' },
    { key: 'Breaking Batter UberEats', color: '#d81b60' },
];

const HistoricalSalesReport = ({ allReports, onGoBack }) => {
    const [timeRange, setTimeRange] = useState('1Y');
    const [aggregation, setAggregation] = useState('Month');
    const [chartType, setChartType] = useState('line');
    const [displayMode, setDisplayMode] = useState('chart');
    const [selectedSources, setSelectedSources] = useState(() => REVENUE_SOURCES.map(s => s.key));
    const [sourcesSelectOpen, setSourcesSelectOpen] = useState(false);

    const processedData = useMemo(() => {
        if (!allReports || allReports.length === 0) return null;

        const today = endOfDay(new Date());
        const dateFilter = timeRange === '1Y' ? { years: 1 } : { years: 3 };
        const startDate = startOfDay(sub(today, dateFilter));
        const dateInterval = { start: startDate, end: today };

        const relevantReports = allReports.filter(report => {
            if (!report.Date) return false;
            const reportDate = parseISO(report.Date);
            return isWithinInterval(reportDate, dateInterval);
        });

        const aggregatedTotals = new Map();
        const sourceTotals = {};
        REVENUE_SOURCES.forEach(source => sourceTotals[source.key] = 0);

        const getKeyAndDate = (date) => {
            switch (aggregation) {
                case 'Day':
                    return { key: format(date, 'yyyy-MM-dd'), date: startOfDay(date) };
                case 'Week':
                    return { key: format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd'), date: startOfWeek(date, { weekStartsOn: 1 }) };
                case 'Month':
                    return { key: format(startOfMonth(date), 'yyyy-MM-dd'), date: startOfMonth(date) };
                default:
                    return { key: format(date, 'yyyy-MM-dd'), date: startOfDay(date) };
            }
        };

        let timeIntervals;
        if (aggregation === 'Day') timeIntervals = eachDayOfInterval(dateInterval);
        else if (aggregation === 'Week') timeIntervals = eachWeekOfInterval(dateInterval, { weekStartsOn: 1 });
        else timeIntervals = eachMonthOfInterval(dateInterval);

        timeIntervals.forEach(intervalDate => {
            const { key, date } = getKeyAndDate(intervalDate);
            if (!aggregatedTotals.has(key)) {
                const newEntry = { date, Total: 0 };
                REVENUE_SOURCES.forEach(source => newEntry[source.key] = 0);
                aggregatedTotals.set(key, newEntry);
            }
        });

        const processedReports = new Set();

        relevantReports.forEach(report => {
            const locationId = report['Surreal Creamery Square Location ID'] || report['Square Location ID'];
            if (!report.Date || !locationId) return;

            const uniqueReportKey = `${format(parseISO(report.Date), 'yyyy-MM-dd')}-${locationId}`;
            if (processedReports.has(uniqueReportKey)) return;
            processedReports.add(uniqueReportKey);

            const date = parseISO(report.Date);
            const { key } = getKeyAndDate(date);

            if (aggregatedTotals.has(key)) {
                const entry = aggregatedTotals.get(key);
                REVENUE_SOURCES.forEach(source => {
                    const value = report[source.key] || 0;
                    entry[source.key] += value;
                    sourceTotals[source.key] += value;
                });
            }
        });

        const filteredRevenueSources = REVENUE_SOURCES.filter(source => selectedSources.includes(source.key));
        const sortedRevenueSources = [...filteredRevenueSources].sort((a, b) => sourceTotals[b.key] - sourceTotals[a.key]);
        const sortedData = Array.from(aggregatedTotals.values()).sort((a, b) => a.date - b.date);

        const getXAxisFormatter = () => {
            switch (aggregation) {
                case 'Day':
                    return (date) => format(date, 'MMM d, yyyy');
                case 'Week':
                    return (date) => `W${getWeek(date)} '${format(date, 'yy')}`;
                case 'Month':
                    return (date) => format(date, 'MMM yyyy');
                default:
                    return (date) => format(date, 'MMM d, yyyy');
            }
        };

        const xAxisFormatter = getXAxisFormatter();
        const categories = sortedData.map(d => xAxisFormatter(d.date));

        const series = sortedRevenueSources.map(source => ({
            name: source.key,
            data: sortedData.map(d => d[source.key]),
        }));

        const colors = sortedRevenueSources.map(source => source.color);

        const tableColumns = [
            { id: 'date', label: aggregation },
            ...sortedRevenueSources.map(s => ({ id: s.key, label: s.key })),
            { id: 'total', label: 'Total' }
        ];

        const tableRows = sortedData.map(d => {
            const row = { date: xAxisFormatter(d.date) };
            let rowTotal = 0;
            sortedRevenueSources.forEach(s => {
                const value = d[s.key] || 0;
                row[s.key] = value;
                rowTotal += value;
            });
            row.total = rowTotal;
            return row;
        });

        return { series, categories, colors, tableColumns, tableRows };

    }, [allReports, timeRange, aggregation, selectedSources]);

    const chartOptions = useChart({
        colors: processedData?.colors || [],
        chart: {
            stacked: chartType === 'bar',
        },
        stroke: {
            width: chartType === 'line' ? 3 : 0,
            curve: 'smooth',
        },
        markers: {
            size: chartType === 'scatter' ? 6 : 0,
        },
        plotOptions: {
            bar: {
                columnWidth: '60%',
                borderRadius: 4,
            },
        },
        xaxis: {
            categories: processedData?.categories || [],
            labels: {
                rotate: -45,
                rotateAlways: aggregation === 'Day',
                hideOverlappingLabels: true,
                style: { fontSize: '10px' },
            },
        },
        yaxis: {
            min: 0,
            labels: {
                formatter: (value) => formatCurrency(value),
            },
        },
        tooltip: {
            y: {
                formatter: (value) => formatCurrency(value),
            },
        },
        legend: {
            show: true,
            position: 'top',
            horizontalAlign: 'center',
        },
        grid: {
            show: true,
        },
    });

    if (!processedData) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress />
                <Typography sx={{ mt: 2 }}>Processing historical data...</Typography>
            </Box>
        );
    }

    const { series, tableColumns, tableRows } = processedData;
    const apexChartType = chartType === 'scatter' ? 'line' : chartType;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0, bgcolor: 'background.paper' }}>
                <Breadcrumbs aria-label="breadcrumb">
                    <Link underline="hover" color="inherit" href="#" onClick={(e) => { e.preventDefault(); onGoBack(); }}>
                        Reports
                    </Link>
                    <Typography color="text.primary">Historical Sales Report</Typography>
                </Breadcrumbs>
            </Box>
            <Box sx={{ p: 3, flexGrow: 1, overflow: 'auto' }}>
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                        <Typography variant="h5">Sales by Source</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                            <TextField
                                select
                                label="Sources"
                                size="small"
                                value={selectedSources}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSelectedSources(typeof value === 'string' ? value.split(',') : value);
                                }}
                                SelectProps={{
                                    multiple: true,
                                    open: sourcesSelectOpen,
                                    onOpen: () => setSourcesSelectOpen(true),
                                    onClose: () => setSourcesSelectOpen(false),
                                    renderValue: (selected) => {
                                        if (selected.length === REVENUE_SOURCES.length) return 'All Sources';
                                        return `${selected.length} Sources`;
                                    },
                                    MenuProps: {
                                        disablePortal: true,
                                        disableScrollLock: true,
                                        PaperProps: {
                                            style: { maxHeight: 300 },
                                            onClick: (e) => e.stopPropagation(),
                                        },
                                    },
                                }}
                                sx={{ minWidth: 140 }}
                            >
                                {REVENUE_SOURCES.map((source) => (
                                    <MenuItem key={source.key} value={source.key}>
                                        <Checkbox checked={selectedSources.indexOf(source.key) > -1} />
                                        <ListItemText primary={source.key} />
                                    </MenuItem>
                                ))}
                            </TextField>
                            <ToggleButtonGroup size="small" value={displayMode} exclusive onChange={(e, val) => val && setDisplayMode(val)} >
                                <ToggleButton value="chart">Chart</ToggleButton>
                                <ToggleButton value="table">Table</ToggleButton>
                            </ToggleButtonGroup>
                            <Divider orientation="vertical" flexItem />
                            <ToggleButtonGroup size="small" value={aggregation} exclusive onChange={(e, val) => val && setAggregation(val)} >
                                <ToggleButton value="Day">Day</ToggleButton>
                                <ToggleButton value="Week">Week</ToggleButton>
                                <ToggleButton value="Month">Month</ToggleButton>
                            </ToggleButtonGroup>
                            <ToggleButtonGroup size="small" value={timeRange} exclusive onChange={(e, val) => val && setTimeRange(val)} >
                                <ToggleButton value="1Y">1 Year</ToggleButton>
                                <ToggleButton value="3Y">3 Years</ToggleButton>
                            </ToggleButtonGroup>
                            <ToggleButtonGroup size="small" value={chartType} exclusive onChange={(e, val) => val && setChartType(val)} disabled={displayMode === 'table'}>
                                <ToggleButton value="bar">Bar</ToggleButton>
                                <ToggleButton value="line">Line</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    </Box>
                    <Divider sx={{ my: 2 }} />

                    {displayMode === 'chart' && (
                        <Chart
                            type={apexChartType}
                            series={series}
                            options={chartOptions}
                            sx={{ height: 500 }}
                        />
                    )}

                    {displayMode === 'table' && (
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        {tableColumns.map((col) => (
                                            <TableCell key={col.id} sx={{ fontWeight: 'bold' }}>
                                                {col.label}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {tableRows.map((row, index) => (
                                        <TableRow key={index} hover>
                                            {tableColumns.map((col) => (
                                                <TableCell key={col.id}>
                                                    {col.id === 'date' ? row.date : formatCurrency(row[col.id])}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Paper>
            </Box>
        </Box>
    );
};

HistoricalSalesReport.propTypes = {
    allReports: PropTypes.array.isRequired,
    onGoBack: PropTypes.func.isRequired,
};

export default HistoricalSalesReport;
