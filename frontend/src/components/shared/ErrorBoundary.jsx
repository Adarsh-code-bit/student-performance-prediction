import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto my-12 bg-white rounded-xl shadow border border-red-100 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-600 text-sm mb-4">
            An unexpected error occurred while rendering this view.
          </p>
          {this.state.error && (
            <div className="bg-gray-50 text-red-600 p-3 rounded font-mono text-xs mb-6 text-left overflow-auto max-h-32 border">
              {this.state.error.toString()}
            </div>
          )}
          <div className="flex justify-center gap-3">
            <button 
              onClick={this.handleReload} 
              className="btn btn-primary flex items-center gap-2"
            >
              <RefreshCw size={16} /> Reload Page
            </button>
            <button 
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }} 
              className="btn btn-secondary"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
