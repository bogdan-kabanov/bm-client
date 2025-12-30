import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            flexDirection: 'column',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '20px',
            textAlign: 'center',
            backgroundColor: '#f5f5f5',
          }}
        >
          <h1 style={{ color: '#ff4444', marginBottom: '20px' }}>
            Произошла ошибка
          </h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Приложение столкнулось с неожиданной ошибкой. Пожалуйста, обновите страницу.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 20px',
              background: '#4a9eff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              marginBottom: '20px',
            }}
          >
            Обновить страницу
          </button>
          {this.state.error && (
            <details
              style={{
                marginTop: '20px',
                textAlign: 'left',
                maxWidth: '600px',
                width: '100%',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  color: '#666',
                  marginBottom: '10px',
                }}
              >
                Детали ошибки
              </summary>
              <pre
                style={{
                  background: '#fff',
                  padding: '10px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  marginTop: '10px',
                  fontSize: '12px',
                  border: '1px solid #ddd',
                }}
              >
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack && (
                  <>
                    {'\n\n'}
                    {this.state.errorInfo.componentStack}
                  </>
                )}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

