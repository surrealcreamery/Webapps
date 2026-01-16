import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Divider } from '@mui/material';
import { Chart, useChart } from '@/components/chart';

// --- HELPER FUNCTIONS ---
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '—';
    return currencyFormatter.format(value);
};

// --- MAIN COMPONENT ---
const ProfitabilityChart = ({ report, revenueSources }) => {
    const { netSales = 0, breakeven = 0 } = report || {};

    const series = useMemo(() => {
        return revenueSources.map(source => ({
            name: source.label,
            data: [source.value],
        }));
    }, [revenueSources]);

    const colors = useMemo(() => revenueSources.map(s => s.color), [revenueSources]);

    const chartOptions = useChart({
        colors,
        chart: {
            stacked: true,
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '40%',
                borderRadius: 6,
                borderRadiusApplication: 'end',
            },
        },
        xaxis: {
            categories: ['Net Sales'],
            labels: { show: false },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            min: 0,
            max: Math.max(netSales, breakeven) * 1.15,
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
            show: false,
        },
        annotations: breakeven > 0 ? {
            yaxis: [
                {
                    y: breakeven,
                    borderColor: '#e57373',
                    borderWidth: 2,
                    strokeDashArray: 5,
                    label: {
                        borderColor: '#e57373',
                        style: {
                            color: '#fff',
                            background: '#e57373',
                            fontSize: '12px',
                            fontWeight: 600,
                        },
                        text: `Break-even (${formatCurrency(breakeven)})`,
                        position: 'right',
                    },
                },
            ],
        } : {},
    });

    return (
        <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>Profitability Analysis</Typography>
            <Chart
                type="bar"
                series={series}
                options={chartOptions}
                sx={{ height: 300 }}
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', mt: 1, gap: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Net Sales ({formatCurrency(netSales)})</Typography>
                <Divider orientation="vertical" flexItem />
                {revenueSources.map(source => (
                    <Box key={source.label} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ width: 14, height: 14, bgcolor: source.color, mr: 0.5, borderRadius: '2px' }} />
                        <Typography variant="caption">{source.label} ({formatCurrency(source.value)})</Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

ProfitabilityChart.propTypes = {
    report: PropTypes.shape({
        netSales: PropTypes.number,
        breakeven: PropTypes.number,
    }),
    revenueSources: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.number.isRequired,
        color: PropTypes.string.isRequired,
    })).isRequired,
};

export default ProfitabilityChart;
