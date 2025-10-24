// /src/themes/adminTheme.js

import { createTheme, responsiveFontSizes } from '@mui/material/styles';

// Base theme skeleton
const baseTheme = createTheme({});

// Admin typography scale
const adminTypographyScale = {
  fontFamily: "'Roboto', sans-serif'",
  h1: { fontSize: '2.8rem', fontWeight: 500 },
  h2: { fontSize: '2.2rem', fontWeight: 400 },
  h3: { fontSize: '1.8rem', fontWeight: 500 },
  h4: { fontSize: '1.4rem', fontWeight: 300 },
  h5: { fontSize: '1.2rem', fontWeight: 600 },
  h6: { fontSize: '2rem', fontWeight: 500 },
  subtitle1: { fontSize: '1.2rem' },
  subtitle2: { fontSize: '1.1rem' },
  body1: { fontSize: '1.4rem', fontFamily: "'Roboto', sans-serif", fontWeight: 500 },
  body2: { fontSize: '1.2rem', fontFamily: "'Roboto', sans-serif", fontWeight: 500 },
  button: { fontSize: '1.3rem' },
  caption: { fontSize: '1.2rem' },
  overline: { fontSize: '0.55rem' }
};

// Admin theme: uses adminTypographyScale
let adminTheme = createTheme(baseTheme, {
  typography: adminTypographyScale,
  components: {
    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: '1.1rem', lineHeight: 1.4, marginLeft: 0 }
      }
    }
    // …other admin-specific overrides…
  }
});

export default responsiveFontSizes(adminTheme, { factor: 1.0 });