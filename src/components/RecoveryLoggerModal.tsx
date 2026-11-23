import React, { useState } from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import { calculateRecoveryScore } from '../lib/engines/recovery-engine';
import { Moon, Heart, Flame, ShieldAlert, Sparkles, Check, Activity, BatteryCharging } from 'lucide-react';

export const RecoveryLoggerModal: React.FC = () => {
  const { nutrition, readiness, profile, logRecovery } = useEvolStore();

  const [sleepHours, setSleepHours] = useState(readiness.sleepHoursLastNight || 7.5);
  const [subjectiveReadiness, setSubjectiveReadiness] = useState(8);
  const [hrvMs, setHrvMs] = useState(readiness.hrvMs || 65);
  const [proteinGrams, setProteinGrams] = useState(nutrition.todayProteinGrams ?? 0);

  // Live calculation preview including acute fatigue decay
  const preview = calculateRecoveryScore({
    sleepHours,
    targetSleepHours: nutrition.targetSleepHours,
    subjectiveReadiness,
    hrvMs,
    todayProteinGrams: proteinGrams,
    targetProteinGrams: profile.targetProteinGrams,
    recentStrainIndex: readiness.fatigueIndex,
    acuteFatigueStrain: readiness.acuteFatigueStrain,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    logRecovery({
      sleepHours,
      subjectiveReadiness,
      hrvMs,
      proteinGrams,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 16px' }}>
      <div className="system-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="cinzel-title" style={{ fontSize: '1.15rem', color: '#fff', margin: 0 }}>
            Recovery Check-In
          </h2>

          <div
            style={{
              fontFamily: 'var(--font-system)',
              fontSize: '0.95rem',
              fontWeight: 800,
              color: preview.score < 50 ? '#ef4444' : preview.score < 75 ? '#fbbf24' : 'var(--neon-cyan)',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '4px 10px',
              borderRadius: '6px',
            }}
          >
            {preview.score}%
          </div>
        </div>

        {/* Current Fatigue & Recovery Preview */}
        <div
          style={{
            marginTop: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            background: 'rgba(0, 229, 255, 0.04)',
            border: '1px solid rgba(0, 229, 255, 0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.7rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BatteryCharging size={13} color="var(--neon-cyan)" />
            <span>Fatigue:</span>
            <strong style={{ color: '#fff' }}>{readiness.acuteFatigueStrain ?? readiness.fatigueIndex ?? 0}</strong>
          </div>
          <div style={{ color: '#34d399', fontWeight: 600 }}>
            ↳ After rest: {preview.residualStrain}
          </div>
        </div>

        {/* Real-time Recovery Warning if preview is critical */}
        {preview.deloadOverride && (
          <div
            style={{
              marginTop: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.7rem',
              color: '#f87171',
            }}
          >
            <ShieldAlert size={14} />
            <span>Light recovery day recommended</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Sleep Hours */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--neon-cyan)' }}>
                <Moon size={13} /> Sleep
              </span>
              <strong style={{ color: '#fff' }}>{sleepHours}h</strong>
            </div>
            <input
              type="range"
              min="3"
              max="12"
              step="0.5"
              value={sleepHours}
              onChange={(e) => setSleepHours(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--neon-cyan)' }}
            />
          </div>

          {/* Subjective Readiness */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--shadow-purple)' }}>
                <Heart size={13} /> Energy
              </span>
              <strong style={{ color: '#fff' }}>{subjectiveReadiness} / 10</strong>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={subjectiveReadiness}
              onChange={(e) => setSubjectiveReadiness(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--shadow-purple)' }}
            />
          </div>

          {/* HRV & Protein in compact 2-column row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24' }}>
                  <Activity size={12} /> HRV (ms)
                </span>
              </div>
              <input
                type="number"
                min="20"
                max="150"
                value={hrvMs}
                onChange={(e) => setHrvMs(parseInt(e.target.value) || 60)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399' }}>
                  <Flame size={12} /> Protein ({profile.targetProteinGrams}g)
                </span>
              </div>
              <input
                type="number"
                min="0"
                max="350"
                value={proteinGrams}
                onChange={(e) => setProteinGrams(parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          <button type="submit" className="btn-system" style={{ width: '100%', padding: '10px', marginTop: '4px' }}>
            <Sparkles size={14} />
            <span>Save Check-In (+75 XP)</span>
          </button>
        </form>
      </div>

      {/* Recovery History Logs */}
      {nutrition.recentLogs && nutrition.recentLogs.length > 0 && (
        <div className="system-card">
          <span className="system-title" style={{ fontSize: '0.78rem', display: 'block', marginBottom: '8px' }}>
            RECENT CHECK-INS
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {nutrition.recentLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.72rem',
                }}
              >
                <div>
                  <strong style={{ color: '#fff' }}>{new Date(log.date).toLocaleDateString()}</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                    Sleep: {log.sleepHours}h • HRV: {log.hrvMs || '--'}ms • Protein: {log.proteinGrams}g
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-system)', color: 'var(--neon-cyan)', fontWeight: 700 }}>
                  {log.computedScore}/100
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
