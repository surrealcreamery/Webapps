import { Chart, useChart } from 'src/components/chart';

// ----------------------------------------------------------------------

export function ChartScatter({ chart }) {
  const chartOptions = useChart({
    chart: { zoom: { enabled: true, type: 'xy' } },
    legend: { show: true },
    xaxis: {
      tickAmount: 8,
      labels: { formatter: (value) => parseFloat(String(value)).toFixed(1) },
    },
    markers: { size: 6 },
  });

  return <Chart type="scatter" series={chart.series} options={chartOptions} sx={{ height: 350 }} />;
}
