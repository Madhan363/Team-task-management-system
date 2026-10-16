import { AlertTriangle } from 'lucide-react';

function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Yes, Proceed',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="taskflow-modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="taskflow-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="taskflow-modal-header">
          {isDestructive && (
            <div className="taskflow-modal-icon-danger">
              <AlertTriangle size={22} />
            </div>
          )}
          <h3 id="modal-title">{title}</h3>
        </div>
        <div className="taskflow-modal-body">
          <p>{message}</p>
        </div>
        <div className="taskflow-modal-actions">
          <button
            type="button"
            className="tf-btn tf-btn-secondary"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`tf-btn ${isDestructive ? 'tf-btn-danger' : 'tf-btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
