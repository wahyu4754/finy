'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Crown, Pencil, Trash2, Repeat, CalendarClock, Undo2, Info,
} from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useFeatureAccess } from '../../../hooks/useFeatureAccess';
import { useRecurringStore } from '../../../store/recurring';
import { useToastStore } from '../../../store/toast';
import { formatIDR, formatDate } from '../../../lib/format';
import { describeSchedule } from '../../../lib/recurring';
import RecurringRuleModal from '../../../components/RecurringRuleModal';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import styles from './Recurring.module.css';

export default function RecurringPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const { isVip } = useFeatureAccess();
  const {
    rules, fetchRules, toggleRule, deleteRule,
    autoPosted, fetchAutoPosted, undoAutoPosted,
    loading,
  } = useRecurringStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<null | (typeof rules)[number]>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchRules();
    fetchAutoPosted();
  }, [fetchRules, fetchAutoPosted]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (rule: (typeof rules)[number]) => {
    setEditing(rule);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus aturan berulang ini? Transaksi yang sudah tercatat tidak ikut terhapus.')) return;

    setBusyId(id);
    const { error } = await deleteRule(id);
    setBusyId(null);
    showToast(error ? 'Gagal menghapus aturan' : 'Aturan dihapus', error ? 'error' : 'success');
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const { error } = await toggleRule(id, !currentStatus);
    if (error) showToast('Gagal memperbarui aturan', 'error');
  };

  const handleUndo = async (id: string) => {
    setBusyId(id);
    const { error } = await undoAutoPosted(id);
    setBusyId(null);
    showToast(
      error ? 'Gagal membatalkan transaksi' : 'Transaksi rutin dibatalkan',
      error ? 'error' : 'success'
    );
  };

  // A lapsed member keeps read access to the rules they made — silently hiding them
  // would look like data loss — but can't add or change anything.
  if (!isVip) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.title}>Transaksi Berulang</h2>
          <div style={{ width: 20 }} />
        </header>

        <div className={styles.lockHero}>
          <div className={styles.lockCircle}>
            <Crown size={28} />
          </div>
          <h3 className={styles.lockTitle}>Fitur Finy Pro</h3>
          <p className={styles.lockSubtitle}>
            Tagihan listrik, internet, sewa, sampai gaji bulanan dicatat otomatis setiap
            jatuh tempo — tanpa perlu membuka aplikasi.
          </p>

          {rules.length > 0 && (
            <div className={styles.list}>
              {rules.map((rule) => (
                <Card key={rule.id} className={styles.item} variant="outline">
                  <div className={styles.itemLeft}>
                    <Repeat size={16} className={styles.clockIcon} />
                    <div>
                      <span className={styles.itemName}>{rule.note || 'Transaksi rutin'}</span>
                      <span className={styles.itemDesc}>
                        {describeSchedule(rule)} · {formatIDR(rule.amount)}
                      </span>
                    </div>
                  </div>
                  <span className={styles.pausedBadge}>Nonaktif</span>
                </Card>
              ))}
            </div>
          )}

          <Button onClick={() => router.push('/upgrade')} className={styles.upgradeBtn} icon={<Crown size={16} />}>
            Upgrade ke Finy Pro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Transaksi Berulang</h2>
        <button onClick={openCreate} className={styles.addBtn} aria-label="Tambah aturan" type="button">
          <Plus size={20} />
        </button>
      </header>

      <div className={styles.infoStrip}>
        <Info size={13} />
        <span>
          Aturan yang jatuh tempo dicatat otomatis setiap hari pukul 07:05 WIB. Anda bisa
          membatalkannya dari sini maupun dari Beranda.
        </span>
      </div>

      {/* Recently auto-posted, with undo */}
      {autoPosted.length > 0 && (
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>Baru dicatat otomatis</h4>
          <div className={styles.list}>
            {autoPosted.map((tx) => (
              <Card key={tx.id} className={styles.item} variant="outline">
                <div className={styles.itemLeft}>
                  <CalendarClock size={16} className={styles.clockIcon} />
                  <div>
                    <span className={styles.itemName}>{tx.category?.name || tx.note || 'Transaksi rutin'}</span>
                    <span className={styles.itemDesc}>
                      {formatDate(tx.transaction_date)} · {tx.wallet?.name || 'Dompet'}
                    </span>
                  </div>
                </div>

                <div className={styles.itemRight}>
                  <span className={`${styles.itemAmount} ${tx.type === 'expense' ? styles.expense : styles.income}`}>
                    {tx.type === 'expense' ? '-' : '+'}{formatIDR(tx.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUndo(tx.id)}
                    disabled={busyId === tx.id}
                    className={styles.iconBtn}
                    aria-label="Batalkan transaksi"
                  >
                    <Undo2 size={15} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Rules list */}
      <section className={styles.block}>
        <h4 className={styles.blockTitle}>Aturan Anda</h4>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.loading}>{t('loading')}</div>
          ) : rules.length === 0 ? (
            <EmptyState
              title="Belum ada transaksi berulang"
              description="Atur pengeluaran rutin seperti tagihan bulanan agar dicatat otomatis setiap jatuh tempo."
              icon={<Repeat size={24} />}
              actionText="Buat Aturan"
              onActionClick={openCreate}
            />
          ) : (
            rules.map((rule) => {
              const isExpense = rule.type === 'expense';
              return (
                <Card key={rule.id} className={styles.item} variant="outline">
                  <div className={styles.itemMain}>
                    <div className={styles.itemLeft}>
                      <Repeat size={16} className={styles.clockIcon} />
                      <div className={styles.itemText}>
                        <span className={`${styles.itemName} ${rule.is_active ? '' : styles.muted}`}>
                          {rule.note || 'Transaksi rutin'}
                        </span>
                        <span className={styles.itemDesc}>
                          {describeSchedule(rule)} · berikutnya {formatDate(rule.next_due_date)}
                        </span>
                        <span className={styles.itemWallet}>
                          {rule.wallet?.name || 'Dompet dihapus'}
                          {rule.category?.name ? ` · ${rule.category.name}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className={styles.itemRight}>
                      <span className={`${styles.itemAmount} ${isExpense ? styles.expense : styles.income}`}>
                        {isExpense ? '-' : '+'}{formatIDR(rule.amount)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.itemActions}>
                    <label className={styles.toggleLabel}>
                      <input
                        type="checkbox"
                        checked={rule.is_active}
                        onChange={() => handleToggle(rule.id, rule.is_active)}
                        className={styles.checkbox}
                      />
                      <span>{rule.is_active ? 'Aktif' : 'Dijeda'}</span>
                    </label>

                    <div className={styles.actionBtns}>
                      <button
                        type="button"
                        onClick={() => openEdit(rule)}
                        className={styles.iconBtn}
                        aria-label="Edit aturan"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        disabled={busyId === rule.id}
                        className={`${styles.iconBtn} ${styles.dangerBtn}`}
                        aria-label="Hapus aturan"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>

      <RecurringRuleModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        rule={editing}
      />
    </div>
  );
}
