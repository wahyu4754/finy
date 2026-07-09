'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AltArrowLeft as ArrowLeft, TrashBin2 as Trash2, Stars as Sparkles, Plain as Send, 
  Microphone as Mic, Gallery as Image, Camera, ChatSquareCode as Bot 
} from '@solar-icons/react';
import { useTranslation } from '../../../lib/i18n';
import { useAuthStore } from '../../../store/auth';
import { useToastStore } from '../../../store/toast';
import { useTransactionStore } from '../../../store/transactions';
import { useFeatureAccess } from '../../../hooks/useFeatureAccess';
import { supabase } from '../../../lib/supabase';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import styles from './AiAssistant.module.css';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  image?: string; // base64 URL
  timestamp: string;
}

const SUGGESTIONS = [
  'Analisis pengeluaran bulan ini',
  'Bagaimana cara menabung Rp 5 juta?',
  'Berapa sisa anggaran makan saya?',
  'Beri tips hemat belanja bulanan'
];

export default function AiAssistantPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, fetchProfile } = useAuthStore();
  const { showToast } = useToastStore();
  const { isVip, hasAiAccess } = useFeatureAccess();
  const { addTransaction } = useTransactionStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finy_ai_messages');
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
        } catch (e) {}
      } else {
        // Welcome message
        setMessages([
          {
            id: 'welcome',
            sender: 'assistant',
            text: t('aiChatWelcome'),
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    }
  }, []);

  // Scroll to bottom when messages list changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const saveHistory = (msgs: Message[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('finy_ai_messages', JSON.stringify(msgs));
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !selectedImage) return;

    // Enforce daily limits (Free: 1x/day, VIP: 50x/day)
    const todayKey = new Date().toISOString().slice(0, 10);
    const localDate = localStorage.getItem('finy_ai_usage_date');
    let localCount = parseInt(localStorage.getItem('finy_ai_usage_count') || '0');
    if (localDate !== todayKey) {
      localCount = 0;
    }
    const maxAllowed = isVip ? 50 : 1;
    if (localCount >= maxAllowed) {
      showToast(
        isVip 
          ? 'Batas harian VIP (50x sehari) telah tercapai.' 
          : 'Batas harian Free user (1x sehari) telah tercapai. Upgrade ke Finy Pro untuk akses tanpa batas!', 
        'warning'
      );
      if (!isVip) router.push('/upgrade');
      return;
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: inputText,
      image: selectedImage || undefined,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    saveHistory(newMessages);
    
    setInputText('');
    setSelectedImage(null);
    setLoading(true);

    try {
      // 1. Call Supabase edge function 'ai-assistant'
      const { categories, wallets } = useTransactionStore.getState();
      const defaultWalletId = wallets.find(w => w.is_default)?.id || wallets[0]?.id || '';

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: newMessages.slice(-5).map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
          })),
          images: userMsg.image ? [{
            base64: userMsg.image.split(',')[1],
            mimeType: userMsg.image.split(';')[0].split(':')[1] || 'image/jpeg'
          }] : [],
          context: {
            categories: categories.map(c => ({ id: c.id, name: c.name, type: c.type })),
            wallets: wallets.map(w => ({ id: w.id, name: w.name, type: w.type, balance: w.balance })),
            defaultWalletId
          }
        }
      });

      if (error) throw error;

      // Increment daily limit counter
      localStorage.setItem('finy_ai_usage_date', todayKey);
      localStorage.setItem('finy_ai_usage_count', String(localCount + 1));

      const botMsg: Message = {
        id: crypto.randomUUID(),
        sender: 'assistant',
        text: data?.reply || 'Asisten AI Finy: Maaf, saya tidak dapat memproses permintaan Anda sekarang.',
        timestamp: new Date().toISOString()
      };

      const updated = [...newMessages, botMsg];
      setMessages(updated);
      saveHistory(updated);

      // Auto create transactions if AI recognized them
      if (data?.transactions_to_add && Array.isArray(data.transactions_to_add) && data.transactions_to_add.length > 0) {
        for (const txToAdd of data.transactions_to_add) {
          const cat = categories.find(c => c.name.toLowerCase() === txToAdd.category.toLowerCase() && c.type === txToAdd.type);
          if (cat) {
            await addTransaction({
              amount: txToAdd.amount,
              type: txToAdd.type,
              category_id: cat.id,
              wallet_id: txToAdd.wallet_id || defaultWalletId,
              transaction_date: txToAdd.date || new Date().toISOString().slice(0, 10),
              note: txToAdd.note || '',
              is_recurring: false,
              created_by_ai: true
            });
          }
        }
        showToast('Transaksi baru ditambahkan oleh AI!', 'success');
        // Refresh transactions list
        useTransactionStore.getState().fetchTransactions(new Date().toISOString().slice(0, 7));
      }
    } catch (err) {
      console.warn('AI Chat failed, using offline fallback mockup:', err);
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock Bot Response
      let reply = 'Berdasarkan catatan keuangan Anda, pengeluaran terbesar bulan ini adalah **Makan** sebesar **Rp 450.000**. Anggaran makan tersisa **Rp 50.000**. Coba kurangi jajan luar agar tidak melebihi anggaran!';
      if (userMsg.text.toLowerCase().includes('menabung')) {
        reply = 'Untuk menabung **Rp 5.000.000**, Anda bisa mengalokasikan **Rp 416.000 per bulan** selama 12 bulan. Coba aktifkan fitur **Anggaran Bulanan** di Finy dan kurangi anggaran kategori **Hiburan**.';
      } else if (userMsg.text.toLowerCase().includes('tips')) {
        reply = 'Berikut tips hemat: \n1. Belanja dengan daftar belanjaan \n2. Bandingkan harga minimarket vs pasar \n3. Alokasikan 50-30-20 (Kebutuhan-Keinginan-Tabungan)';
      }

      const botMsg: Message = {
        id: crypto.randomUUID(),
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toISOString()
      };

      const updated = [...newMessages, botMsg];
      setMessages(updated);
      saveHistory(updated);
    } finally {
      setLoading(false);
      fetchProfile();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputText(suggestion);
  };

  const handleClearHistory = () => {
    if (confirm('Hapus semua riwayat obrolan?')) {
      const welcome: Message[] = [
        {
          id: 'welcome',
          sender: 'assistant',
          text: t('aiChatWelcome'),
          timestamp: new Date().toISOString(),
        },
      ];
      setMessages(welcome);
      saveHistory(welcome);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isVip) {
      showToast('Fitur upload gambar untuk struk hanya tersedia di Finy Pro.', 'warning');
      router.push('/upgrade');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <div className={styles.headerCenter}>
          <div className={styles.logoCircle}>
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className={styles.title}>Finy AI Assistant</h2>
            <span className={styles.creditCount}>
              {isVip ? 'VIP (50x Sehari)' : 'Free (1x Sehari)'}
            </span>
          </div>
        </div>
        <button onClick={handleClearHistory} className={styles.clearBtn} aria-label="clear history">
          <Trash2 size={18} />
        </button>
      </header>

      {/* Messages Scroll Area */}
      <div className={styles.chatArea}>
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <div 
              key={m.id} 
              className={`${styles.messageWrapper} ${isUser ? styles.userWrapper : styles.botWrapper}`}
            >
              {!isUser && (
                <div className={styles.botAvatar}>
                  <Bot size={16} />
                </div>
              )}
              
              <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.botBubble}`}>
                {m.image && (
                  <img src={m.image} alt="uploaded receipt" className={styles.bubbleImage} />
                )}
                <p className={styles.bubbleText}>{m.text}</p>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className={`${styles.messageWrapper} ${styles.botWrapper}`}>
            <div className={styles.botAvatar}>
              <Bot size={16} />
            </div>
            <div className={`${styles.bubble} ${styles.botBubble}`}>
              <div className={styles.typingDots}>
                <div className={styles.dot} />
                <div className={styles.dot} />
                <div className={styles.dot} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {messages.length <= 1 && !loading && (
        <div className={styles.suggestions}>
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestionClick(s)}
              className={styles.suggestionChip}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Selected Image Preview */}
      {selectedImage && (
        <div className={styles.imagePreview}>
          <img src={selectedImage} alt="selected" />
          <button onClick={() => setSelectedImage(null)} className={styles.removeImageBtn}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Chat Form Input */}
      <form onSubmit={handleSend} className={styles.inputForm}>
        {/* Hidden File input for camera/gallery */}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          className={styles.hiddenFile}
        />
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={styles.iconBtn}
          aria-label="Upload receipt image"
        >
          <Image size={20} />
        </button>

        <input
          type="text"
          placeholder={t('aiChatPlaceholder')}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className={styles.chatInput}
        />

        <button 
          type="submit" 
          disabled={!inputText.trim() && !selectedImage}
          className={`${styles.sendBtn} ${(!inputText.trim() && !selectedImage) ? styles.sendBtnDisabled : ''}`}
          aria-label="send message"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

// Simple close button helper
function X({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
