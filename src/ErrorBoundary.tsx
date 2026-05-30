import React, { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'hsl(var(--background, 265 30% 6%))',
            fontFamily: 'system-ui, sans-serif',
            padding: '1rem',
          }}
        >
          <div
            style={{
              maxWidth: '420px',
              width: '100%',
              padding: '2rem',
              background: 'hsl(var(--card, 265 25% 10%))',
              border: '1px solid hsl(var(--border, 265 25% 18%))',
              borderRadius: '1rem',
              textAlign: 'center',
              boxShadow: '0 0 60px hsl(280 100% 65% / 0.08)',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'hsl(0 80% 55% / 0.15)',
                border: '2px solid hsl(0 80% 55% / 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="hsl(0 80% 65%)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                letterSpacing: '0.1em',
                color: 'hsl(var(--foreground, 265 20% 92%))',
                marginBottom: '0.5rem',
                fontFamily: "'Orbitron', system-ui, sans-serif",
              }}
            >
              SOMETHING WENT WRONG
            </h1>

            <p
              style={{
                fontSize: '0.875rem',
                color: 'hsl(var(--muted-foreground, 265 15% 60%))',
                marginBottom: '1.5rem',
                lineHeight: 1.5,
              }}
            >
              An unexpected error occurred. Reload the page to continue.
            </p>

            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.625rem 1.75rem',
                background: 'hsl(280 100% 65%)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                fontFamily: "'Orbitron', system-ui, sans-serif",
                boxShadow: '0 0 20px hsl(280 100% 65% / 0.35)',
              }}
            >
              RELOAD
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
