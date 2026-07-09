'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useTransactionStore } from '../../../store/transactions';
import { useToastStore } from '../../../store/toast';
import { useFeatureAccess } from '../../../hooks/useFeatureAccess';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import CategoryIcon, { CATEGORY_ICONS, CATEGORY_COLORS } from '../../../components/ui/CategoryIcon';
import Card from '../../../components/ui/Card';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import styles from './Categories.module.css';

export default function CategoriesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const { isVip } = useFeatureAccess();
  const { 
    categories, 
    fetchCategories, 
    addCategory, 
    updateCategory, 
    deleteCategory 
  } = useTransactionStore();

  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense');
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(CATEGORY_ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filtered = categories.filter((c) => c.type === activeType && !c.is_archived);

  const handleOpenAdd = () => {
    if (!isVip) {
      showToast(t('customCategoryRequiredVIP'), 'warning');
      router.push('/upgrade');
      return;
    }
    setEditId(null);
    setName('');
    setSelectedIcon(CATEGORY_ICONS[0]);
    setSelectedColor(CATEGORY_COLORS[0]);
    setIsOpen(true);
  };

  const handleOpenEdit = (c: any) => {
    if (c.is_default) {
      showToast('Kategori default bawaan sistem tidak bisa diubah', 'info');
      return;
    }
    setEditId(c.id);
    setName(c.name);
    setSelectedIcon(c.icon);
    setSelectedColor(c.color);
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Nama kategori tidak boleh kosong', 'warning');
      return;
    }

    setSaving(true);
    
    let error = null;

    if (editId) {
      const res = await updateCategory(editId, { name, icon: selectedIcon, color: selectedColor });
      error = res.error;
    } else {
      const res = await addCategory({ name, icon: selectedIcon, color: selectedColor, type: activeType, is_default: false });
      error = res.error;
    }

    setSaving(false);

    if (error) {
      showToast('Gagal menyimpan kategori', 'error');
    } else {
      showToast('Kategori disimpan!', 'success');
      setIsOpen(false);
      fetchCategories();
    }
  };

  const handleDelete = async () => {
    if (!editId) return;

    if (confirm('Apakah Anda yakin ingin menghapus kategori kustom ini?')) {
      setSaving(true);
      const { error } = await deleteCategory(editId);
      setSaving(false);

      if (error) {
        showToast('Gagal menghapus kategori', 'error');
      } else {
        showToast('Kategori dihapus!', 'success');
        setIsOpen(false);
        fetchCategories();
      }
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>{t('categoriesTitle')}</h2>
        <button onClick={handleOpenAdd} className={styles.addBtn} aria-label="add category">
          <Plus size={20} />
        </button>
      </header>

      {/* Switcher expense vs income */}
      <SegmentedControl
        options={[
          { label: t('expense'), value: 'expense' },
          { label: t('income'), value: 'income' },
        ]}
        selectedValue={activeType}
        onChange={(val) => setActiveType(val as 'expense' | 'income')}
        className={styles.segment}
      />

      {/* Categories Grid List */}
      <div className={styles.grid}>
        {filtered.map((c) => (
          <Card 
            key={c.id} 
            onClick={() => handleOpenEdit(c)}
            className={`${styles.item} ${c.is_default ? '' : styles.customItem}`}
            variant="outline"
          >
            <div 
              className={styles.iconCircle}
              style={{ 
                backgroundColor: `${c.color}15`,
                color: c.color 
              }}
            >
              <CategoryIcon name={c.icon} size={20} />
            </div>
            <span className={styles.name}>{c.name}</span>
            {!c.is_default && <span className={styles.customBadge}>Custom</span>}
          </Card>
        ))}
      </div>

      {/* Add / Edit Category Modal */}
      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        title={editId ? t('categoryEditTitle') : t('categoryAddTitle')}
      >
        <form onSubmit={handleSave} className={styles.form}>
          <Input
            label="Nama Kategori"
            placeholder="Jajan Anak, Donasi, Netflix..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={20}
          />

          {/* Color selection row */}
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('categoryColor')}</label>
            <div className={styles.colorsGrid}>
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`${styles.colorChip} ${selectedColor === color ? styles.colorActive : ''}`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>

          {/* Icon selection grid */}
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('categoryIcon')}</label>
            <div className={styles.iconsGrid}>
              {CATEGORY_ICONS.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setSelectedIcon(iconName)}
                  className={`${styles.iconChip} ${selectedIcon === iconName ? styles.iconActive : ''}`}
                  aria-label={`Select icon ${iconName}`}
                >
                  <CategoryIcon name={iconName} size={20} />
                </button>
              ))}
            </div>
          </div>

          {/* Buttons footer */}
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
