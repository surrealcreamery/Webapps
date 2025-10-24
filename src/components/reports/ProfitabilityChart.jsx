import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Tooltip, Divider } from '@mui/material';
import { BarChart } from '@mui/x-charts';

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

// --- MAIN COMPONENT ---

const ProfitabilityChart = ({ report, revenueSources }) => {
    const { netSales = 0, breakeven = 0 } = report || {};
    const chartHeight = 300;
    const chartMargins = { top: 20, right: 20, bottom: 30, left: 90 };
    const [tooltipData, setTooltipData] = useState(null);

    const chartData = useMemo(() => {
        const xAxisData = ['Net Sales'];
        const netSalesSeries = revenueSources.map(source => ({
            data: [source.value],
            label: source.label,
            color: source.color,
            stack: 'A',
        }));
        return {
            xAxis: [{ scaleType: 'band', data: xAxisData, disableAxisListener: true }],
            series: netSalesSeries
        };
    }, [revenueSources]);

    const yAxisMax = useMemo(() => Math.max(netSales, breakeven) * 1.15, [netSales, breakeven]);
    const breakevenPercentage = useMemo(() => (yAxisMax > 0 ? (breakeven / yAxisMax) * 100 : 0), [breakeven, yAxisMax]);

    const handleTooltipEnter = (event, data) => {
        if (data.value > 0) {
            setTooltipData({
                top: event.clientY,
                left: event.clientX,
                content: `${data.series.label}: ${formatCurrency(data.value)}`
            });
        }
    };
    const handleTooltipLeave = () => setTooltipData(null);

    return (
        <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>Profitability Analysis</Typography>
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
                <Box sx={{ position: 'relative', height: chartHeight }} onContextMenu={(e) => e.preventDefault()}>
                    <Typography
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '15px',
                            transform: 'translateY(-50%) rotate(-90deg)',
                            color: 'text.secondary',
                            fontWeight: 500
                        }}
                    >
                        Total Revenue
                    </Typography>
                    <BarChart
                        series={chartData.series}
                        xAxis={chartData.xAxis}
                        height={chartHeight}
                        margin={chartMargins}
                        yAxis={[{ max: yAxisMax, valueFormatter: compactCurrencyFormatter, disableAxisListener: true }]}
                        slotProps={{ legend: { hidden: true } }}
                        tooltip={{ trigger: 'none' }}
                        onItemEnter={handleTooltipEnter}
                        onItemLeave={handleTooltipLeave}
                    />
                    {breakeven > 0 && (
                        <Box
                            sx={{
                                position: 'absolute',
                                left: `${chartMargins.left}px`,
                                right: `${chartMargins.right}px`,
                                top: `calc(${chartMargins.top}px + (100% - ${chartMargins.top}px - ${chartMargins.bottom}px) * ${1 - (breakevenPercentage / 100)})`,
                                borderTop: '2px dashed #e57373',
                                zIndex: 5,
                                pointerEvents: 'none'
                            }}
                        >
                            <Typography
                                variant="caption"
                                sx={{
                                    position: 'absolute',
                                    top: -18,
                                    right: 0,
                                    color: '#e57373',
                                    fontWeight: 'bold',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Break-even ({formatCurrency(breakeven)})
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Tooltip>
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
    /** The main report object for the day, containing netSales and breakeven points. */
    report: PropTypes.shape({
        netSales: PropTypes.number,
        breakeven: PropTypes.number,
    }),
    /** An array of objects defining the labels, values, and colors for revenue sources. */
    revenueSources: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.number.isRequired,
        color: PropTypes.string.isRequired,
    })).isRequired,
};

export default ProfitabilityChart;