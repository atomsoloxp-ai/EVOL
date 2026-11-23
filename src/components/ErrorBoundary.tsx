import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('EVOL Application ErrorBoundary caught error:', error, info);
  }

  handleSafeReset = () => {
    try {
      const raw = localStorage.getItem('evol_progression_store_v3');
      if (raw) {
        localStorage.setItem('evol_corrupted_backup', raw);
      }
      localStorage.removeItem('evol_progression_store_v3');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#0a0c13',
            color: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '420px',
              width: '100%',
              background: '#151a28',
              border: '1px solid #ef4444',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h2 style={{ color: '#f87171', margin: 0, fontSize: '1.1rem' }}>
              Application Recovery Mode
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
              An unexpected error occurred while rendering ({this.state.errorMessage}). Your saved data can be backed up before reloading.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #38bdf8',
                  background: 'transparent',
                  color: '#38bdf8',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                Reload
              </button>
              <button
                type="button"
                onClick={this.handleSafeReset}
                style={{
                  flex: 1.2,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                Backup &amp; Recover
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
