'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { formatDate } from '../../lib/format';
import styles from './DatePicker.module.css';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  error?: string;
}

export default function DatePicker({ value, onChange, label, error }: DatePickerProps) {
  return (
    <div className={styles.formGroup}>
      {label && <label className={styles.label}>{label}</label>}
      
      <div className={`${styles.pickerWrapper} ${error ? styles.errorBorder : ''}`}>
        <Calendar size={18} className={styles.icon} />
        
        {/* Custom text representation overlaying hidden input */}
        <span className={styles.displayDate}>{formatDate(value)}</span>
        
        {/* Native date picker input completely overlayed and transparent */}
        <input 
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={styles.nativeInput}
        />
      </div>

      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}
