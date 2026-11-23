import React from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import { sound } from '../lib/audio/sound-fx';
import { Swords, Skull, Shield, RefreshCw, Zap, Award } from 'lucide-react';

export const DungeonRaidSection: React.FC = () => {
  const { dungeonGate, logWorkout, resetGateBoss, rpg } = useEvolStore();
  const hpPercent = Math.round((dungeonGate.bossCurrentHp / dungeonGate.bossMaxHp) * 100);

  const simulateQuickStrike = () => {
    sound.playClick();
    logWorkout({
      name: 'Quick Strength Session',
      durationMinutes: 45,
      exercises: [
        {
          exerciseId: 'ex-boss-strike',
          exerciseName: 'Barbell Bench Press',
          muscleGroup: 'CHEST',
          sets: [
            { weightKg: 100, reps: 8, rpe: 8 },
            { weightKg: 105, reps: 8, rpe: 8.5 },
            { weightKg: 110, reps: 6, rpe: 9 },
          ],
        },
      ],
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 16px' }}>
      {/* Dimensional Gate Portal Banner */}
      <div
        className="system-card"
        style={{
          position: 'relative',
          minHeight: '190px',
          backgroundImage: 'url(/assets/gate-portal.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '2px solid var(--neon-cyan)',
          boxShadow: '0 0 30px rgba(0, 229, 255, 0.35)',
        }}
      >
        <div className="hud-corner-tl" />
        <div className="hud-corner-tr" />
        <div className="hud-corner-bl" />
        <div className="hud-corner-br" />

        {/* Top Overlay Tag */}
        <div
          style={{
            background: 'rgba(7, 8, 13, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '6px 12px',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            alignSelf: 'flex-start',
            border: '1px solid var(--border-cyan)',
          }}
        >
          <span
            style={{
              background: '#ef4444',
              color: '#fff',
              fontFamily: 'var(--font-system)',
              fontWeight: 800,
              fontSize: '0.7rem',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            TIER {dungeonGate.gateRank} CHALLENGE
          </span>
          <span style={{ fontFamily: 'var(--font-system)', fontSize: '0.8rem', color: '#fff', fontWeight: 700 }}>
            {dungeonGate.name}
          </span>
        </div>

        {/* Bottom Challenge Info Card inside Banner */}
        <div
          style={{
            background: 'rgba(7, 8, 13, 0.9)',
            backdropFilter: 'blur(12px)',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={18} color="#f87171" />
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>
                {dungeonGate.bossName}
              </span>
            </div>

            <span
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: '0.78rem',
                color: hpPercent > 30 ? '#ef4444' : '#f87171',
                fontWeight: 700,
              }}
            >
              Remaining: {dungeonGate.bossCurrentHp.toLocaleString()} / {dungeonGate.bossMaxHp.toLocaleString()} kg (
              {hpPercent}%)
            </span>
          </div>

          {/* Challenge Progress Bar */}
          <div className="glow-progress-track" style={{ height: '10px', background: 'rgba(239, 68, 68, 0.2)' }}>
            <div
              className="glow-progress-fill"
              style={{
                width: `${hpPercent}%`,
                background: 'linear-gradient(90deg, #ef4444, #f43f5e)',
                boxShadow: '0 0 14px rgba(239, 68, 68, 0.8)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Quick Action + Compact Rewards */}
      <div className="system-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={simulateQuickStrike}
            className="btn-system"
            style={{ flex: 1, padding: '10px 14px' }}
            disabled={dungeonGate.cleared}
          >
            <Zap size={16} />
            <span>Log Quick Workout</span>
          </button>

          {dungeonGate.cleared && (
            <button
              onClick={resetGateBoss}
              className="btn-system-outline"
              style={{ padding: '10px 14px' }}
              title="Start a new weekly lifting challenge"
            >
              <RefreshCw size={16} />
              <span>Next Challenge</span>
            </button>
          )}
        </div>

        {/* Compact Rewards Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '8px',
            textAlign: 'center',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ padding: '6px', background: 'rgba(0, 229, 255, 0.06)', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>REWARD</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--neon-cyan)' }}>
              +{dungeonGate.rewards.xp} XP
            </div>
          </div>
          <div style={{ padding: '6px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>TITLE</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {dungeonGate.rewards.title}
            </div>
          </div>
          <div style={{ padding: '6px', background: 'rgba(251, 191, 36, 0.08)', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>BADGE</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gold-s-rank)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {dungeonGate.rewards.item}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
