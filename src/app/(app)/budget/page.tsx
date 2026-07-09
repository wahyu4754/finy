'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Target, Wallet, PenTool, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useTransactionStore } from '../../../store/transactions';
import { useBudget } from '../../../hooks/useBudget';
import { formatIDR, getCurrentMonth, formatCompact } from '../../../lib/format';
import { useToastStore } from '../../../store/toast';
import Card from '../../../components/ui/Card';
import MonthPicker from '../../../components/ui/MonthPicker';
import ProgressBar from '../../../components/ui/ProgressBar';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import CategoryIcon from '../../../components/ui/CategoryIcon';
import styles from './Budget.module.css';

const PRESET_AMOUNTS = [500000, 1000000, 2000000, 3000000, 5000000, 7500000];

export default function BudgetPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const [month, setMonth] = useState(getCurrentMonth());
  
  const { 
    wallets, 
    categories, 
    fetchWallets, 
    fetchCategories 
  } = useTransactionStore();

  const {
    budgets,
    totalBudget,
    totalSpent,
    spentByWallet,
    spentByCategory,
    walletBudgets,
    categoryBudgets,
    upsertBudget,
    deleteBudget,
    loading
  } = useBudget(month);

  // Modal forms states
  const [isOpen, setIsOpen] = useState(false);
  const [modalType, setModalType] = useState<'total' | 'wallet' | 'category'>('total');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWallets();
    fetchCategories();
  }, [fetchWallets, fetchCategories]);

  const handleOpenEdit = (type: 'total' | 'wallet' | 'category', id: string | null = null, currentVal = 0) => {
    setModalType(type);
    setTargetId(id);
    setAmountStr(String(currentVal));
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseInt(amountStr) || 0;
    if (amountVal <= 0) {
      showToast('Harap masukkan nominal budget yang valid', 'warning');
      return;
    }

    setSaving(true);
    
    const payload = {
      category_id: modalType === 'category' ? targetId : null,
      wallet_id: modalType === 'wallet' ? targetId : null,
      amount: amountVal,
      month
    };

    const { error } = await upsertBudget(payload);
    setSaving(false);

    if (error) {
      showToast('Gagal menyimpan budget', 'error');
    } else {
      showToast('Budget disimpan!', 'success');
      setIsOpen(false);
    }
  };

  const handleDelete = async () => {
    const existing = walletBudgets.find(b => b.wallet_id === targetId) || 
                     categoryBudgets.find(b => b.category_id === targetId) ||
                     (modalType === 'total' ? budgets.find(b => b.category_id === null && b.wallet_id === null) : null);
    
    if (existing) {
      setSaving(true);
      const { error } = await deleteBudget(existing.id);
      setSaving(false);

      if (error) {
        showToast('Gagal menghapus budget', 'error');
      } else {
        showToast('Budget dihapus!', 'success');
        setIsOpen(false);
      }
    }
  };

  const isOverspent = totalSpent > totalBudget && totalBudget > 0;
  const progressPercent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>{t('budgetTitle')}</h2>
        <div style={{ width: 24 }} />
      </header>

      {/* Month Selector */}
      <div className={styles.pickerRow}>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {/* Total Budget Card */}
      <Card 
        onClick={() => handleOpenEdit('total', null, totalBudget)} 
        className={styles.totalCard}
      >
        <div className={styles.totalHeader}>
          <div className={styles.totalInfo}>
            <span className={styles.totalLabel}>{t('budgetTotal')}</span>
            <h3 className={styles.totalAmount}>{formatIDR(totalBudget)}</h3>
          </div>
          <span className={styles.ratioText}>
            <strong>{progressPercent}%</strong> spent
          </span>
        </div>

        <ProgressBar value={totalSpent} max={totalBudget} />

        <div className={styles.totalFooter}>
          <div className={styles.footerLeft}>
            <span>Terpakai: {formatIDR(totalSpent)}</span>
          </div>
          {isOverspent ? (
            <span className={styles.overspentText}>
              <AlertCircle size={12} />
              +{formatIDR(totalSpent - totalBudget)}
            </span>
          ) : (
            <span className={styles.remainingText}>
              Sisa: {formatIDR(totalBudget - totalSpent)}
            </span>
          )}
        </div>
      </Card>

      {/* Wallets Budget Lists */}
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>{t('budgetWallet')}</h4>
        <div className={styles.list}>
          {wallets.map((w) => {
            const b = walletBudgets.find((x) => x.wallet_id === w.id);
            const spent = spentByWallet[w.id] || 0;
            const budget = b?.amount || 0;
            const percent = budget > 0 ? Math.round((spent / budget) * 100) : 0;

            return (
              <Card 
                key={w.id} 
                onClick={() => handleOpenEdit('wallet', w.id, budget)}
                className={styles.item}
                variant="outline"
              >
                <div className={styles.itemHeader}>
                  <div className={styles.itemLeft}>
                    <Wallet size={16} className={styles.itemIcon} />
                    <span className={styles.itemName}>{w.name}</span>
                  </div>
                  <span className={styles.itemRatio}>
                    {budget > 0 ? (
                      <><strong>{formatIDR(spent)}</strong> / {formatIDR(budget)}</>
                    ) : (
                      <span className={styles.setBudgetBtn}>Atur Budget</span>
                    )}
                  </span>
                </div>
                {budget > 0 && <ProgressBar value={spent} max={budget} />}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Categories Budget Lists */}
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>{t('budgetCategory')}</h4>
        <div className={styles.list}>
          {categories.filter(c => c.type === 'expense').map((c) => {
            const b = categoryBudgets.find((x) => x.category_id === c.id);
            const spent = spentByCategory[c.id] || 0;
            const budget = b?.amount || 0;

            return (
              <Card 
                key={c.id} 
                onClick={() => handleOpenEdit('category', c.id, budget)}
                className={styles.item}
                variant="outline"
              >
                <div className={styles.itemHeader}>
                  <div className={styles.itemLeft}>
                    <div 
                      className={styles.catIconCircle}
                      style={{ 
                        backgroundColor: `${c.color}15`,
                        color: c.color 
                      }}
                    >
                      <CategoryIcon name={c.icon} size={14} />
                    </div>
                    <span className={styles.itemName}>{c.name}</span>
                  </div>
                  <span className={styles.itemRatio}>
                    {budget > 0 ? (
                      <><strong>{formatIDR(spent)}</strong> / {formatIDR(budget)}</>
                    ) : (
                      <span className={styles.setBudgetBtn}>Atur Budget</span>
                    )}
                  </span>
                </div>
                {budget > 0 && <ProgressBar value={spent} max={budget} />}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Set Budget Modal */}
      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        title={t('budgetSetTitle')}
      >
        <form onSubmit={handleSave} className={styles.form}>
          <Input
            label="Nominal Budget"
            type="number"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            required
            autoFocus
          />

          {/* Quick preset chips */}
          <div className={styles.presetsGrid}>
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmountStr(String(amt))}
                className={styles.presetChip}
              >
                {formatCompact(amt)}
              </button>
            ))}
          </div>

          <div className={styles.actionButtons}>
            {parseInt(amountStr) > 0 && (
              <Button 
                onClick={handleDelete} 
                variant="danger" 
                loading={saving}
              >
                {t('delete')}
              </Button>
            )}
            
            <Button 
              type="submit" 
              loading={saving}
              fullWidth={parseInt(amountStr) === 0}
            >
              {t('save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
