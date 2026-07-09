'use client';

import React, { useState, useEffect } from 'react';
import { Plus, ChevronRight, Receipt, PenTool } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { useTransactionStore } from '../store/transactions';
import { useToastStore } from '../store/toast';
import { formatIDR, getToday } from '../lib/format';
import { suggestCategoryLocal } from '../lib/smartCategory';
import SegmentedControl from './ui/SegmentedControl';
import DatePicker from './ui/DatePicker';
import CategoryPicker from './ui/CategoryPicker';
import WalletPicker from './ui/WalletPicker';
import Button from './ui/Button';
import Input from './ui/Input';
import Modal from './ui/Modal';
import styles from '../app/(app)/transaction/new/NewTransaction.module.css';

export default function NewTransactionModal() {
  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const { 
    wallets, 
    categories, 
    addTransaction, 
    updateTransaction,
    transactions,
    fetchWallets,
    fetchCategories,
    isAddTxOpen,
    setAddTxOpen,
    editTxId,
    setEditTxId
  } = useTransactionStore();

  // Form State
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState('0');
  const [categoryId, setCategoryId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [date, setDate] = useState(getToday());
  const [note, setNote] = useState('');
  const [showNoteField, setShowNoteField] = useState(false);

  // Modals Visibility
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset/Init selections when modal opens or editId changes
  useEffect(() => {
    if (isAddTxOpen) {
      fetchWallets();
      fetchCategories();
      
      if (editTxId) {
        const tx = transactions.find(t => t.id === editTxId);
        if (tx) {
          setType(tx.type);
          setAmountStr(String(tx.amount));
          setCategoryId(tx.category_id);
          setWalletId(tx.wallet_id);
          setDate(tx.transaction_date);
          setNote(tx.note);
          setShowNoteField(!!tx.note);
        }
      } else {
        // Reset to default
        setType('expense');
        setAmountStr('0');
        setCategoryId('');
        setDate(getToday());
        setNote('');
        setShowNoteField(false);
        
        if (wallets.length > 0) {
          const def = wallets.find(w => w.is_default) || wallets[0];
          setWalletId(def.id);
        }
      }
    }
  }, [isAddTxOpen, editTxId, transactions, fetchWallets, fetchCategories]);

  // Set default wallet if list loads and none is selected
  useEffect(() => {
    if (isAddTxOpen && wallets.length > 0 && !walletId) {
      const def = wallets.find(w => w.is_default) || wallets[0];
      setWalletId(def.id);
    }
  }, [isAddTxOpen, wallets, walletId]);

  // Handle local AI category suggestion based on note text
  useEffect(() => {
    if (isAddTxOpen && type === 'expense' && note && categories.length > 0 && !categoryId) {
      const suggestion = suggestCategoryLocal(note, categories, 'expense');
      if (suggestion) {
        setCategoryId(suggestion.id);
        showToast(`Ikon disarankan: ${suggestion.name}`, 'info');
      }
    }
  }, [note, type, categories, categoryId, showToast, isAddTxOpen]);

  const handleKeyPress = (val: string) => {
    if (amountStr === '0' && val !== '000') {
      setAmountStr(val);
    } else {
      setAmountStr(prev => prev + val);
    }
  };

  const handleBackspace = () => {
    if (amountStr.length <= 1) {
      setAmountStr('0');
    } else {
      setAmountStr(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setAmountStr('0');
  };

  const handleSave = async () => {
    const amountVal = parseInt(amountStr);
    if (amountVal <= 0) {
      showToast('Harap masukkan jumlah transaksi yang valid', 'warning');
      return;
    }
    if (!categoryId) {
      showToast('Harap pilih kategori', 'warning');
      return;
    }
    if (!walletId) {
      showToast('Harap pilih dompet', 'warning');
      return;
    }

    setLoading(true);

    const payload = {
      amount: amountVal,
      type,
      category_id: categoryId,
      wallet_id: walletId,
      transaction_date: date,
      note,
      is_recurring: false,
      created_by_ai: false
    };

    let error = null;

    if (editTxId) {
      const res = await updateTransaction(editTxId, payload);
      error = res.error;
    } else {
      const res = await addTransaction(payload);
      error = res.error;
    }

    setLoading(false);

    if (error) {
      showToast('Gagal mencatat transaksi. Coba lagi.', 'error');
    } else {
      showToast(editTxId ? 'Transaksi diperbarui!' : 'Transaksi berhasil dicatat!', 'success');
      handleClose();
    }
  };

  const handleClose = () => {
    setAddTxOpen(false);
    setEditTxId(null);
  };

  if (!isAddTxOpen) return null;

  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedWallet = wallets.find(w => w.id === walletId);

  return (
    <Modal 
      isOpen={isAddTxOpen} 
      onClose={handleClose} 
      title={editTxId ? 'Edit Transaksi' : 'Transaksi Baru'}
    >
      <div>
        {/* Switcher expense vs income */}
        <SegmentedControl
          options={[
            { label: t('expense'), value: 'expense' },
            { label: t('income'), value: 'income' },
          ]}
          selectedValue={type}
          onChange={(val) => setType(val as 'expense' | 'income')}
          className={styles.segment}
        />

        {/* Display numeric input */}
        <div className={styles.amountContainer}>
          <span className={styles.currency}>Rp</span>
          <span className={styles.amountText}>
            {new Intl.NumberFormat('id-ID').format(parseInt(amountStr))}
          </span>
        </div>

        {/* Detail Input Row Cards */}
        <div className={styles.formGrid}>
          {/* Category Picker Card */}
          <button 
            onClick={() => setShowCatPicker(true)} 
            className={styles.pickerRow}
            type="button"
          >
            <div className={styles.pickerLeft}>
              <div 
                className={styles.iconCircle}
                style={{
                  backgroundColor: selectedCategory ? `${selectedCategory.color}15` : 'var(--color-border-subtle)',
                  color: selectedCategory ? selectedCategory.color : 'var(--color-ink-muted)'
                }}
              >
                <PenTool size={18} />
              </div>
              <span className={styles.pickerLabel}>
                {selectedCategory ? selectedCategory.name : t('category')}
              </span>
            </div>
            <ChevronRight size={16} className={styles.chevron} />
          </button>

          {/* Wallet Picker Card */}
          <button 
            onClick={() => setShowWalletPicker(true)} 
            className={styles.pickerRow}
            type="button"
          >
            <div className={styles.pickerLeft}>
              <div className={styles.iconCircle}>
                <Receipt size={18} />
              </div>
              <span className={styles.pickerLabel}>
                {selectedWallet ? selectedWallet.name : t('wallet')}
              </span>
            </div>
            <ChevronRight size={16} className={styles.chevron} />
          </button>

          {/* Date Picker */}
          <DatePicker 
            value={date} 
            onChange={setDate} 
          />

          {/* Dynamic Note Entry */}
          {showNoteField ? (
            <Input
              label={t('note')}
              type="text"
              placeholder="Makan siang di kantor..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          ) : (
            <button 
              type="button"
              onClick={() => setShowNoteField(true)}
              className={styles.addNoteChip}
            >
              <Plus size={14} /> {t('note')}
            </button>
          )}
        </div>

        {/* Floating Keypad numpad */}
        <div className={styles.stickyKeypadContainer}>
          <div className={styles.keypad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button 
                key={num} 
                type="button" 
                onClick={() => handleKeyPress(num)}
                className={styles.key}
              >
                {num}
              </button>
            ))}
            <button type="button" onClick={handleClear} className={styles.keyClear}>
              C
            </button>
            <button type="button" onClick={() => handleKeyPress('0')} className={styles.key}>
              0
            </button>
            <button type="button" onClick={handleBackspace} className={styles.keyBackspace} aria-label="backspace">
              ←
            </button>
          </div>

          {/* Save button CTA */}
          <Button 
            onClick={handleSave} 
            loading={loading}
            fullWidth
            className={styles.saveBtn}
          >
            {t('save')}
          </Button>
        </div>

        {/* Picker Modals */}
        <CategoryPicker
          isOpen={showCatPicker}
          onClose={() => setShowCatPicker(false)}
          selectedId={categoryId}
          onChange={setCategoryId}
        />

        <WalletPicker
          isOpen={showWalletPicker}
          onClose={() => setShowWalletPicker(false)}
          selectedId={walletId}
          onChange={setWalletId}
        />
      </div>
    </Modal>
  );
}
