'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, subMonths, parseISO, format } from 'date-fns';
import { formatMonthDisplay } from '../../lib/format';
import styles from './MonthPicker.module.css';

interface MonthPickerProps {
  value: string; // YYYY-MM
  onChange: (value: string) => void;
}

export default function MonthPicker({ value, onChange }: MonthPickerProps) {
  const handlePrev = () => {
    const current = parseISO(`${value}-01`);
    const prev = subMonths(current, 1);
    onChange(format(prev, 'yyyy-MM'));
  };

  const handleNext = () => {
    const current = parseISO(`${value}-01`);
    const next = addMonths(current, 1);
    onChange(format(next, 'yyyy-MM'));
  };

  return (
    <div className={styles.container}>
      <button 
        type="button" 
        onClick={handlePrev} 
        className={styles.btn}
        aria-label="previous month"
      >
        <ChevronLeft size={20} />
      </button>
      
      <span className={styles.label}>{formatMonthDisplay(value)}</span>
      
      <button 
        type="button" 
        onClick={handleNext} 
        className={styles.btn}
        aria-label="next month"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
