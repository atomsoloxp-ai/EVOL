import React, { useEffect } from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import confetti from 'canvas-confetti';
import { ShieldAlert, Award, Sparkles, CheckCircle2, X } from 'lucide-react';

export const SystemAlertModal: React.FC = () => {
  const { systemModal, closeSystemModal } = useEvolStore();

  useEffect(() => {
    if (systemModal?.isOpen) {
      if (
        systemModal.type === 'LEVEL_UP' ||
        systemModal.type === 'GATE_CLEAR' ||
        systemModal.type === 'QUEST_CLEAR'
      ) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#00e5ff', '#a855f7', '#fbbf24', '#38bdf8'],
          });
        } catch (e) {
          // Ignore
        }
      }
    }
  }, [systemModal?.isOpen, systemModal?.type]);

  if (!systemModal || !systemModal.isOpen) return null;

  const isLevelUp = systemModal.type === 'LEVEL_UP';
  const isPenalty = systemModal.type === 'PENALTY';
  const isGate = systemModal.type === 'GATE_CLEAR';

  const borderColor = isPenalty
    ? '#ef4444'
    : isLevelUp
    ? '#a855f7'
    : isGate
    ? '#fbbf24'
    : 'var(--neon-cyan)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 4, 8, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 1000,
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={closeSystemModal}
    >
      <div
        className="system-card"
        style={{
          maxWidth: '420px',
          width: '100%',
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 35px ${borderColor}55`,
          background: 'rgba(10, 13, 22, 0.96)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hud-corner-tl" />
        <div className="hud-corner-tr" />
        <div className="hud-corner-bl" />
        <div className="hud-corner-br" />

        {/* Close icon */}
        <button
          onClick={closeSystemModal}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        {/* Header icon and title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isLevelUp && <Sparkles size={24} color="#a855f7" />}
          {isPenalty && <ShieldAlert size={24} color="#ef4444" />}
          {isGate && <Award size={24} color="#fbbf24" />}
          {!isLevelUp && !isPenalty && !isGate && <CheckCircle2 size={24} color="var(--neon-cyan)" />}

          <div>
            <span
              style={{
                fontFamily: 'var(--font-system)',
                fontSize: '0.95rem',
                fontWeight: 800,
                color: borderColor,
                letterSpacing: '0.08em',
              }}
            >
              {systemModal.title}
            </span>
          </div>
        </div>

        {/* SubTitle */}
        <h3
          className="cinzel-title"
          style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 700 }}
        >
          {systemModal.subTitle}
        </h3>

        {/* Details */}
        {systemModal.details && (
          <p
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {systemModal.details}
          </p>
        )}

        {/* Stat bonus badges if any */}
        {systemModal.statBonus && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {systemModal.statBonus.strength ? (
              <span
                style={{
                  background: 'rgba(0, 229, 255, 0.1)',
                  border: '1px solid var(--neon-cyan)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  color: 'var(--neon-cyan)',
                  fontWeight: 700,
                }}
              >
                +STR: {systemModal.statBonus.strength}
              </span>
            ) : null}
            {systemModal.statBonus.endurance ? (
              <span
                style={{
                  background: 'rgba(52, 211, 153, 0.1)',
                  border: '1px solid #34d399',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  color: '#34d399',
                  fontWeight: 700,
                }}
              >
                +END: {systemModal.statBonus.endurance}
              </span>
            ) : null}
            {systemModal.statBonus.discipline ? (
              <span
                style={{
                  background: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid var(--shadow-purple)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  color: 'var(--shadow-purple)',
                  fontWeight: 700,
                }}
              >
                +DIS: {systemModal.statBonus.discipline}
              </span>
            ) : null}
            {systemModal.statBonus.recovery ? (
              <span
                style={{
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid var(--gold-s-rank)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  color: 'var(--gold-s-rank)',
                  fontWeight: 700,
                }}
              >
                +REC: {systemModal.statBonus.recovery}
              </span>
            ) : null}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={closeSystemModal}
          className={isPenalty ? 'btn-danger-outline' : isLevelUp ? 'btn-system-purple' : 'btn-system'}
          style={{ width: '100%', marginTop: '8px' }}
        >
          Got It
        </button>
      </div>
    </div>
  );
};
