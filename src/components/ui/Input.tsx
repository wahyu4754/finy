'use client';

import React, { forwardRef, useState } from 'react';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  leftIcon,
  rightAction,
  className = '',
  onFocus,
  onBlur,
  ...props
}, ref) => {
  const [focused, setFocused] = useState(false);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    if (onBlur) onBlur(e);
  };

  const containerClass = [
    styles.inputWrapper,
    focused ? styles.focused : '',
    error ? styles.errorBorder : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={`${styles.formGroup} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      
      <div className={containerClass}>
        {leftIcon && <div className={styles.leftIcon}>{leftIcon}</div>}
        
        <input
          ref={ref}
          className={styles.input}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        
        {rightAction && <div className={styles.rightAction}>{rightAction}</div>}
      </div>
      
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
