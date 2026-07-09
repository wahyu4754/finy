'use client';

import React from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, ToastType } from '../../store/toast';
import styles from './Toast.module.css';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type] || Info;
        return (
          <div 
            key={toast.id} 
            className={`${styles.toast} ${styles[toast.type]}`}
          >
            <Icon size={18} className={styles.icon} />
            <span className={styles.message}>{toast.message}</span>
            <button 
              onClick={() => removeToast(toast.id)} 
              className={styles.closeBtn}
              aria-label="close toast"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
