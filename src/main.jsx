// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { EvervaultProvider } from '@evervault/react';
import Router from './router'; // this is your router.jsx
import './styles/main.scss';

// Global error boundary — catches unhandled React render errors and shows
// a recovery screen instead of a white page. Auto-reloads after 10 seconds
// so unattended kiosk devices recover without manual intervention.
class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.timer = null;
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[GlobalErrorBoundary] Caught error:', error, info);
  }
  componentDidUpdate(_, prevState) {
    if (this.state.hasError && !prevState.hasError) {
      this.timer = setTimeout(() => window.location.reload(), 10000);
    }
  }
  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: { padding: 40, fontFamily: 'system-ui, sans-serif', textAlign: 'center', maxWidth: 500, margin: '80px auto' },
      },
        React.createElement('h2', { style: { color: '#d32f2f', marginBottom: 8 } }, 'Something went wrong'),
        React.createElement('p', { style: { color: '#666', marginBottom: 24 } },
          'The app will automatically reload in 10 seconds.'
        ),
        React.createElement('button', {
          onClick: () => window.location.reload(),
          style: {
            padding: '12px 32px', fontSize: 16, cursor: 'pointer',
            background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8,
          },
        }, 'Reload Now'),
        React.createElement('pre', {
          style: { marginTop: 32, textAlign: 'left', fontSize: 11, color: '#999', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
        }, this.state.error?.message)
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
//  <React.StrictMode>
      <GlobalErrorBoundary>
        <EvervaultProvider teamId="team_740904ab1baf" appId="app_e2350847da00">
          <Router />
        </EvervaultProvider>
      </GlobalErrorBoundary>
//  </React.StrictMode>
);