import React from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { sound } from '../lib/audio/sound-fx';

interface HonestyCheckModalProps {
  isOpen: boolean;
  questTitle: string;
  rewardsSummary?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const HonestyCheckModal: React.FC<HonestyCheckModalProps> = ({
  isOpen,
  questTitle,
  rewardsSummary,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 7, 12, 0.9)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="system-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'linear-gradient(145deg, rgba(20, 10, 15, 0.98), rgba(12, 6, 10, 0.98))',
          border: '2px solid #ef4444',
          boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)',
          padding: '22px 20px',
          position: 'relative',
        }}
      >
        <div className="hud-corner-tl" />
        <div className="hud-corner-tr" />
        <div className="hud-corner-bl" />
        <div className="hud-corner-br" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f87171',
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <span
              style={{
                fontFamily: 'var(--font-system)',
                fontSize: '0.68rem',
                color: '#f87171',
                letterSpacing: '0.12em',
                fontWeight: 800,
              }}
            >
              QUICK CONFIRMATION
            </span>
            <h3 className="cinzel-title" style={{ fontSize: '1.15rem', color: '#fff', margin: 0 }}>
              Confirm Completion
            </h3>
          </div>
        </div>

        {/* Goal Info */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            padding: '10px 12px',
            marginBottom: '14px',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Goal to Complete:</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
            {questTitle}
          </div>
          {rewardsSummary && (
            <div style={{ fontSize: '0.72rem', color: 'var(--neon-cyan)', marginTop: '4px' }}>
              Rewards: {rewardsSummary}
            </div>
          )}
        </div>

        {/* Body Text */}
        <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0 0 14px' }}>
          Did you finish this goal?
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onCancel();
            }}
            className="btn-system-outline"
            style={{
              padding: '8px',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
            }}
          >
            I Need More Time
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onConfirm();
            }}
            className="btn-system"
            style={{
              padding: '8px',
              fontSize: '0.75rem',
              background: '#dc2626',
              border: '1px solid #ef4444',
              color: '#fff',
              fontWeight: 800,
            }}
          >
            Yes, I Completed It
          </button>
        </div>
      </div>
    </div>
  );
};
