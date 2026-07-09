'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Star, Trash2, Smartphone, Building2, Wallet as WalletIcon } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useTransactionStore } from '../../../store/transactions';
import { useToastStore } from '../../../store/toast';
import { formatIDR } from '../../../lib/format';
import { WalletType, Wallet } from '../../../types';
import Card from '../../../components/ui/Card';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import styles from './Wallets.module.css';

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

export default function WalletsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const { 
    wallets, 
    fetchWallets, 
    addWallet, 
    updateWallet, 
    deleteWallet, 
    loading 
  } = useTransactionStore();

  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletType>('cash');
  const [balanceStr, setBalanceStr] = useState('0');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const handleOpenAdd = () => {
    setEditId(null);
    setName('');
    setType('cash');
    setBalanceStr('0');
    setIsDefault(wallets.length === 0); // Force default if it's the first wallet
    setIsOpen(true);
  };

  const handleOpenEdit = (w: Wallet) => {
    setEditId(w.id);
    setName(w.name);
    setType(w.type);
    setBalanceStr(String(w.balance));
    setIsDefault(w.is_default);
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Nama dompet tidak boleh kosong', 'warning');
      return;
    }

    setSaving(true);
    const balance = parseInt(balanceStr) || 0;

    let error = null;

    if (editId) {
      const res = await updateWallet(editId, { name, type, is_default: isDefault });
      error = res.error;
    } else {
      const res = await addWallet({ name, type, balance, is_default: isDefault });
      error = res.error;
    }

    // If setting as default, update other wallets defaults locally
    if (isDefault && !error) {
      for (const w of wallets) {
        if (w.id !== editId && w.is_default) {
          await updateWallet(w.id, { is_default: false });
        }
      }
    }

    setSaving(false);
    if (error) {
      showToast('Gagal menyimpan dompet', 'error');
    } else {
      showToast('Dompet disimpan!', 'success');
      setIsOpen(false);
      fetchWallets();
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    
    // Check default wallet
    const current = wallets.find(w => w.id === editId);
    if (current?.is_default && wallets.length > 1) {
      showToast('Tidak bisa menghapus dompet utama. Harap atur dompet lain sebagai utama terlebih dahulu.', 'warning');
      return;
    }

    if (confirm(t('walletDeleteConfirm'))) {
      setSaving(true);
      const { error } = await deleteWallet(editId);
      setSaving(false);

      if (error) {
        showToast('Gagal menghapus dompet', 'error');
      } else {
        showToast('Dompet dihapus!', 'success');
        setIsOpen(false);
        fetchWallets();
      }
    }
  };

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>{t('walletManageTitle')}</h2>
        <button onClick={handleOpenAdd} className={styles.addBtn} aria-label="add wallet">
          <Plus size={20} />
        </button>
      </header>

      {/* Aggregate Wallet Balance Header */}
      <Card variant="glass" className={styles.totalCard}>
        <span className={styles.totalLabel}>{t('totalBalance')}</span>
        <h3 className={styles.totalBalance}>{formatIDR(totalBalance)}</h3>
        <span className={styles.walletCount}>
          {wallets.length} Dompet aktif
        </span>
      </Card>

      {/* Wallets List Grid */}
      <div className={styles.list}>
        {wallets.map((w) => {
          const Icon = typeIconMap[w.type] || WalletIcon;
          const color = typeColorMap[w.type] || '#6B7280';
          
          return (
            <Card 
              key={w.id} 
              onClick={() => handleOpenEdit(w)}
              className={styles.walletItem}
              variant="outline"
            >
              <div 
                className={styles.iconCircle}
                style={{ 
                  backgroundColor: `${color}15`,
                  color: color 
                }}
              >
                <Icon size={20} />
              </div>
              
              <div className={styles.info}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{w.name}</span>
                  {w.is_default && (
                    <span className={styles.starBadge} aria-label="default wallet">
                      <Star size={10} fill="currentColor" />
                    </span>
                  )}
                </div>
                <span className={styles.typeLabel}>
                  {t(`walletType${w.type.charAt(0).toUpperCase() + w.type.slice(1)}` as any)}
                </span>
              </div>

              <span className={styles.balance}>{formatIDR(w.balance)}</span>
            </Card>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        title={editId ? t('walletEditTitle') : t('walletAddTitle')}
      >
        <form onSubmit={handleSave} className={styles.form}>
          <Input
            label="Nama Dompet"
            placeholder="Dompet Utama, BCA, GoPay..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={24}
          />

          <div className={styles.formGroup}>
            <label className={styles.label}>Tipe Dompet</label>
            <SegmentedControl
              options={[
                { label: t('walletTypeCash'), value: 'cash' },
                { label: 'Bank', value: 'bank' },
                { label: 'E-Wallet', value: 'ewallet' },
              ]}
              selectedValue={type}
              onChange={(val) => setType(val as WalletType)}
            />
          </div>

          {!editId && (
            <Input
              label={t('walletInitialBalance')}
              type="number"
              value={balanceStr}
              onChange={(e) => setBalanceStr(e.target.value)}
              required
            />
          )}

          <div className={styles.toggleRow}>
            <div className={styles.toggleText}>
              <span className={styles.toggleTitle}>{t('walletSetDefault')}</span>
              <p className={styles.toggleDesc}>Gunakan dompet ini secara otomatis saat mencatat transaksi baru.</p>
            </div>
            <input 
              type="checkbox" 
              checked={isDefault}
              disabled={editId ? (wallets.find(w => w.id === editId)?.is_default && wallets.length > 1) : false}
              onChange={(e) => setIsDefault(e.target.checked)}
              className={styles.checkbox}
            />
          </div>

          <div className={styles.actionButtons}>
            {editId && (
              <Button 
                onClick={handleDelete} 
                variant="danger" 
                loading={saving}
                icon={<Trash2 size={16} />}
              >
                {t('delete')}
              </Button>
            )}
            
            <Button 
              type="submit" 
              loading={saving}
              fullWidth={!editId}
            >
              {t('save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
