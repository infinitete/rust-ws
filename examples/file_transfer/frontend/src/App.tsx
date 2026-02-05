import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Login } from './pages/Login';
import { TransferRoom } from './pages/TransferRoom';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00f0ff',
      dark: '#00c0cc',
      light: '#33f3ff',
    },
    secondary: {
      main: '#7000ff',
      dark: '#5900cc',
      light: '#8c33ff',
    },
    background: {
      default: '#0a0b14',
      paper: '#121420',
    },
    text: {
      primary: '#e0e6ed',
      secondary: '#94a3b8',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    success: {
      main: '#00ff9f',
    },
    error: {
      main: '#ff003c',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      letterSpacing: '-0.02em',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/transfer/:username" element={<TransferRoom />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
