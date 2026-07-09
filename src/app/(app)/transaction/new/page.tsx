'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, X, ChevronRight, Sparkles, Receipt, PenTool } from 'lucide-react';
import { useTranslation } from '../../../../lib/i18n';
import { useTransactionStore } from '../../../../store/transactions';
import { useToastStore } from '../../../../store/toast';
import { formatIDR, getToday } from '../../../../lib/format';
import { suggestCategoryLocal } from '../../../../lib/smartCategory';
import SegmentedControl from '../../../../components/ui/SegmentedControl';
import DatePicker from '../../../../components/ui/DatePicker';
import CategoryPicker from '../../../../components/ui/CategoryPicker';
import WalletPicker from '../../../../components/ui/WalletPicker';
import Button from '../../../../components/ui/Button';
import Card from '../../../../components/ui/Card';
import Input from '../../../../components/ui/Input';
import styles from './NewTransaction.module.css';

export default function NewTransactionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');
  const prefillNote = searchParams.get('prefillNote') || '';
  const prefillAmount = searchParams.get('prefillAmount') || '0';
  const prefillCategory = searchParams.get('prefillCategory') || '';
  const prefillDate = searchParams.get('prefillDate') || getToday();

  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const { 
    wallets, 
    categories, 
    addTransaction, 
    updateTransaction,
    transactions,
    fetchWallets,
    fetchCategories
  } = useTransactionStore();

  // Form State
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState(prefillAmount);
  const [categoryId, setCategoryId] = useState(prefillCategory);
  const [walletId, setWalletId] = useState('');
  const [date, setDate] = useState(prefillDate);
  const [note, setNote] = useState(prefillNote);
  const [showNoteField, setShowNoteField] = useState(!!prefillNote);

  // Modals Visibility
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Init selections
  useEffect(() => {
    fetchWallets();
    fetchCategories();
  }, [fetchWallets, fetchCategories]);

  // Set default wallet
  useEffect(() => {
    if (wallets.length > 0 && !walletId) {
      const def = wallets.find(w => w.is_default) || wallets[0];
      setWalletId(def.id);
    }
  }, [wallets, walletId]);

  // If in edit mode, populate form values
  useEffect(() => {
    if (editId) {
      const tx = transactions.find(t => t.id === editId);
      if (tx) {
        setType(tx.type);
        setAmountStr(String(tx.amount));
        setCategoryId(tx.category_id);
        setWalletId(tx.wallet_id);
        setDate(tx.transaction_date);
        setNote(tx.note);
        setShowNoteField(!!tx.note);
      }
    }
  }, [editId, transactions]);

  // Handle local AI category suggestion based on note text
  useEffect(() => {
    if (type === 'expense' && note && categories.length > 0 && !categoryId) {
      const suggestion = suggestCategoryLocal(note, categories, 'expense');
      if (suggestion) {
        setCategoryId(suggestion.id);
        showToast(`Ikon disarankan: ${suggestion.name}`, 'info');
      }
    }
  }, [note, type, categories, categoryId, showToast]);

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

    if (editId) {
      const res = await updateTransaction(editId, payload);
      error = res.error;
    } else {
      const res = await addTransaction(payload);
      error = res.error;
    }

    setLoading(false);

    if (error) {
      showToast('Gagal mencatat transaksi. Coba lagi.', 'error');
    } else {
      showToast(editId ? 'Transaksi diperbarui!' : 'Transaksi berhasil dicatat!', 'success');
      router.replace('/home');
    }
  };

  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedWallet = wallets.find(w => w.id === walletId);

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <X size={20} />
        </button>
        <h2 className={styles.title}>
          {editId ? 'Edit Transaksi' : 'Transaksi Baru'}
        </h2>
        <div style={{ width: 24 }} />
      </header>

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
      <div className={styles.keypadContainer}>
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
  );
}
