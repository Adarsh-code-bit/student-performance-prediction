import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, loading }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog">
          <div className="confirm-icon">
            <AlertTriangle size={32} />
          </div>
          <h3 className="confirm-title">{title || 'Are you sure?'}</h3>
          <p className="confirm-message">{message || 'This action cannot be undone.'}</p>
          <div className="confirm-actions">
            <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
