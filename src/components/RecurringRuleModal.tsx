'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, PenTool, Receipt, Repeat } from 'lucide-react';
import { useRecurringStore } from '../store/recurring';
import { useTransactionStore } from '../store/transactions';
import { useToastStore } from '../store/toast';
import { formatIDR, formatDate, getToday } from '../lib/format';
import {
  FREQUENCY_OPTIONS,
  MAX_DAY_OF_MONTH,
  describeSchedule,
  nextOccurrence,
  scheduleFromStartDate,
} from '../lib/recurring';
import { RecurringFrequency, RecurringRule, TransactionType } from '../types';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Button from './ui/Button';
import DatePicker from './ui/DatePicker';
import SegmentedControl from './ui/SegmentedControl';
import CategoryPicker from './ui/CategoryPicker';
import WalletPicker from './ui/WalletPicker';
import styles from './RecurringRuleModal.module.css';

interface RecurringRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Omit to create a new rule. */
  rule?: RecurringRule | null;
}

export default function RecurringRuleModal({ isOpen, onClose, rule }: RecurringRuleModalProps) {
  const { showToast } = useToastStore();
  const { addRule, updateRule } = useRecurringStore();
  const { wallets, categories, fetchWallets, fetchCategories } = useTransactionStore();

  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [startDate, setStartDate] = useState(getToday());
  const [saving, setSaving] = useState(false);

  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);

  const isEdit = !!rule;

  useEffect(() => {
    if (!isOpen) return;

    fetchWallets();
    fetchCategories();

    if (rule) {
      setType(rule.type);
      setAmountStr(String(rule.amount));
      setNote(rule.note ?? '');
      setCategoryId(rule.category_id ?? '');
      setWalletId(rule.wallet_id ?? '');
      setFrequency(rule.frequency);
      setStartDate(rule.next_due_date);
      return;
    }

    setType('expense');
    setAmountStr('');
    setNote('');
    setCategoryId('');
    setFrequency('monthly');
    setStartDate(getToday());

    const preferred = wallets.find((w) => w.is_default) ?? wallets[0];
    setWalletId(preferred?.id ?? '');
    // `wallets` is read from the store rather than passed as a dependency: this only
    // seeds the create form once, and re-running it would discard the user's choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, rule]);

  // A category belonging to the other type would be rejected by the picker's own
  // filter, so drop it when the user flips expense/income.
  useEffect(() => {
    if (!categoryId || categories.length === 0) return;
    const cat = categories.find((c) => c.id === categoryId);
    if (cat && cat.type !== type) setCategoryId('');
  }, [type, categoryId, categories]);

  useEffect(() => {
    if (!walletId || wallets.length === 0) return;
    if (!wallets.some((w) => w.id === walletId)) setWalletId('');
  }, [wallets, walletId]);

  const schedule = useMemo(
    () => scheduleFromStartDate(startDate, frequency),
    [startDate, frequency]
  );

  const amount = Number.parseInt(amountStr, 10) || 0;
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedWallet = wallets.find((w) => w.id === walletId);
  const dayWasClamped =
    frequency === 'monthly' && Number.parseInt(startDate.slice(8), 10) > MAX_DAY_OF_MONTH;

  const followingOccurrence = nextOccurrence(
    schedule.next_due_date,
    frequency,
    schedule.day_of_month
  );

  // A start date in the past is allowed on purpose — that is how a user records a
  // bill they forgot — but the daily cron will then post it, so say so up front
  // instead of letting a transaction appear out of nowhere.
  const postsImmediately = schedule.next_due_date <= getToday();

  const handleSave = async () => {
    if (amount <= 0) {
      showToast('Masukkan nominal yang valid', 'warning');
      return;
    }
    if (!categoryId) {
      showToast('Pilih kategori terlebih dahulu', 'warning');
      return;
    }
    if (!walletId) {
      showToast('Pilih dompet terlebih dahulu', 'warning');
      return;
    }
    if (!schedule.next_due_date) {
      showToast('Pilih tanggal mulai', 'warning');
      return;
    }

    setSaving(true);
    const payload = {
      amount,
      type,
      category_id: categoryId,
      wallet_id: walletId,
      note: note.trim(),
      frequency,
      day_of_month: schedule.day_of_month,
      next_due_date: schedule.next_due_date,
    };

    const { error } = isEdit
      ? await updateRule(rule!.id, payload)
      : await addRule(payload);
    setSaving(false);

    if (error) {
      // RLS rejects non-Pro inserts/updates with a generic permission error, which is
      // the only way this form can fail for a member whose Pro just lapsed.
      showToast('Gagal menyimpan. Periksa status Finy Pro Anda lalu coba lagi.', 'error');
      return;
    }

    showToast(isEdit ? 'Perubahan disimpan' : 'Transaksi berulang dibuat', 'success');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Transaksi Berulang' : 'Transaksi Berulang Baru'}>
      <div className={styles.form}>
        <SegmentedControl
          options={[
            { label: 'Pengeluaran', value: 'expense' },
            { label: 'Pemasukan', value: 'income' },
          ]}
          selectedValue={type}
          onChange={(val) => setType(val as TransactionType)}
        />

        <Input
          label="Nominal"
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value.replace(/\D/g, ''))}
          leftIcon={<span className={styles.rp}>Rp</span>}
        />

        <Input
          label="Keterangan"
          type="text"
          placeholder="Listrik, internet, gaji…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className={styles.pickerGroup}>
          <button type="button" onClick={() => setShowCatPicker(true)} className={styles.pickerRow}>
            <div className={styles.pickerLeft}>
              <div
                className={styles.iconCircle}
                style={{
                  backgroundColor: selectedCategory ? `${selectedCategory.color}15` : 'var(--color-border-subtle)',
                  color: selectedCategory ? selectedCategory.color : 'var(--color-ink-muted)',
                }}
              >
                <PenTool size={16} />
              </div>
              <span className={styles.pickerLabel}>{selectedCategory ? selectedCategory.name : 'Kategori'}</span>
            </div>
            <ChevronRight size={16} className={styles.chevron} />
          </button>

          <button type="button" onClick={() => setShowWalletPicker(true)} className={styles.pickerRow}>
            <div className={styles.pickerLeft}>
              <div className={styles.iconCircle}>
                <Receipt size={16} />
              </div>
              <span className={styles.pickerLabel}>{selectedWallet ? selectedWallet.name : 'Dompet'}</span>
            </div>
            <ChevronRight size={16} className={styles.chevron} />
          </button>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.label}>Frekuensi</span>
          <SegmentedControl
            options={FREQUENCY_OPTIONS}
            selectedValue={frequency}
            onChange={(val) => setFrequency(val as RecurringFrequency)}
          />
        </div>

        <DatePicker
          label={isEdit ? 'Jatuh tempo berikutnya' : 'Mulai tanggal'}
          value={startDate}
          onChange={setStartDate}
        />

        {dayWasClamped && (
          <p className={styles.hint}>
            Tanggal di atas {MAX_DAY_OF_MONTH} disesuaikan ke {MAX_DAY_OF_MONTH} supaya tetap ada di setiap bulan.
          </p>
        )}

        <div className={styles.preview}>
          <Repeat size={14} />
          <span>
            {describeSchedule({
              frequency,
              day_of_month: schedule.day_of_month,
              next_due_date: schedule.next_due_date,
            })}
            {' · mulai '}
            {formatDate(schedule.next_due_date)}
            {' · lalu '}
            {formatDate(followingOccurrence)}
          </span>
        </div>

        {postsImmediately && (
          <p className={styles.hint}>
            Tanggal mulai sudah lewat, jadi transaksi ini akan langsung dicatat pada proses
            otomatis berikutnya.
          </p>
        )}

        {amount > 0 && (
          <p className={styles.amountPreview}>
            {type === 'expense' ? '-' : '+'}{formatIDR(amount)} setiap periode
          </p>
        )}

        <Button onClick={handleSave} loading={saving} fullWidth>
          {isEdit ? 'Simpan Perubahan' : 'Buat Aturan'}
        </Button>
      </div>

      <CategoryPicker
        isOpen={showCatPicker}
        onClose={() => setShowCatPicker(false)}
        selectedId={categoryId}
        onChange={setCategoryId}
        type={type}
      />

      <WalletPicker
        isOpen={showWalletPicker}
        onClose={() => setShowWalletPicker(false)}
        selectedId={walletId}
        onChange={setWalletId}
      />
    </Modal>
  );
}
