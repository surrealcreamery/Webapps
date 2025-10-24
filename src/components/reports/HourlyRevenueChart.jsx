import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Tooltip } from '@mui/material';
import { BarChart } from '@mui/x-charts';
import { getHours, parseISO } from 'date-fns';

// --- HELPER FUNCTIONS ---

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '—';
    return currencyFormatter.format(value);
};

const compactCurrencyFormatter = (value) => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
    }).format(value);
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

const HourlyRevenueChart = ({ ordersData, revenueSources, aggregateSources }) => {
    const { seriesData, xAxisData, yAxisMax } = useMemo(() => {
        if (!ordersData || Object.keys(ordersData).length === 0) return {};

        const aggregatedMapping = {
            'Retail Orders': 'Retail',
            'Surreal Creamery DoorDash Orders': 'DoorDash',
            'Breaking Batter DoorDash Orders': 'DoorDash',
            'Surreal Creamery Uber Eats Orders': 'UberEats',
            'Breaking Batter UberEats Orders': 'UberEats', // This line is now fixed
            'Surreal Creamery GrubHub Orders': 'GrubHub'
        };
        const detailedMapping = {
            'Retail Orders': 'Retail',
            'Surreal Creamery DoorDash Orders': 'SC DoorDash',
            'Breaking Batter DoorDash Orders': 'BB DoorDash',
            'Surreal Creamery Uber Eats Orders': 'SC UberEats',
            'Breaking Batter UberEats Orders': 'BB UberEats', // This line is now fixed
            'Surreal Creamery GrubHub Orders': 'SC GrubHub'
        };

        const sourceMapping = aggregateSources ? aggregatedMapping : detailedMapping;
        const hourlyTotals = {};

        // Initialize hourly totals for all possible revenue sources
        [...new Set(Object.values(sourceMapping))].forEach(key => {
            hourlyTotals[key] = Array(24).fill(0);
        });

        for (const apiKey in ordersData) {
            const simpleKey = sourceMapping[apiKey];
            const data = ordersData[apiKey];
            if (simpleKey && data && hourlyTotals[simpleKey]) {
                const items = safeParseJson(data);
                const orders = Array.isArray(items) ? items : Object.values(items);
                orders.forEach(order => {
                    if (order && order.Time && order['Net Total'] !== undefined) {
                        const hour = getHourFromTimeString(order.Time);
                        if (hour !== null && hour >= 0 && hour < 24) {
                            hourlyTotals[simpleKey][hour] += order['Net Total'] || 0;
                        }
                    }
                });
            }
        }

        const combinedHourlyTotals = Array(24).fill(0).map((_, hour) =>
            Object.values(hourlyTotals).reduce((sum, totals) => sum + (totals[hour] || 0), 0)
        );

        const maxTotalPerHour = Math.max(...combinedHourlyTotals);
        if (maxTotalPerHour === 0) return {};

        const series = revenueSources
            .map(source => ({
                data: hourlyTotals[source.label] || Array(24).fill(0),
                label: source.label,
                stack: 'A',
                color: source.color
            }))
            .filter(series => series.data.some(d => d > 0));

        const axisData = Array.from({ length: 24 }, (_, i) => i);
        const visibleTicks = [0, 3, 6, 9, 12, 15, 18, 21];

        return {
            seriesData: series,
            xAxisData: [{
                data: axisData,
                scaleType: 'band',
                tickValues: visibleTicks,
                valueFormatter: (hour) => `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? 'PM' : 'AM'}`,
                tickLabelStyle: { angle: 0, textAnchor: 'middle', fontSize: 10 },
                disableAxisListener: true
            }],
            yAxisMax: Math.ceil(maxTotalPerHour / 50) * 50
        };
    }, [ordersData, revenueSources, aggregateSources]);

    const [tooltipData, setTooltipData] = useState(null);

    const handleTooltipEnter = (event, data) => {
        const totalForHour = seriesData.reduce((sum, series) => sum + series.data[data.dataIndex], 0);
        if (totalForHour > 0) {
            const content = (
                <div>
                    <Typography variant="caption" display="block" sx={{ fontWeight: 'bold' }}>
                        {xAxisData[0].valueFormatter(data.dataIndex)}
                    </Typography>
                    <Typography variant="caption" display="block">
                        Total: {formatCurrency(totalForHour)}
                    </Typography>
                </div>
            );
            setTooltipData({ top: event.clientY, left: event.clientX, content });
        }
    };
    const handleTooltipLeave = () => setTooltipData(null);

    if (!seriesData || seriesData.length === 0) {
        return <Typography sx={{ textAlign: 'center', my: 4 }}>No hourly sales data available for this date.</Typography>;
    }

    return (
        <Tooltip
            open={!!tooltipData}
            title={tooltipData?.content || ''}
            arrow
            PopperProps={{
                anchorEl: {
                    getBoundingClientRect: () => ({
                        top: tooltipData?.top || 0,
                        left: tooltipData?.left || 0,
                        right: tooltipData?.left || 0,
                        bottom: tooltipData?.top || 0,
                        width: 0,
                        height: 0,
                    }),
                },
            }}
        >
            <Box sx={{ my: 4 }} onContextMenu={(e) => e.preventDefault()}>
                <Typography variant="h6" gutterBottom>Revenue by Hour (Eastern Time)</Typography>
                <BarChart
                    xAxis={xAxisData}
                    series={seriesData.map(s => ({ ...s, valueFormatter: (value) => value > 10 ? compactCurrencyFormatter(value) : null }))}
                    height={300}
                    yAxis={[{ max: yAxisMax, tickNumber: Math.ceil(yAxisMax / 50), disableAxisListener: true }]}
                    margin={{ top: 30, right: 20, bottom: 70, left: 60 }}
                    slotProps={{ legend: { direction: 'horizontal', position: { vertical: 'bottom', horizontal: 'center' }, padding: -5 } }}
                    tooltip={{ trigger: 'none' }}
                    onItemEnter={handleTooltipEnter}
                    onItemLeave={handleTooltipLeave}
                />
            </Box>
        </Tooltip>
    );
};

HourlyRevenueChart.propTypes = {
    ordersData: PropTypes.object,
    revenueSources: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string.isRequired,
        color: PropTypes.string.isRequired,
    })).isRequired,
    aggregateSources: PropTypes.bool,
};

export default HourlyRevenueChart;