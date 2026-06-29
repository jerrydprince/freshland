import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-8 rounded-2xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <div>
              <h1 className="text-2xl font-serif font-bold text-white mb-2">Something went wrong</h1>
              <p className="text-gray-200">
                A critical error occurred while rendering this page. Our engineers have been notified.
              </p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Reload Page
            </button>

            {import.meta.env.DEV && this.state.error && (
              <div className="mt-6 text-left">
                <p className="text-red-400 text-sm font-mono break-all bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
