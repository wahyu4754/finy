'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileSpreadsheet, FileText, Download, CheckCircle } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import { useTransactionStore } from '../../../store/transactions';
import { useToastStore } from '../../../store/toast';
import { formatIDR, getCurrentMonth } from '../../../lib/format';
import MonthPicker from '../../../components/ui/MonthPicker';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import styles from './Export.module.css';

export default function ExportPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToastStore();
  const { transactions, fetchTransactions } = useTransactionStore();

  const [month, setMonth] = useState(getCurrentMonth());
  const [formatType, setFormatType] = useState<'csv' | 'pdf'>('csv');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchTransactions(month);
  }, [month, fetchTransactions]);

  const handleExport = () => {
    if (transactions.length === 0) {
      showToast('Tidak ada transaksi untuk diekspor pada bulan ini.', 'warning');
      return;
    }

    setExporting(true);

    // Simulate exporting delay
    setTimeout(() => {
      if (formatType === 'csv') {
        exportToCSV();
      } else {
        exportToPDFMock();
      }
      setExporting(false);
    }, 1500);
  };

  const exportToCSV = () => {
    // Generate CSV Header & rows
    const headers = ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Dompet', 'Nominal', 'Catatan'];
    const rows = transactions.map((tx) => [
      tx.id,
      tx.transaction_date,
      tx.type === 'expense' ? 'Pengeluaran' : 'Pemasukan',
      tx.category?.name || 'Lainnya',
      tx.wallet?.name || 'Dompet',
      tx.amount,
      `"${tx.note.replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    // Create file blob & download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Finy_Laporan_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(t('exportSuccess'), 'success');
  };

  const exportToPDFMock = () => {
    // PDF generation placeholder (simulate file download for testing)
    const mockPDF = '%PDF-1.5 MOCK FILE CONTENT FOR FINY REPORT';
    const blob = new Blob([mockPDF], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Finy_Laporan_${month}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Laporan PDF berhasil diunduh.', 'success');
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>{t('exportTitle')}</h2>
        <div style={{ width: 24 }} />
      </header>

      {/* Month Selector */}
      <div className={styles.pickerRow}>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <div className={styles.infoCard}>
        <span className={styles.infoLabel}>Jumlah Transaksi</span>
        <h3 className={styles.infoValue}>{transactions.length} baris data</h3>
      </div>

      {/* Format Selector Grid */}
      <div className={styles.formatSection}>
        <h4 className={styles.formatLabel}>{t('exportFormat')}</h4>
        
        <div className={styles.formatGrid}>
          {/* CSV Option */}
          <Card
            onClick={() => setFormatType('csv')}
            className={`${styles.formatCard} ${formatType === 'csv' ? styles.formatActive : ''}`}
            variant="outline"
          >
            <FileSpreadsheet size={32} className={styles.csvIcon} />
            <span className={styles.formatName}>Spreadsheet (CSV)</span>
            <p className={styles.formatDesc}>Format tabel data murni, cocok dibuka di Excel & Google Sheets.</p>
          </Card>

          {/* PDF Option */}
          <Card
            onClick={() => setFormatType('pdf')}
            className={`${styles.formatCard} ${formatType === 'pdf' ? styles.formatActive : ''}`}
            variant="outline"
          >
            <FileText size={32} className={styles.pdfIcon} />
            <span className={styles.formatName}>Dokumen (PDF)</span>
            <p className={styles.formatDesc}>Laporan bergaya cetak rapi dengan ringkasan visual bulanan.</p>
          </Card>
        </div>
      </div>

      {/* CTA Button */}
      <Button
        onClick={handleExport}
        loading={exporting}
        disabled={transactions.length === 0}
        icon={<Download size={18} />}
        fullWidth
        className={styles.exportBtn}
      >
        {t('exportBtn')}
      </Button>
    </div>
  );
}
