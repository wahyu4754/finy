'use client';

import React from 'react';
import styles from './SegmentedControl.module.css';

interface Option {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  options: Option[];
  selectedValue: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function SegmentedControl({
  options,
  selectedValue,
  onChange,
  className = '',
}: SegmentedControlProps) {
  return (
    <div className={`${styles.control} ${className}`}>
      {options.map((opt) => {
        const isActive = opt.value === selectedValue;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
