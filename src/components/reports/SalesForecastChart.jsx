import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Divider, CircularProgress, Paper } from '@mui/material';
import { Chart, useChart } from '@/components/chart';
import {
    format,
    parseISO,
    getDay,
    startOfDay,
    subDays,
    isAfter,
    subYears,
    setDay,
    subWeeks,
    addWeeks,
    getHours
} from 'date-fns';

// --- CONSTANTS & HELPERS ---
const FORECAST_CACHE_PREFIX = 'forecast_';

const saveForecastToCache = (reportId, forecastData) => {
    try {
        localStorage.setItem(`${FORECAST_CACHE_PREFIX}${reportId}`, JSON.stringify(forecastData));
    } catch (error) {
        console.error("Failed to save forecast to localStorage", error);
    }
};

const getForecastFromCache = (reportId) => {
    try {
        const dataString = localStorage.getItem(`${FORECAST_CACHE_PREFIX}${reportId}`);
        return dataString ? JSON.parse(dataString) : null;
    } catch (error) {
        console.error("Failed to retrieve forecast from localStorage", error);
        return null;
    }
};

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
const SalesForecastChart = ({ targetDateString, reportData, lastYearData, actualSales = null, refreshNonce, ordersData, revenueSources, isLoadingOrders }) => {
    const reportId = targetDateString;

    const forecast = useMemo(() => {
        if (isLoadingOrders) return null;

        const cachedForecast = getForecastFromCache(reportId);
        if (cachedForecast && refreshNonce === 0) {
            return cachedForecast;
        }

        const historicalOrdersData = ordersData?.historical || [];
        const historicalForwardOrdersData = ordersData?.historicalForward || [];
        const recentOrdersData = ordersData?.recent || [];
        if (!historicalOrdersData || !recentOrdersData || !revenueSources) return null;

        const targetDate = parseISO(targetDateString);
        const today = startOfDay(new Date());
        const targetDayOfWeek = getDay(targetDate);

        const hourlySourceKeys = { 'Retail Orders': 'Retail', 'Surreal Creamery DoorDash Orders': 'DoorDash', 'Breaking Batter DoorDash': 'DoorDash', 'Surreal Creamery Uber Eats Orders': 'UberEats', 'Breaking Batter UberEats': 'UberEats', 'Surreal Creamery GrubHub Orders': 'GrubHub' };
        const dailySourceKeys = { 'Retail': ['Retail'], 'DoorDash': ['Surreal Creamery DoorDash', 'Breaking Batter DoorDash'], 'UberEats': ['Surreal Creamery UberEats', 'Breaking Batter UberEats'], 'GrubHub': ['Surreal Creamery GrubHub'] };
        const simpleKeys = revenueSources.map(rs => rs.label);

        const recentTotalSales = reportData.filter(r => !r.isSummary && isAfter(today, parseISO(r.Date)) && getDay(parseISO(r.Date)) === targetDayOfWeek).slice(0, 4).map(r => r.netSales).reverse();
        const avgRecentTotalSales = recentTotalSales.reduce((a, b) => a + b, 0) / (recentTotalSales.length || 1);

        const historicalAnchorDate = setDay(subYears(targetDate, 1), targetDayOfWeek);
        const historicalPast4Weeks = lastYearData.filter(r => { const d = parseISO(r.Date); return getDay(d) === targetDayOfWeek && isAfter(d, subWeeks(historicalAnchorDate, 4)) && !isAfter(d, historicalAnchorDate); }).map(r => r.netSales);
        const avgHistoricalPastSales = historicalPast4Weeks.reduce((a, b) => a + b, 0) / (historicalPast4Weeks.length || 1);

        const historicalForward4Weeks = lastYearData.filter(r => { const d = parseISO(r.Date); return getDay(d) === targetDayOfWeek && isAfter(d, historicalAnchorDate) && isAfter(addWeeks(historicalAnchorDate, 4), d); }).map(r => r.netSales);
        const avgHistoricalForwardSales = historicalForward4Weeks.reduce((a, b) => a + b, 0) / (historicalForward4Weeks.length || 1);

        const historicalTrendFactor = avgHistoricalPastSales > 0 ? avgHistoricalForwardSales / avgHistoricalPastSales : 1;

        const twentyEightDaysAgo = subDays(today, 28);
        const totalThisYear = reportData.filter(r => !r.isSummary && !r.isFuture && isAfter(parseISO(r.Date), twentyEightDaysAgo)).reduce((sum, r) => sum + (r.netSales || 0), 0);
        const totalLastYear = lastYearData.filter(r => { const d = parseISO(r.Date); return isAfter(d, subYears(twentyEightDaysAgo, 1)) && isAfter(subYears(today, 1), d); }).reduce((sum, r) => sum + (r.netSales || 0), 0);
        const growthFactor = totalLastYear > 0 ? totalThisYear / totalLastYear : 1;

        const predictionFromHistory = avgHistoricalPastSales * growthFactor * historicalTrendFactor;
        const totalDailyPrediction = (avgRecentTotalSales + predictionFromHistory) / 2;

        const recentDaysForMix = reportData.filter(r => !r.isSummary && isAfter(today, parseISO(r.Date)) && getDay(parseISO(r.Date)) === targetDayOfWeek).slice(0, 4);
        const recentSalesMix = {};
        const mixTotals = { total: 0 };
        simpleKeys.forEach(key => {
            const constituentKeys = dailySourceKeys[key];
            if (!constituentKeys) return;
            const sourceTotal = recentDaysForMix.reduce((sum, r) => sum + constituentKeys.reduce((partSum, part) => partSum + (r[part] || 0), 0), 0);
            recentSalesMix[key] = sourceTotal;
            mixTotals.total += sourceTotal;
        });
        if (mixTotals.total > 0) {
            simpleKeys.forEach(key => { recentSalesMix[key] /= mixTotals.total; });
        } else {
            simpleKeys.forEach(key => { recentSalesMix[key] = 1 / simpleKeys.length; });
        }

        const dailyPredictions = {};
        simpleKeys.forEach(key => { dailyPredictions[key] = totalDailyPrediction * recentSalesMix[key]; });

        const allHourlySources = [...historicalOrdersData, ...historicalForwardOrdersData, ...recentOrdersData];
        const hourlyDistributions = {};
        simpleKeys.forEach(k => hourlyDistributions[k] = []);
        allHourlySources.forEach(dayResult => {
            if (!dayResult) return;
            const hourlyTotals = {};
            const dailyTotals = {};
            simpleKeys.forEach(k => { hourlyTotals[k] = Array(24).fill(0); dailyTotals[k] = 0; });
            Object.keys(dayResult).forEach(apiKey => {
                const simpleKey = hourlySourceKeys[apiKey];
                if (simpleKey && dayResult[apiKey] && hourlyTotals[simpleKey]) {
                    const orders = safeParseJson(dayResult[apiKey]);
                    (Array.isArray(orders) ? orders : Object.values(orders)).forEach(order => {
                        if (order && order.Time && order['Net Total'] !== undefined) {
                            const hour = getHourFromTimeString(order.Time);
                            if (hour !== null) {
                                const netTotal = order['Net Total'] || 0;
                                hourlyTotals[simpleKey][hour] += netTotal;
                                dailyTotals[simpleKey] += netTotal;
                            }
                        }
                    });
                }
            });
            simpleKeys.forEach(k => { if (dailyTotals[k] > 0) { hourlyDistributions[k].push(hourlyTotals[k].map(h => h / dailyTotals[k])); } });
        });

        const hourlyPredictions = {};
        simpleKeys.forEach(key => {
            const averagedDistribution = Array(24).fill(0);
            if (hourlyDistributions[key] && hourlyDistributions[key].length > 0) {
                for (let hour = 0; hour < 24; hour++) {
                    let sumForHour = 0;
                    hourlyDistributions[key].forEach(dist => { sumForHour += dist[hour]; });
                    averagedDistribution[hour] = sumForHour / hourlyDistributions[key].length;
                }
            }
            hourlyPredictions[key] = averagedDistribution.map(p => p * (dailyPredictions[key] || 0));
        });

        const newForecast = {
            targetDateString,
            daily: {
                categories: ['-4w', '-3w', '-2w', '-1w', 'Prediction'],
                recentSales: recentTotalSales,
                prediction: totalDailyPrediction,
                yAxisMax: Math.max(...recentTotalSales, totalDailyPrediction, actualSales || 0) * 1.2,
            },
            hourly: {
                series: hourlyPredictions
            },
            growthFactor,
            historicalTrendFactor,
        };
        saveForecastToCache(reportId, newForecast);
        return newForecast;
    }, [reportId, refreshNonce, reportData, lastYearData, actualSales, targetDateString, ordersData, revenueSources, isLoadingOrders]);

    const hourlyChartData = useMemo(() => {
        if (!forecast || !revenueSources) return { series: [], categories: [], colors: [] };

        const categories = Array.from({ length: 24 }, (_, i) => formatHourLabel(i));
        const colors = [];
        const series = [];

        // Add projected series
        revenueSources.forEach(source => {
            if (forecast.hourly.series[source.label]) {
                series.push({
                    name: `${source.label} (Projected)`,
                    data: forecast.hourly.series[source.label],
                    group: 'projected',
                });
                colors.push(source.color);
            }
        });

        // Add actual series if available
        if (ordersData?.current) {
            const apiResponse = ordersData.current;
            const sourceMapping = { 'Retail Orders': 'Retail', 'Surreal Creamery DoorDash Orders': 'DoorDash', 'Breaking Batter DoorDash': 'DoorDash', 'Surreal Creamery Uber Eats Orders': 'UberEats', 'Breaking Batter UberEats': 'UberEats', 'Surreal Creamery GrubHub Orders': 'GrubHub' };
            const hourlyTotals = {};
            revenueSources.forEach(source => { hourlyTotals[source.label] = Array(24).fill(0); });

            for (const apiKey in apiResponse) {
                const simpleKey = sourceMapping[apiKey];
                if (simpleKey && apiResponse[apiKey] && hourlyTotals[simpleKey]) {
                    const orders = safeParseJson(apiResponse[apiKey]);
                    (Array.isArray(orders) ? orders : Object.values(orders)).forEach(order => {
                        if (order && order.Time && order['Net Total'] !== undefined) {
                            const hour = getHourFromTimeString(order.Time);
                            if (hour !== null) hourlyTotals[simpleKey][hour] += order['Net Total'] || 0;
                        }
                    });
                }
            }

            revenueSources.forEach(source => {
                series.unshift({
                    name: `${source.label} (Actual)`,
                    data: hourlyTotals[source.label] || Array(24).fill(0),
                    group: 'actuals',
                });
                colors.unshift(source.color);
            });
        }

        return { series, categories, colors };
    }, [forecast, ordersData, revenueSources]);

    const hasHourlyData = (ordersData?.historical?.length > 0 || ordersData?.recent?.length > 0 || ordersData?.historicalForward?.length > 0) && forecast?.hourly.series && Object.values(forecast.hourly.series).flat().some(d => d > 0.01);

    // Daily forecast chart options
    const dailyChartOptions = useChart({
        colors: ['#64b5f6', '#4caf50'],
        stroke: {
            width: 3,
            curve: 'smooth',
        },
        markers: {
            size: 6,
        },
        xaxis: {
            categories: forecast?.daily.categories || [],
        },
        yaxis: {
            min: 0,
            max: forecast?.daily.yAxisMax,
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
        },
        annotations: actualSales !== null ? {
            yaxis: [
                {
                    y: actualSales,
                    borderColor: '#ff9800',
                    borderWidth: 2,
                    strokeDashArray: 5,
                    label: {
                        borderColor: '#ff9800',
                        style: {
                            color: '#fff',
                            background: '#ff9800',
                            fontSize: '12px',
                            fontWeight: 600,
                        },
                        text: `Actual: ${formatCurrency(actualSales)}`,
                        position: 'right',
                    },
                },
            ],
        } : {},
    });

    // Hourly chart options
    const hourlyChartOptions = useChart({
        colors: hourlyChartData.colors,
        chart: {
            stacked: true,
        },
        plotOptions: {
            bar: {
                columnWidth: '60%',
                borderRadius: 4,
            },
        },
        xaxis: {
            categories: hourlyChartData.categories,
            labels: {
                rotate: -45,
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
            position: 'bottom',
        },
    });

    if (!forecast) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Calculating Forecast...</Typography>
            </Box>
        );
    }

    const dailySeries = [
        {
            name: `Recent ${format(parseISO(targetDateString), 'EEEE')}s`,
            data: forecast.daily.recentSales,
        },
        {
            name: `Prediction (${formatCurrency(forecast.daily.prediction)})`,
            data: [...Array(forecast.daily.recentSales.length).fill(null), forecast.daily.prediction],
        },
    ];

    return (
        <Box>
            <Typography variant="h6" gutterBottom>Sales Forecast for {format(parseISO(targetDateString), 'EEEE, MMM do')}</Typography>
            <Box sx={{ display: 'flex', gap: 3, mb: 2, justifyContent: 'center', p: 1, backgroundColor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" component="div">Y-o-Y Growth (28d): <Box component="strong" sx={{ color: forecast.growthFactor >= 1 ? 'success.main' : 'error.main' }}>{((forecast.growthFactor - 1) * 100).toFixed(1)}%</Box></Typography>
                <Divider orientation="vertical" flexItem />
                <Typography variant="body2" component="div">Historical Trend (±4w): <Box component="strong" sx={{ color: forecast.historicalTrendFactor >= 1 ? 'success.main' : 'error.main' }}>{((forecast.historicalTrendFactor - 1) * 100).toFixed(1)}%</Box></Typography>
            </Box>

            <Chart
                type="line"
                series={dailySeries}
                options={dailyChartOptions}
                sx={{ height: 300 }}
            />

            <Typography variant="caption" color="text.secondary">Prediction blends recent performance with growth-adjusted historical data and trends.</Typography>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>Hourly Sales Projection vs. Actual</Typography>
            {hasHourlyData ? (
                <Chart
                    type="bar"
                    series={hourlyChartData.series}
                    options={hourlyChartOptions}
                    sx={{ height: 350 }}
                />
            ) : (
                <Paper variant="outlined" sx={{ p: 4, my: 2, textAlign: 'center', backgroundColor: 'action.hover' }}>
                    <Typography variant="body1" color="text.secondary">Hourly projection is not available.</Typography>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>This requires a single location to be selected in the filter and for recent or historical hourly data to exist for this day.</Typography>
                </Paper>
            )}
        </Box>
    );
};

SalesForecastChart.propTypes = {
    targetDateString: PropTypes.string.isRequired,
    reportData: PropTypes.array.isRequired,
    lastYearData: PropTypes.array.isRequired,
    actualSales: PropTypes.number,
    refreshNonce: PropTypes.number.isRequired,
    ordersData: PropTypes.object,
    revenueSources: PropTypes.array.isRequired,
    isLoadingOrders: PropTypes.bool.isRequired,
};

export default SalesForecastChart;
