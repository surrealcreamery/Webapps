import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { Chart, useChart } from '@/components/chart';
import { getHours, parseISO } from 'date-fns';

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

const formatHourLabel = (hour) => `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? 'PM' : 'AM'}`;

// --- MAIN COMPONENT ---
const HourlyRevenueChart = ({ ordersData, revenueSources, aggregateSources }) => {
    const { series, categories, colors, yAxisMax } = useMemo(() => {
        if (!ordersData || Object.keys(ordersData).length === 0) return {};

        const aggregatedMapping = {
            'Retail Orders': 'Retail',
            'Surreal Creamery DoorDash Orders': 'DoorDash',
            'Breaking Batter DoorDash Orders': 'DoorDash',
            'Surreal Creamery Uber Eats Orders': 'UberEats',
            'Breaking Batter UberEats Orders': 'UberEats',
            'Surreal Creamery GrubHub Orders': 'GrubHub'
        };
        const detailedMapping = {
            'Retail Orders': 'Retail',
            'Surreal Creamery DoorDash Orders': 'SC DoorDash',
            'Breaking Batter DoorDash Orders': 'BB DoorDash',
            'Surreal Creamery Uber Eats Orders': 'SC UberEats',
            'Breaking Batter UberEats Orders': 'BB UberEats',
            'Surreal Creamery GrubHub Orders': 'SC GrubHub'
        };

        const sourceMapping = aggregateSources ? aggregatedMapping : detailedMapping;
        const hourlyTotals = {};

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

        const seriesData = revenueSources
            .map(source => ({
                name: source.label,
                data: hourlyTotals[source.label] || Array(24).fill(0),
            }))
            .filter(s => s.data.some(d => d > 0));

        const colorData = revenueSources
            .filter(source => (hourlyTotals[source.label] || []).some(d => d > 0))
            .map(source => source.color);

        return {
            series: seriesData,
            categories: Array.from({ length: 24 }, (_, i) => formatHourLabel(i)),
            colors: colorData,
            yAxisMax: Math.ceil(maxTotalPerHour / 50) * 50
        };
    }, [ordersData, revenueSources, aggregateSources]);

    const chartOptions = useChart({
        colors,
        chart: {
            stacked: true,
        },
        plotOptions: {
            bar: {
                columnWidth: '60%',
                borderRadius: 4,
                borderRadiusApplication: 'end',
            },
        },
        xaxis: {
            categories,
            labels: {
                rotate: -45,
                rotateAlways: false,
                hideOverlappingLabels: true,
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
            position: 'bottom',
            horizontalAlign: 'center',
        },
    });

    if (!series || series.length === 0) {
        return <Typography sx={{ textAlign: 'center', my: 4 }}>No hourly sales data available for this date.</Typography>;
    }

    return (
        <Box sx={{ my: 4 }}>
            <Typography variant="h6" gutterBottom>Revenue by Hour (Eastern Time)</Typography>
            <Chart
                type="bar"
                series={series}
                options={chartOptions}
                sx={{ height: 350 }}
            />
        </Box>
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
