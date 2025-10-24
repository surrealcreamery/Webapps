import { createTheme, responsiveFontSizes, emphasize } from '@mui/material/styles';

// Base theme skeleton
const baseTheme = createTheme({});

// Public typography scale
const publicTypographyScale = {
  fontFamily: "'Outfit', sans-serif'",
  h1: { fontSize: '3.2rem', fontWeight: 400 },
  h2: { fontSize: '2.4rem', fontWeight: 300 },
  h3: { fontSize: '2.0rem', fontWeight: 400 },
  h4: { fontSize: '1.6rem', fontWeight: 700 },
  h5: { fontSize: '1.6rem', fontWeight: 700 },
  h6: { fontSize: '1.6rem', fontWeight: 700 },
  subtitle1: { fontSize: '1.3rem' },
  subtitle2: { fontSize: '1.3rem' },
  body1: { fontSize: '1.8rem', fontFamily: 'Outfit', fontWeight: 'light' },
  body2: { fontSize: '1.8rem', fontFamily: 'Outfit' },
  button: { fontSize: '1.6rem' },
  caption: { fontSize: '0.75rem' },
  overline: { fontSize: '0.625rem' }
};

// Public theme: uses publicTypographyScale + component overrides
let publicTheme = createTheme(baseTheme, {
  typography: publicTypographyScale,
  palette: { primary: { main: '#1976d2' } },
  components: {
    // Prevents ButtonBase from overriding child component backgrounds
    MuiButtonBase: {
      styleOverrides: {
        root: {
          backgroundColor: 'inherit',
        },
      },
    },
    // Global style override for the Chip component
    MuiChip: {
      styleOverrides: {
        root: ({ theme }) => {
          const backgroundColor =
            theme.palette.mode === 'light'
              ? theme.palette.grey[100]
              : theme.palette.grey[800];
          return {
            backgroundColor,
            height: theme.spacing(3),
            color: theme.palette.text.primary,
            fontWeight: theme.typography.fontWeightRegular,
            '&:hover, &:focus': {
              backgroundColor: emphasize(backgroundColor, 0.06),
              cursor: 'pointer',
            },
            '&:active': {
              boxShadow: theme.shadows[1],
              backgroundColor: emphasize(backgroundColor, 0.12),
            },
          };
        }
      }
    },
    MuiStepLabel: {
      styleOverrides: {
        root: {
          '& .MuiStepLabel-label': {
            fontSize: '2.0rem !important',
            fontWeight: 400,
            color: 'black !important',
            lineHeight: 1.2
          },
          '& .MuiStepLabel-label.Mui-active, .MuiStepLabel-label.Mui-completed, .MuiStepLabel-label.Mui-disabled': {
            fontSize: '2.0rem !important',
            fontWeight: 400,
            color: 'black !important'
          }
        }
      }
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          width: 30,
          height: 30,
          color: 'black !important',
          '& svg circle, &.Mui-active svg circle, &.Mui-completed svg circle': {
            fill: 'black !important'
          },
          '& .MuiStepIcon-text': {
            fontSize: '16px !important',
            fill: 'white !important'
          }
        }
      }
    },
    MuiStepContent: {
      styleOverrides: {
        root: {
          width: '100%',
          minWidth: '100%',
          flexShrink: 0,
          boxSizing: 'border-box'
        }
      }
    },
    MuiStepper: {
      styleOverrides: {
        root: {
          width: '100%',
          minWidth: '100%',
          boxSizing: 'border-box'
        }
      }
    },
    MuiFormHelperText: {
        styleOverrides: {
            root: {
                fontSize: '1.6rem',
                marginLeft: 0,
            }
        }
    },
    MuiButton: {
      variants: [
        {
          props: { variant: 'grey-back' },
          style: ({ theme }) => ({
            backgroundColor: theme.palette.grey[200],
            color: theme.palette.primary.main,
            padding: '14px 28px',
            '&:hover': {
              backgroundColor: theme.palette.grey[300],
            },
          }),
        },
      ],
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
        },
        contained: {
          padding: '14px 28px',
          backgroundColor: '#000000',
          color: '#ffffff',
          '&:hover': { backgroundColor: '#333333' }
        },
        outlined: {
          padding: '14px 28px',
          border: '2px solid #000000 !important',
          color: '#000000 !important',
          '&:hover': {
            border: '2px solid #333333 !important',
            backgroundColor: 'rgba(0,0,0,0.04) !important'
          }
        },
        text: {
          padding: '8px 16px',
          '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' },
        }
      }
    }
  }
});

export default responsiveFontSizes(publicTheme, { factor: 1.0 });