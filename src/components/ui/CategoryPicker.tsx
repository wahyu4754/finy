'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../lib/i18n';
import { useTransactionStore } from '../../store/transactions';
import Modal from './Modal';
import SegmentedControl from './SegmentedControl';
import CategoryIcon from './CategoryIcon';
import styles from './CategoryPicker.module.css';

interface CategoryPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedId: string;
  onChange: (id: string) => void;
  type?: 'expense' | 'income';
}

export default function CategoryPicker({
  isOpen,
  onClose,
  selectedId,
  onChange,
  type,
}: CategoryPickerProps) {
  const { t } = useTranslation();
  const { categories } = useTransactionStore();
  const [activeType, setActiveType] = useState<'expense' | 'income'>(type || 'expense');

  useEffect(() => {
    if (type) {
      setActiveType(type);
    }
  }, [type]);

  // Filter categories by selected type and exclude archived ones
  const filtered = categories.filter(
    (cat) => cat.type === activeType && !cat.is_archived
  );

  const handleSelect = (id: string) => {
    onChange(id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('category')}>
      <div className={styles.container}>
        {!type && (
          <SegmentedControl
            options={[
              { label: t('expense'), value: 'expense' },
              { label: t('income'), value: 'income' },
            ]}
            selectedValue={activeType}
            onChange={(val) => setActiveType(val as 'expense' | 'income')}
            className={styles.segment}
          />
        )}
        
        <div className={styles.grid}>
          {filtered.map((cat) => {
            const isSelected = cat.id === selectedId;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelect(cat.id)}
                className={`${styles.item} ${isSelected ? styles.selected : ''}`}
              >
                <div 
                  className={styles.iconCircle}
                  style={{ 
                    backgroundColor: isSelected ? 'var(--color-primary)' : `${cat.color}15`,
                    color: isSelected ? 'var(--color-accent)' : cat.color 
                  }}
                >
                  <CategoryIcon name={cat.icon} size={22} />
                </div>
                <span className={styles.name}>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
