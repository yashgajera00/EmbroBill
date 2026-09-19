import React from 'react';

export const getToastIcon = (type, message = '') => {
  const msgLower = (message || '').toLowerCase();
  if (msgLower.includes('unlocked')) {
    return 'bi-unlock-fill';
  }
  if (msgLower.includes('locked')) {
    return 'bi-lock-fill';
  }
  if (msgLower.includes('fingerprint') || msgLower.includes('authenticat') || msgLower.includes('device security')) {
    return 'bi-fingerprint';
  }
  switch (type) {
    case 'success':
      return 'bi-check-circle-fill';
    case 'danger':
    case 'error':
      return 'bi-exclamation-circle-fill';
    case 'warning':
      return 'bi-exclamation-triangle-fill';
    case 'info':
    default:
      return 'bi-info-circle-fill';
  }
};

export default function PillToast({ alert, onClear }) {
  if (!alert || !alert.message) return null;

  const isWaiting = alert.loading || 
    (typeof alert.message === 'string' && (
      alert.message.toLowerCase().includes('waiting for') || 
      alert.message.toLowerCase().includes('authenticating')
    ));

  return (
    <div className="app-pill-toast-container no-print">
      <div className={`app-pill-toast ${alert.type || 'success'}`}>
        <div className="app-pill-toast-left">
          {isWaiting ? (
            <span
              className="spinner-border spinner-border-sm me-1"
              role="status"
              style={{ width: '15px', height: '15px', borderWidth: '2px', flexShrink: 0 }}
            ></span>
          ) : (
            <i className={`bi ${getToastIcon(alert.type, alert.message)} app-pill-toast-icon`}></i>
          )}
          <span className="app-pill-toast-message">{alert.message}</span>
        </div>
        <button
          type="button"
          className="app-pill-toast-close"
          onClick={onClear}
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <i className="bi bi-x-lg"></i>
        </button>
      </div>
    </div>
  );
}
