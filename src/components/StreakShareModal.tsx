'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Flame, X, Download } from 'lucide-react';
import styles from './StreakShareModal.module.css';

interface StreakShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  streak: number;
}

export default function StreakShareModal({ isOpen, onClose, streak }: StreakShareModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Helper to draw a rounded rect
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // Draw the flame path on canvas
  const drawVectorFlame = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 100, size / 100);

    // Glow Effect
    ctx.shadowColor = '#F97316';
    ctx.shadowBlur = 40;

    // Outermost Flame (Yellow/Orange gradient)
    const outerGrad = ctx.createLinearGradient(0, -60, 0, 40);
    outerGrad.addColorStop(0, '#F97316'); // Orange
    outerGrad.addColorStop(1, '#EF4444'); // Red
    ctx.fillStyle = outerGrad;

    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.bezierCurveTo(-45, 40, -50, -5, -25, -35);
    ctx.bezierCurveTo(-35, -15, -30, 10, -5, 5);
    ctx.bezierCurveTo(-15, -25, -5, -65, 0, -85);
    ctx.bezierCurveTo(5, -65, 15, -25, 5, 5);
    ctx.bezierCurveTo(30, 10, 35, -15, 25, -35);
    ctx.bezierCurveTo(50, -5, 45, 40, 0, 40);
    ctx.closePath();
    ctx.fill();

    // Inner Flame (Yellow/Light Orange)
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#FBBF24';
    const innerGrad = ctx.createLinearGradient(0, -40, 0, 30);
    innerGrad.addColorStop(0, '#FBBF24'); // Yellow
    innerGrad.addColorStop(1, '#F97316'); // Orange
    ctx.fillStyle = innerGrad;

    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.bezierCurveTo(-25, 30, -30, 0, -15, -20);
    ctx.bezierCurveTo(-20, -5, -15, 15, -3, 10);
    ctx.bezierCurveTo(-10, -10, -3, -40, 0, -55);
    ctx.bezierCurveTo(3, -40, 10, -10, 3, 10);
    ctx.bezierCurveTo(15, 15, 20, -5, 15, -20);
    ctx.bezierCurveTo(30, 0, 25, 30, 0, 30);
    ctx.closePath();
    ctx.fill();

    // Core Flame (White/Yellow)
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.bezierCurveTo(-12, 20, -15, 5, -8, -5);
    ctx.bezierCurveTo(-10, 0, -8, 10, -2, 8);
    ctx.bezierCurveTo(-5, -2, -2, -20, 0, -30);
    ctx.bezierCurveTo(2, -20, 5, -2, 2, 8);
    ctx.bezierCurveTo(8, 10, 10, 0, 8, -5);
    ctx.bezierCurveTo(15, 5, 12, 20, 0, 20);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  // Draw a check icon inside a circle
  const drawCheckCircle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    isChecked: boolean,
    labelText: string
  ) => {
    ctx.save();
    
    // Circle background
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isChecked ? 'rgba(197, 242, 60, 0.15)' : 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = isChecked ? '#C5F23C' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    if (isChecked) {
      // Glow check
      ctx.shadowColor = '#C5F23C';
      ctx.shadowBlur = 10;
      
      // Draw Checkmark
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.4, y);
      ctx.lineTo(x - radius * 0.1, y + radius * 0.3);
      ctx.lineTo(x + radius * 0.45, y - radius * 0.3);
      ctx.strokeStyle = '#C5F23C';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else {
      // Draw Dot
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
    }

    // Draw Label Text
    ctx.shadowBlur = 0;
    ctx.fillStyle = isChecked ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 22px Outfit, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labelText, x, y + radius + 32);

    ctx.restore();
  };

  // Generate the poster and trigger download
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsGenerating(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsGenerating(false);
      return;
    }

    // Set resolution (1080x1920 for high-quality 9:16 vertical poster)
    canvas.width = 1080;
    canvas.height = 1920;

    // 1. Background Gradient
    const bgGrad = ctx.createRadialGradient(540, 960, 100, 540, 960, 1100);
    bgGrad.addColorStop(0, '#1E1B4B'); // Deep Indigo
    bgGrad.addColorStop(0.5, '#0F172A'); // Slate Dark
    bgGrad.addColorStop(1, '#020617'); // Almost Black
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Decorative Orange/Yellow glow backdrop in center
    const glowGrad = ctx.createRadialGradient(540, 750, 50, 540, 750, 450);
    glowGrad.addColorStop(0, 'rgba(249, 115, 22, 0.12)');
    glowGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(540, 750, 450, 0, Math.PI * 2);
    ctx.fill();

    // 2. Elegant Border Frame
    ctx.strokeStyle = 'rgba(197, 242, 60, 0.15)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 40, 40, 1000, 1840, 40);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(197, 242, 60, 0.05)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 50, 50, 980, 1820, 32);
    ctx.stroke();

    // Inner Corner Accent Marks
    const drawCornerAccents = () => {
      ctx.strokeStyle = '#C5F23C';
      ctx.lineWidth = 4;
      
      // Top Left
      ctx.beginPath();
      ctx.moveTo(80, 120);
      ctx.lineTo(80, 80);
      ctx.lineTo(120, 80);
      ctx.stroke();

      // Top Right
      ctx.beginPath();
      ctx.moveTo(1000, 120);
      ctx.lineTo(1000, 80);
      ctx.lineTo(960, 80);
      ctx.stroke();

      // Bottom Left
      ctx.beginPath();
      ctx.moveTo(80, 1800);
      ctx.lineTo(80, 1840);
      ctx.lineTo(120, 1840);
      ctx.stroke();

      // Bottom Right
      ctx.beginPath();
      ctx.moveTo(1000, 1800);
      ctx.lineTo(1000, 1840);
      ctx.lineTo(960, 1840);
      ctx.stroke();
    };
    drawCornerAccents();

    // 3. Header Section (Finy Logo & Branding)
    ctx.fillStyle = '#C5F23C';
    ctx.font = '900 64px Outfit, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FINY', 540, 180);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '700 20px Outfit, Inter, sans-serif';
    ctx.fillText('YOUR DAILY FINANCIAL COMPANION', 540, 220);

    // Small divider line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(440, 260);
    ctx.lineTo(640, 260);
    ctx.stroke();

    // 4. Center Section: Flame & Big Streak Count
    drawVectorFlame(ctx, 540, 600, 240);

    // Glowing Neon Badge for streak number
    ctx.save();
    ctx.shadowColor = '#F97316';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 160px Outfit, Inter, sans-serif';
    ctx.fillText(String(streak), 540, 800);
    ctx.restore();

    ctx.fillStyle = '#F97316';
    ctx.font = '900 36px Outfit, Inter, sans-serif';
    ctx.fillText('HARI BERUNTUN!', 540, 860);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '500 24px Outfit, Inter, sans-serif';
    ctx.fillText('DISIPLIN MENCATAT KEUANGAN', 540, 900);

    // 5. Progress Tracker Grid (3 Checkboxes)
    // Draw connecting line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(340, 1100);
    ctx.lineTo(740, 1100);
    ctx.stroke();

    if (streak >= 3) {
      // Glow active path
      ctx.strokeStyle = '#C5F23C';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#C5F23C';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(340, 1100);
      ctx.lineTo(740, 1100);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw individual nodes
    drawCheckCircle(ctx, 340, 1100, 40, streak >= 1, 'Hari 1');
    drawCheckCircle(ctx, 540, 1100, 40, streak >= 2, 'Hari 2');
    drawCheckCircle(ctx, 740, 1100, 40, streak >= 3, 'Hari 3');

    // Encourage Text Box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    drawRoundedRect(ctx, 160, 1260, 760, 180, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px Outfit, Inter, sans-serif';
    ctx.fillText('HEBAT! 🎉', 540, 1320);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'italic 24px Outfit, Inter, sans-serif';
    ctx.fillText('Kamu selangkah lebih dekat dengan kebebasan finansial.', 540, 1370);

    // 6. Footer Section (Branding & Motivational Quote)
    ctx.fillStyle = '#C5F23C';
    ctx.font = '800 28px Outfit, Inter, sans-serif';
    ctx.fillText('“Disiplin adalah kunci kebebasan finansial.”', 540, 1560);

    // Mock QR Code / Download logo box
    const qrX = 540 - 70;
    const qrY = 1620;
    
    // QR Border
    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, qrX, qrY, 140, 140, 12);
    ctx.fill();

    // Mock QR Code pattern
    ctx.fillStyle = '#020617';
    ctx.fillRect(qrX + 15, qrY + 15, 40, 40);
    ctx.fillRect(qrX + 85, qrY + 15, 40, 40);
    ctx.fillRect(qrX + 15, qrY + 85, 40, 40);
    ctx.fillRect(qrX + 85, qrY + 85, 40, 40);
    
    ctx.fillRect(qrX + 45, qrY + 45, 10, 10);
    ctx.fillRect(qrX + 65, qrY + 35, 15, 15);
    ctx.fillRect(qrX + 35, qrY + 65, 15, 15);
    ctx.fillRect(qrX + 55, qrY + 75, 20, 10);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '700 20px Outfit, Inter, sans-serif';
    ctx.fillText('Unduh aplikasi di finy.wahyusatrio.com', 540, 1810);

    // Trigger Download
    setTimeout(() => {
      try {
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Finy-Streak-${streak}-Hari.png`;
        link.href = image;
        link.click();
      } catch (err) {
        console.error('Error generating image URL:', err);
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>Bagikan Streak Anda</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 9:16 Vertical Preview Container */}
        <div className={styles.previewContainer}>
          <div className={styles.aspectRatioBox}>
            <div className={styles.posterPreview}>
              {/* Top Branding */}
              <div className={styles.brandTitle}>FINY</div>
              <div className={styles.brandSubtitle}>YOUR DAILY FINANCIAL COMPANION</div>

              {/* Glowing Flame */}
              <div className={styles.flameWrapper}>
                <div className={styles.glowBackdrop}></div>
                <Flame size={72} className={styles.previewFlame} />
                <div className={styles.streakNumber}>{streak}</div>
              </div>

              {/* Streak Meta */}
              <div className={styles.streakLabel}>HARI BERUNTUN!</div>
              <div className={styles.streakSublabel}>Mencatat Keuangan Konsisten</div>

              {/* Progress Nodes */}
              <div className={styles.nodesContainer}>
                <div className={styles.connectorLine}>
                  <div 
                    className={styles.connectorActive} 
                    style={{ width: streak >= 3 ? '100%' : streak >= 2 ? '50%' : '0%' }}
                  ></div>
                </div>
                <div className={styles.nodesRow}>
                  <div className={`${styles.node} ${streak >= 1 ? styles.nodeChecked : ''}`}>
                    <div className={styles.nodeIcon}>{streak >= 1 ? '✓' : ''}</div>
                    <span>Hari 1</span>
                  </div>
                  <div className={`${styles.node} ${streak >= 2 ? styles.nodeChecked : ''}`}>
                    <div className={styles.nodeIcon}>{streak >= 2 ? '✓' : ''}</div>
                    <span>Hari 2</span>
                  </div>
                  <div className={`${styles.node} ${streak >= 3 ? styles.nodeChecked : ''}`}>
                    <div className={styles.nodeIcon}>{streak >= 3 ? '✓' : ''}</div>
                    <span>Hari 3</span>
                  </div>
                </div>
              </div>

              {/* Encouraging Quote */}
              <div className={styles.previewQuote}>
                “Disiplin adalah kunci kebebasan finansial.”
              </div>

              {/* QR Mockup */}
              <div className={styles.previewFooter}>
                <div className={styles.miniQr}></div>
                <span>Unduh di finy.wahyusatrio.com</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button 
            className={styles.downloadBtn} 
            onClick={handleDownload} 
            disabled={isGenerating}
          >
            <Download size={18} />
            {isGenerating ? 'Menyimpan...' : 'Simpan Gambar'}
          </button>
        </div>

        {/* Hidden Canvas for Rendering */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
