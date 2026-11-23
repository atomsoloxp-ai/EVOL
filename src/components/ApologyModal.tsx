import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, AlertOctagon } from 'lucide-react';
import { sound } from '../lib/audio/sound-fx';

interface ApologyModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  reason?: string;
}

const REQUIRED_TEXT = 'Real progress takes honest effort.';
const REQUIRED_COUNT = 3;

export const ApologyModal: React.FC<ApologyModalProps> = ({
  isOpen,
  onSuccess,
  reason = 'We noticed unusually fast activity logging.',
}) => {
  const [currentText, setCurrentText] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [pasteBlockedMsg, setPasteBlockedMsg] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentText('');
      setSuccessCount(0);
      setIsShaking(false);
      setPasteBlockedMsg(false);
      sound.playPenaltyWarning();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (currentText.trim() === REQUIRED_TEXT) {
      const nextCount = successCount + 1;
      setSuccessCount(nextCount);
      setCurrentText('');
      sound.playQuestComplete();

      if (nextCount >= REQUIRED_COUNT) {
        sound.playLevelUp();
        onSuccess();
      }
    } else {
      sound.playPenaltyWarning();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    sound.playPenaltyWarning();
    setPasteBlockedMsg(true);
    setCurrentText('NICE TRY. TYPE IT OUT.');
    setTimeout(() => {
      setCurrentText('');
      setPasteBlockedMsg(false);
    }, 1400);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(5, 2, 4, 0.96)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className={`system-card ${isShaking ? 'penalty-shake' : ''}`}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'linear-gradient(145deg, rgba(28, 6, 12, 0.98), rgba(16, 4, 8, 0.98))',
          border: '2px solid #ef4444',
          boxShadow: '0 0 50px rgba(239, 68, 68, 0.55)',
          padding: '24px 20px',
          position: 'relative',
          transition: 'transform 0.1s ease',
        }}
      >
        <div className="hud-corner-tl" />
        <div className="hud-corner-tr" />
        <div className="hud-corner-bl" />
        <div className="hud-corner-br" />

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '8px',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldAlert size={24} />
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
              ACCOUNTABILITY CHECK
            </span>
            <h2
              className="cinzel-title"
              style={{ fontSize: '1.35rem', color: '#fff', margin: 0, letterSpacing: '0.04em' }}
            >
              Stay Honest With Your Progress
            </h2>
          </div>
        </div>

        <p style={{ fontSize: '0.74rem', color: '#fca5a5', lineHeight: 1.4, marginBottom: '12px' }}>
          {reason}
        </p>

        {/* Target Pledge Box */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            padding: '12px',
            fontFamily: 'var(--font-code)',
            fontSize: '0.8rem',
            color: '#fff',
            lineHeight: 1.4,
            marginBottom: '12px',
            userSelect: 'none',
          }}
        >
          <div style={{ fontSize: '0.65rem', color: '#f87171', marginBottom: '4px', textTransform: 'uppercase' }}>
            Type this reminder to continue ({successCount}/{REQUIRED_COUNT}):
          </div>
          "{REQUIRED_TEXT}"
        </div>

        {/* Text Input Form */}
        <form onSubmit={handleSubmit}>
          <textarea
            className="input-system"
            rows={3}
            placeholder="Type the sentence above..."
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            onPaste={handlePaste}
            autoComplete="off"
            spellCheck="false"
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: '0.78rem',
              color: pasteBlockedMsg ? '#ef4444' : '#fff',
              background: 'rgba(0, 0, 0, 0.8)',
              borderColor: pasteBlockedMsg ? '#ef4444' : 'rgba(239, 68, 68, 0.5)',
              resize: 'none',
              padding: '10px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '10px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: '0.75rem',
                color: successCount >= REQUIRED_COUNT ? '#34d399' : '#f87171',
                fontWeight: 700,
              }}
            >
              Progress: {successCount} / {REQUIRED_COUNT}
            </span>

            <button
              type="submit"
              className="btn-system"
              disabled={currentText.length < 15}
              style={{
                background: '#dc2626',
                border: '1px solid #ef4444',
                color: '#fff',
                fontSize: '0.75rem',
                padding: '8px 16px',
                fontWeight: 800,
                opacity: currentText.length < 15 ? 0.5 : 1,
              }}
            >
              <Lock size={13} style={{ display: 'inline', marginRight: '4px' }} />
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
