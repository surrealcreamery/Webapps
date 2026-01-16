// Admin Theme - Inspired by Minimal UI Template
// Simplified version compatible with standard MUI theme

import { createTheme, responsiveFontSizes } from '@mui/material/styles';

// Import fonts
import '@fontsource-variable/public-sans';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';

// Minimal-inspired color palette
const palette = {
  primary: {
    lighter: '#C8FAD6',
    light: '#5BE49B',
    main: '#00A76F',
    dark: '#007867',
    darker: '#004B50',
    contrastText: '#FFFFFF',
  },
  secondary: {
    lighter: '#EFD6FF',
    light: '#C684FF',
    main: '#8E33FF',
    dark: '#5119B7',
    darker: '#27097A',
    contrastText: '#FFFFFF',
  },
  info: {
    lighter: '#CAFDF5',
    light: '#61F3F3',
    main: '#00B8D9',
    dark: '#006C9C',
    darker: '#003768',
    contrastText: '#FFFFFF',
  },
  success: {
    lighter: '#D3FCD2',
    light: '#77ED8B',
    main: '#22C55E',
    dark: '#118D57',
    darker: '#065E49',
    contrastText: '#ffffff',
  },
  warning: {
    lighter: '#FFF5CC',
    light: '#FFD666',
    main: '#FFAB00',
    dark: '#B76E00',
    darker: '#7A4100',
    contrastText: '#1C252E',
  },
  error: {
    lighter: '#FFE9D5',
    light: '#FFAC82',
    main: '#FF5630',
    dark: '#B71D18',
    darker: '#7A0916',
    contrastText: '#FFFFFF',
  },
  grey: {
    50: '#FCFDFD',
    100: '#F9FAFB',
    200: '#F4F6F8',
    300: '#DFE3E8',
    400: '#C4CDD5',
    500: '#919EAB',
    600: '#637381',
    700: '#454F5B',
    800: '#1C252E',
    900: '#141A21',
  },
  text: {
    primary: '#1C252E',
    secondary: '#637381',
    disabled: '#919EAB',
  },
  background: {
    paper: '#FFFFFF',
    default: '#FFFFFF',
    neutral: '#F4F6F8',
  },
  action: {
    active: '#637381',
    hover: 'rgba(145, 158, 171, 0.08)',
    selected: 'rgba(145, 158, 171, 0.16)',
    disabled: 'rgba(145, 158, 171, 0.8)',
    disabledBackground: 'rgba(145, 158, 171, 0.24)',
    focus: 'rgba(145, 158, 171, 0.24)',
  },
  divider: 'rgba(145, 158, 171, 0.2)',
};

// Typography - rem values adjusted for 62.5% base (1rem = 10px, so 1.6rem = 16px)
const typography = {
  fontFamily: '"Public Sans Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightSemiBold: 600,
  fontWeightBold: 700,
  h1: { fontWeight: 800, fontSize: '4rem', lineHeight: 1.25 },       // 40px
  h2: { fontWeight: 800, fontSize: '3.2rem', lineHeight: 1.33 },     // 32px
  h3: { fontWeight: 700, fontSize: '2.4rem', lineHeight: 1.5 },      // 24px
  h4: { fontWeight: 700, fontSize: '2rem', lineHeight: 1.5 },        // 20px
  h5: { fontWeight: 700, fontSize: '1.8rem', lineHeight: 1.5 },      // 18px
  h6: { fontWeight: 700, fontSize: '1.6rem', lineHeight: 1.55 },     // 16px
  subtitle1: { fontWeight: 600, fontSize: '1.6rem', lineHeight: 1.5 },   // 16px
  subtitle2: { fontWeight: 600, fontSize: '1.4rem', lineHeight: 1.57 },  // 14px
  body1: { fontSize: '1.6rem', lineHeight: 1.5 },                    // 16px
  body2: { fontSize: '1.4rem', lineHeight: 1.57 },                   // 14px
  caption: { fontSize: '1.2rem', lineHeight: 1.5 },                  // 12px
  overline: { fontWeight: 700, fontSize: '1.2rem', lineHeight: 1.5, textTransform: 'uppercase' },  // 12px
  button: { fontWeight: 700, fontSize: '1.4rem', textTransform: 'none' },  // 14px
};

// Component overrides
const components = {
  MuiCssBaseline: {
    styleOverrides: {
      '*': {
        boxSizing: 'border-box',
      },
      html: {
        margin: 0,
        padding: 0,
        width: '100%',
        height: '100%',
        WebkitOverflowScrolling: 'touch',
      },
      body: {
        margin: 0,
        padding: 0,
        width: '100%',
        height: '100%',
      },
      '#root': {
        width: '100%',
        height: '100%',
      },
    },
  },
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: {
        borderRadius: 8,
        textTransform: 'none',
        fontWeight: 700,
      },
      containedPrimary: {
        '&:hover': {
          backgroundColor: palette.primary.dark,
        },
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        boxShadow: '0 0 2px 0 rgba(145, 158, 171, 0.2), 0 12px 24px -4px rgba(145, 158, 171, 0.12)',
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
      },
      rounded: {
        borderRadius: 16,
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        borderRight: 'none',
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: `1px solid ${palette.divider}`,
      },
      head: {
        backgroundColor: palette.grey[200],
        fontWeight: 600,
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 8,
        },
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        fontWeight: 500,
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 16,
        boxShadow: '0 0 2px 0 rgba(145, 158, 171, 0.2), 0 12px 24px -4px rgba(145, 158, 171, 0.12)',
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },
};

// Create theme
let adminTheme = createTheme({
  palette: {
    mode: 'light',
    ...palette,
  },
  typography,
  components,
  shape: {
    borderRadius: 8,
  },
});

// Apply responsive font sizes
adminTheme = responsiveFontSizes(adminTheme);

export default adminTheme;
