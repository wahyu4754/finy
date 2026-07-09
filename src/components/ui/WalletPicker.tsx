'use client';

import React from 'react';
import { Wallet as WalletIcon, Building2, Smartphone, Check } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { useTransactionStore } from '../../store/transactions';
import { formatIDR } from '../../lib/format';
import Modal from './Modal';
import styles from './WalletPicker.module.css';

interface WalletPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedId: string;
  onChange: (id: string) => void;
}

const typeIconMap = {
  cash: WalletIcon,
  bank: Building2,
  ewallet: Smartphone,
};

const typeColorMap = {
  cash: '#10B981', // Emerald
  bank: '#3B82F6', // Blue
  ewallet: '#8B5CF6', // Purple
};

export default function WalletPicker({
  isOpen,
  onClose,
  selectedId,
  onChange,
}: WalletPickerProps) {
  const { t } = useTranslation();
  const { wallets } = useTransactionStore();

  const handleSelect = (id: string) => {
    onChange(id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('wallet')}>
      <div className={styles.container}>
        <div className={styles.list}>
          {wallets.map((w) => {
            const Icon = typeIconMap[w.type] || WalletIcon;
            const iconColor = typeColorMap[w.type] || '#6B7280';
            const isSelected = w.id === selectedId;

            return (
              <button
                key={w.id}
                type="button"
                onClick={() => handleSelect(w.id)}
                className={`${styles.item} ${isSelected ? styles.selected : ''}`}
              >
                <div 
                  className={styles.iconCircle}
                  style={{ 
                    backgroundColor: `${iconColor}15`,
                    color: iconColor 
                  }}
                >
                  <Icon size={20} />
                </div>
                
                <div className={styles.info}>
                  <span className={styles.name}>{w.name}</span>
                  <span className={styles.balance}>{formatIDR(w.balance)}</span>
                </div>

                {isSelected && (
                  <Check size={18} className={styles.checkmark} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
