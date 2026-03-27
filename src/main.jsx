// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { EvervaultProvider } from '@evervault/react';
import Router from './router'; // this is your router.jsx
import './styles/main.scss';

// Global error boundary to catch any unhandled render errors
class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[GlobalErrorBoundary] Caught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { style: { padding: 40, fontFamily: 'monospace' } },
        React.createElement('h2', { style: { color: 'red' } }, 'App crashed'),
        React.createElement('pre', { style: { whiteSpace: 'pre-wrap', color: '#333' } },
          this.state.error?.message + '\n\n' + this.state.error?.stack
        ),
        React.createElement('button', { onClick: () => this.setState({ hasError: false, error: null }) }, 'Try again')
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