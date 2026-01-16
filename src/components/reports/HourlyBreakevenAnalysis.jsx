import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from '@mui/material';
import { Chart, useChart } from '@/components/chart';
import {
    getHours,
    parseISO,
    differenceInMinutes,
    eachHourOfInterval,
    areIntervalsOverlapping,
    isAfter,
    addHours,
    format
} from 'date-fns';

// --- HELPER FUNCTIONS ---
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '—';
    return currencyFormatter.format(value);
};

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

const getHourFromTimeString = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    if (timeStr.includes('T') && timeStr.includes('Z')) { try { return getHours(parseISO(timeStr)); } catch (e) { return null; } }
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
        const [time, modifier] = timeStr.split(' ');
        let [hours] = time.split(':').map(Number);
        if (modifier?.toUpperCase() === 'PM' && hours !== 12) hours += 12;
        if (modifier?.toUpperCase() === 'AM' && hours === 12) hours = 0;
        return hours;
    }
    if (timeStr.includes(':')) { const [hours] = timeStr.split(':').map(Number); return hours; }
    return null;
};

// --- MAIN COMPONENT ---
const HourlyBreakevenAnalysis = ({ report, laborDetails, ordersData }) => {
    const analysisResult = useMemo(() => {
        const missingDataMessages = [];
        if (!laborDetails || laborDetails.length === 0) {
            missingDataMessages.push('Detailed Labor Data (employee clock-ins/outs)');
        }

        let hasSalesData = false;
        if (ordersData) {
            for (const apiKey in ordersData) {
                if (apiKey === 'Unique ID') continue;
                const items = safeParseJson(ordersData[apiKey]);
                const orders = Array.isArray(items) ? items : Object.values(items || {});
                if (orders.length > 0) {
                    hasSalesData = true;
                    break;
                }
            }
        }
        if (!hasSalesData) {
            missingDataMessages.push('Hourly Sales Data');
        }

        if (missingDataMessages.length > 0) {
            return {
                success: false,
                message: `The following data is required for this analysis: ${missingDataMessages.join(' and ')}.`,
            };
        }

        try {
            const dailyOverhead = report?.overhead || 0;
            const salesByHour = Array(24).fill(0);
            for (const apiKey in ordersData) {
                const items = safeParseJson(ordersData[apiKey]);
                const orders = Array.isArray(items) ? items : Object.values(items || {});
                orders.forEach(order => {
                    if (order && order.Time && order['Net Total'] !== undefined) {
                        const hour = getHourFromTimeString(order.Time);
                        if (hour !== null && hour >= 0 && hour < 24) {
                            salesByHour[hour] += order['Net Total'] || 0;
                        }
                    }
                });
            }

            const shifts = laborDetails
                .map(d => {
                    try {
                        const start = parseISO(d['Start At']);
                        const end = parseISO(d['End At']);
                        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                            console.warn("Skipping shift with invalid date:", d);
                            return null;
                        }
                        return { start, end, rate: d['Hourly Rate'] || 0 };
                    } catch (error) {
                        console.warn("Skipping shift due to parsing error:", d, error);
                        return null;
                    }
                })
                .filter(Boolean);

            if (shifts.length === 0) {
                return { success: false, message: 'Valid shift data with proper start and end times could not be found in the labor details for this day.' };
            }

            const firstClockIn = new Date(Math.min(...shifts.map(s => s.start)));
            const lastClockOut = new Date(Math.max(...shifts.map(s => s.end)));
            const totalMinutes = differenceInMinutes(lastClockOut, firstClockIn);

            if (totalMinutes <= 0) return { success: false, message: 'The recorded shift times are invalid or total zero minutes.' };

            const totalHours = totalMinutes / 60;
            const hourlyOverhead = dailyOverhead > 0 ? dailyOverhead / totalHours : 0;
            const workingHours = eachHourOfInterval({ start: firstClockIn, end: lastClockOut });

            let cumulativeSales = 0;
            let cumulativeBreakevenSales = 0;

            const data = workingHours.map(hourStart => {
                const hourEnd = addHours(hourStart, 1);
                const currentHourInterval = { start: hourStart, end: hourEnd };

                const laborCostRaw = shifts
                    .filter(shift => areIntervalsOverlapping(currentHourInterval, shift))
                    .reduce((totalCost, shift) => {
                        const overlapStart = isAfter(shift.start, currentHourInterval.start) ? shift.start : currentHourInterval.start;
                        const overlapEnd = isAfter(currentHourInterval.end, shift.end) ? shift.end : currentHourInterval.end;
                        const minutesInHour = differenceInMinutes(overlapEnd, overlapStart);
                        if (minutesInHour > 0) {
                            return totalCost + ((shift.rate / 60) * minutesInHour);
                        }
                        return totalCost;
                    }, 0);

                const laborCost = laborCostRaw * 1.12;
                const totalHourlyCost = laborCost + hourlyOverhead;
                const hourlyBreakevenSales = totalHourlyCost / 0.70;

                const hour = getHours(hourStart);
                const sales = salesByHour[hour] || 0;
                cumulativeSales += sales;
                cumulativeBreakevenSales += hourlyBreakevenSales;

                return { hour: format(hourStart, 'p'), laborCost, hourlyOverhead, cumulativeBreakevenSales, sales, cumulativeSales };
            });

            return { success: true, data };
        } catch (e) {
            console.error("Failed to calculate hourly breakeven:", e);
            return { success: false, message: 'An unexpected error occurred during the analysis.' };
        }
    }, [report, laborDetails, ordersData]);

    if (!analysisResult.success) {
        return (
            <Box sx={{ my: 4 }}>
                <Typography variant="h6" gutterBottom>Hourly Breakeven Analysis</Typography>
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', backgroundColor: 'action.hover' }}>
                    <Typography variant="body1" color="text.secondary">Analysis Not Available</Typography>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                        {analysisResult.message}
                    </Typography>
                </Paper>
            </Box>
        );
    }

    const { data: hourlyData } = analysisResult;

    const series = [
        {
            name: 'Cumulative Sales',
            type: 'area',
            data: hourlyData.map(d => d.cumulativeSales),
        },
        {
            name: 'Breakeven Point',
            type: 'line',
            data: hourlyData.map(d => d.cumulativeBreakevenSales),
        },
    ];

    const categories = hourlyData.map(d => d.hour);
    const yAxisMax = Math.max(...hourlyData.map(d => d.cumulativeSales), ...hourlyData.map(d => d.cumulativeBreakevenSales)) * 1.1;

    const chartOptions = useChart({
        colors: ['#2e7d32', '#d32f2f'],
        fill: {
            type: ['gradient', 'solid'],
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.1,
                stops: [0, 100],
            },
        },
        stroke: {
            width: [2, 3],
            curve: 'smooth',
        },
        xaxis: {
            categories,
            labels: {
                rotate: -45,
                style: { fontSize: '10px' },
            },
        },
        yaxis: {
            min: 0,
            max: yAxisMax,
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
    });

    return (
        <Box sx={{ my: 4 }}>
            <Typography variant="h6" gutterBottom>Cumulative Sales vs. Breakeven Point</Typography>
            <Chart
                type="line"
                series={series}
                options={chartOptions}
                sx={{ height: 300 }}
            />

            <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>Hourly Breakeven Details</Typography>
            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Hour</TableCell>
                            <TableCell>Labor</TableCell>
                            <TableCell>Overhead</TableCell>
                            <TableCell>Breakeven Sales</TableCell>
                            <TableCell>Sales</TableCell>
                            <TableCell>Cumulative Sales</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {hourlyData.map((data, index) => {
                            const rowStyle = {
                                transition: 'background-color 0.3s ease',
                                backgroundColor: data.cumulativeSales > data.cumulativeBreakevenSales ? '#e8f5e9' : '#ffebee',
                            };
                            return (
                                <TableRow key={data.hour + index} sx={rowStyle}>
                                    <TableCell>{data.hour}</TableCell>
                                    <TableCell>{formatCurrency(data.laborCost)}</TableCell>
                                    <TableCell>{formatCurrency(data.hourlyOverhead)}</TableCell>
                                    <TableCell>{formatCurrency(data.cumulativeBreakevenSales)}</TableCell>
                                    <TableCell>{formatCurrency(data.sales)}</TableCell>
                                    <TableCell>{formatCurrency(data.cumulativeSales)}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

HourlyBreakevenAnalysis.propTypes = {
    report: PropTypes.object,
    laborDetails: PropTypes.array,
    ordersData: PropTypes.object,
};

export default HourlyBreakevenAnalysis;
