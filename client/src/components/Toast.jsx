import React from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const Toast = ({ toast, onClose }) => {
  const Icon = ICONS[toast.type] || Info;

  return (
    <div className={`toast toast-${toast.type}`}>
      <Icon size={18} />
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={() => onClose(toast.id)} aria-label="Close">
        <X size={14} />
      </button>
    </div>
  );
};

export default Toast;
