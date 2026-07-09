'use client';

import React, { useState } from 'react';
import { Lock, Delete, ShieldAlert } from 'lucide-react';
import { useSecurityStore } from '../store/security';
import { useTranslation } from '../lib/i18n';
import styles from './AppLock.module.css';

export default function AppLock() {
  const { verifyPin } = useSecurityStore();
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleKeyPress = (num: string) => {
    if (input.length >= 6) return;
    setError(false);
    
    const newVal = input + num;
    setInput(newVal);

    // If reached 6 digits, verify it
    if (newVal.length === 6) {
      const isValid = verifyPin(newVal);
      if (!isValid) {
        // Trigger shake & error state
        setError(true);
        // Play error vibration (if supported)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        // Clear input after a short delay
        setTimeout(() => setInput(''), 600);
      }
    }
  };

  const handleBackspace = () => {
    setError(false);
    setInput(prev => prev.slice(0, -1));
  };

  return (
    <div className={styles.overlay}>
      <div className={`${styles.container} ${error ? styles.shake : ''}`}>
        
        {/* Header Lock Icon */}
        <div className={styles.lockIconContainer}>
          <Lock size={32} className={styles.lockIcon} />
        </div>

        <h2 className={styles.title}>{t('securityEnterPIN')}</h2>
        
        {/* Dots Indicator */}
        <div className={styles.dotsRow}>
          {[...Array(6)].map((_, idx) => {
            const isFilled = idx < input.length;
            return (
              <div 
                key={idx} 
                className={`${styles.dot} ${isFilled ? styles.dotFilled : ''} ${error ? styles.dotError : ''}`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className={styles.errorMessage}>
            <ShieldAlert size={14} />
            <span>{t('securityPINWrong')}</span>
          </div>
        )}

        {/* Keyboard Numpad */}
        <div className={styles.numpad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button 
              key={num} 
              onClick={() => handleKeyPress(num)} 
              className={styles.numKey}
            >
              {num}
            </button>
          ))}
          <div className={styles.emptyKey} />
          <button onClick={() => handleKeyPress('0')} className={styles.numKey}>
            0
          </button>
          <button onClick={handleBackspace} className={styles.backspaceKey} aria-label="backspace">
            <Delete size={20} />
          </button>
        </div>

      </div>
    </div>
  );
}
