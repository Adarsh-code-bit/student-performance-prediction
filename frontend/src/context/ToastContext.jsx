import { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const knownTypes = ['success', 'error', 'warning', 'info', 'danger'];
    let toastMessage = message;
    let toastType = type;

    // Support addToast(message, type) and showToast(type, message)
    if (knownTypes.includes(message) && typeof type === 'string' && !knownTypes.includes(type)) {
      toastMessage = type;
      toastType = message;
    }

    if (toastType === 'danger') toastType = 'error';
    if (!ICONS[toastType]) toastType = 'info';

    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message: toastMessage, type: toastType }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{
      addToast,
      showToast: addToast,
      success: (message) => addToast(message, 'success'),
      error: (message) => addToast(message, 'error'),
      warning: (message) => addToast(message, 'warning'),
      info: (message) => addToast(message, 'info'),
    }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => {
          const Icon = ICONS[toast.type] || Info;
          return (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              <Icon size={18} />
              <span className="toast-message">{toast.message}</span>
              <button className="toast-close" onClick={() => removeToast(toast.id)}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
