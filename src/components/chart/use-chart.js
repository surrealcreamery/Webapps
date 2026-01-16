import { useTheme, alpha } from '@mui/material/styles';

// Deep merge utility
function merge(target, source) {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = merge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export function useChart(updatedOptions) {
  const theme = useTheme();
  const baseOptions = baseChartOptions(theme) ?? {};
  return merge(baseOptions, updatedOptions ?? {});
}

const baseChartOptions = (theme) => {
  const LABEL_TOTAL = {
    show: true,
    label: 'Total',
    color: theme.palette.text.secondary,
    fontSize: theme.typography.subtitle2.fontSize,
    fontWeight: theme.typography.subtitle2.fontWeight,
  };

  const LABEL_VALUE = {
    offsetY: 8,
    color: theme.palette.text.primary,
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.h4.fontWeight,
  };

  return {
    // Chart
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      parentHeightOffset: 0,
      fontFamily: theme.typography.fontFamily,
      foreColor: theme.palette.text.disabled,
      animations: {
        enabled: true,
        speed: 360,
        animateGradually: { enabled: true, delay: 120 },
        dynamicAnimation: { enabled: true, speed: 360 },
      },
    },

    // Colors
    colors: [
      theme.palette.primary.main,
      theme.palette.warning.main,
      theme.palette.info.main,
      theme.palette.error.main,
      theme.palette.success.main,
      theme.palette.warning.dark,
      theme.palette.success.dark,
      theme.palette.info.dark,
    ],

    // States
    states: {
      hover: { filter: { type: 'darken' } },
      active: { filter: { type: 'darken' } },
    },

    // Fill
    fill: {
      opacity: 1,
      gradient: {
        type: 'vertical',
        shadeIntensity: 0,
        opacityFrom: 0.4,
        opacityTo: 0,
        stops: [0, 100],
      },
    },

    // Data labels
    dataLabels: { enabled: false },

    // Stroke
    stroke: { width: 2.5, curve: 'smooth', lineCap: 'round' },

    // Grid
    grid: {
      strokeDashArray: 3,
      borderColor: theme.palette.divider,
      padding: { top: 0, right: 0, bottom: 0 },
      xaxis: { lines: { show: false } },
    },

    // Axis
    xaxis: { axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { tickAmount: 5 },

    // Markers
    markers: {
      size: 0,
      strokeColors: theme.palette.background.paper,
    },

    // Tooltip
    tooltip: {
      theme: theme.palette.mode === 'dark' ? 'dark' : 'light',
      fillSeriesColor: false,
      x: { show: true },
      style: {
        fontSize: '12px',
      },
      y: {
        formatter: undefined,
      },
    },

    // Legend
    legend: {
      show: false,
      position: 'top',
      fontWeight: 500,
      fontSize: '13px',
      horizontalAlign: 'right',
      markers: { shape: 'circle' },
      labels: { colors: theme.palette.text.primary },
      itemMargin: { horizontal: 8, vertical: 8 },
    },

    // Plot Options
    plotOptions: {
      bar: { borderRadius: 4, columnWidth: '48%', borderRadiusApplication: 'end' },
      pie: {
        donut: { labels: { show: true, value: { ...LABEL_VALUE }, total: { ...LABEL_TOTAL } } },
      },
      radialBar: {
        hollow: { margin: -8, size: '100%' },
        track: {
          margin: -8,
          strokeWidth: '50%',
          background: alpha(theme.palette.grey[500], 0.16),
        },
        dataLabels: { value: { ...LABEL_VALUE }, total: { ...LABEL_TOTAL } },
      },
      radar: {
        polygons: {
          fill: { colors: ['transparent'] },
          strokeColors: theme.palette.divider,
          connectorColors: theme.palette.divider,
        },
      },
      polarArea: {
        rings: { strokeColor: theme.palette.divider },
        spokes: { connectorColors: theme.palette.divider },
      },
      heatmap: { distributed: true },
    },

    // Responsive
    responsive: [
      {
        breakpoint: theme.breakpoints.values.sm,
        options: { plotOptions: { bar: { borderRadius: 3, columnWidth: '80%' } } },
      },
      {
        breakpoint: theme.breakpoints.values.md,
        options: { plotOptions: { bar: { columnWidth: '60%' } } },
      },
    ],
  };
};
