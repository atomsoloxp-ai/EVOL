import React from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import { getRankDetails } from '../lib/engines/rpg-engine';
import {
  Shield,
  Zap,
  Activity,
  HeartPulse,
  Plus,
  AlertTriangle,
  Settings,
  Scale,
  Calendar,
  Flame,
} from 'lucide-react';
import { sound } from '../lib/audio/sound-fx';
import { FitnessGoal, AvailableEquipment } from '../types/member-state';
import { getStreakStatus, STREAK_MILESTONES } from '../lib/engines/streak-engine';
import { ActiveTab } from './BottomNavDock';

interface HunterProfileCardProps {
  onNavigate?: (tab: ActiveTab) => void;
}

export const HunterProfileCard: React.FC<HunterProfileCardProps> = ({ onNavigate }) => {
  const { profile, rpg, readiness, allocateStat, activateStreakFreeze } = useEvolStore();
  const rankInfo = getRankDetails(rpg.hunterRank);
  const streakStatus = getStreakStatus(rpg.lastStreakDate || '');

  const goalLabels: Record<FitnessGoal, string> = {
    MUSCLE_GAIN: 'Build Muscle',
    STRENGTH: 'Get Stronger',
    FAT_LOSS: 'Lose Fat',
    ENDURANCE: 'Endurance',
  };

  const equipmentLabels: Record<AvailableEquipment, string> = {
    FULL_GYM: 'Full Gym',
    BARBELL_DUMBBELL: 'Barbell & Dumbbells',
    HOME_GYM: 'Home Gym',
    DUMBBELL_ONLY: 'Dumbbells Only',
    BODYWEIGHT_CABLES: 'Bodyweight & Cables',
  };

  const stats = [
    {
      key: 'strength' as const,
      label: 'Strength',
      value: rpg.stats.strength,
      icon: Zap,
      color: '#38bdf8',
    },
    {
      key: 'endurance' as const,
      label: 'Stamina',
      value: rpg.stats.endurance,
      icon: Activity,
      color: '#34d399',
    },
    {
      key: 'discipline' as const,
      label: 'Habit',
      value: rpg.stats.discipline,
      icon: Shield,
      color: '#a855f7',
    },
    {
      key: 'recovery' as const,
      label: 'Recovery',
      value: rpg.stats.recovery,
      icon: HeartPulse,
      color: '#fbbf24',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 16px' }}>
      {/* Avatar & Character Identity Card */}
      <div className="system-card">
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          {/* Avatar Portrait with Aura */}
          <div style={{ position: 'relative' }}>
            <div
              className="aura-pulse"
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: `2px solid ${rankInfo.color}`,
                boxShadow: `0 0 16px ${rankInfo.glow}`,
                position: 'relative',
              }}
            >
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>

          {/* Identity details */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-system)',
                  fontSize: '0.7rem',
                  color: rankInfo.color,
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {profile.hunterTitle}
              </span>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onNavigate?.('SETTINGS');
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-cyan)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  color: 'var(--neon-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Settings size={11} />
                <span>Settings</span>
              </button>
            </div>

            <h2
              className="cinzel-title"
              style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}
            >
              {profile.name}
            </h2>

            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '2px 0' }}>
              {goalLabels[profile.fitnessGoal] || profile.fitnessGoal} •{' '}
              {equipmentLabels[profile.availableEquipment] || profile.availableEquipment} •{' '}
              {profile.preferredSessionDurationMinutes} min
            </p>

            {/* Active Injury limitation pill if any */}
            {profile.activeLimitations.length > 0 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '0.65rem',
                  color: '#f87171',
                  marginTop: '2px',
                  alignSelf: 'flex-start',
                }}
              >
                <AlertTriangle size={11} />
                <span>Limitation: {profile.activeLimitations[0]}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fitness Stats Panel */}
      <div className="system-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="system-title" style={{ fontSize: '0.85rem' }}>
              FITNESS STATS
            </span>
          </div>

          {rpg.unallocatedStatPoints > 0 ? (
            <div
              style={{
                background: 'rgba(251, 191, 36, 0.15)',
                border: '1px solid var(--gold-s-rank)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontFamily: 'var(--font-system)',
                fontSize: '0.72rem',
                color: 'var(--gold-s-rank)',
                fontWeight: 800,
                boxShadow: '0 0 10px rgba(251, 191, 36, 0.3)',
              }}
            >
              +{rpg.unallocatedStatPoints} BONUS POINTS
            </div>
          ) : (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              AUTO-UPDATED
            </span>
          )}
        </div>

        {/* Stats Grid - Clean 4-column compact layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${s.color}25`,
                  borderRadius: '8px',
                  padding: '8px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon size={12} color={s.color} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: s.color }}>{s.label}</span>
                </div>

                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-system)' }}>
                  {s.value}
                </div>

                {rpg.unallocatedStatPoints > 0 && (
                  <button
                    type="button"
                    onClick={() => allocateStat(s.key)}
                    style={{
                      background: s.color,
                      border: 'none',
                      borderRadius: '4px',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#000',
                      marginTop: '2px',
                    }}
                    title={`Allocate +1 to ${s.label}`}
                  >
                    <Plus size={12} strokeWidth={3} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hunter Consistency & Streak Milestone Engine with Calendar Shortcut */}
      <div className="system-card" style={{ background: 'rgba(11, 14, 23, 0.8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Flame size={15} color="#f97316" />
            <span className="system-title" style={{ fontSize: '0.8rem' }}>
              CONSISTENCY & STREAKS
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onNavigate?.('CALENDAR');
              }}
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: '0.62rem',
                color: 'var(--neon-cyan)',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '4px',
                padding: '3px 7px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Calendar size={11} /> CALENDAR
            </button>

            {rpg.streakFreezeActive ? (
              <span
                style={{
                  fontFamily: 'var(--font-code)',
                  fontSize: '0.62rem',
                  color: '#34d399',
                  background: 'rgba(52, 211, 153, 0.1)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Shield size={11} /> PROTECTED
              </span>
            ) : (
              <button
                type="button"
                onClick={activateStreakFreeze}
                style={{
                  fontFamily: 'var(--font-code)',
                  fontSize: '0.62rem',
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '4px',
                  padding: '3px 7px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Shield size={11} /> + SHIELD
              </button>
            )}
          </div>
        </div>

        {/* Current & Longest Streak Counters */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div
            style={{
              padding: '8px',
              background: 'rgba(249, 115, 22, 0.05)',
              border: '1px solid rgba(249, 115, 22, 0.25)',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>CURRENT STREAK</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f97316' }}>{rpg.streakDays}D</div>
          </div>

          <div
            style={{
              padding: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>LONGEST RECORD</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
              {Math.max(rpg.longestStreak || 0, rpg.streakDays)}D
            </div>
          </div>

          <div
            style={{
              padding: '8px',
              background:
                streakStatus === 'completed_today'
                  ? 'rgba(52, 211, 153, 0.08)'
                  : 'rgba(251, 191, 36, 0.08)',
              border:
                streakStatus === 'completed_today'
                  ? '1px solid rgba(52, 211, 153, 0.3)'
                  : '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>STATUS</div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                marginTop: '4px',
                color: streakStatus === 'completed_today' ? '#34d399' : '#fbbf24',
              }}
            >
              {streakStatus === 'completed_today'
                ? 'SAFE (TODAY)'
                : streakStatus === 'active_pending'
                ? 'PENDING'
                : 'RESET'}
            </div>
          </div>
        </div>

        {/* Compact Milestone Badges Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {STREAK_MILESTONES.map((m) => {
            const isUnlocked = rpg.streakDays >= m.days;
            return (
              <div
                key={m.days}
                title={`${m.title} (+${m.bonusXp} XP)`}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: isUnlocked ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: isUnlocked
                    ? '1px solid rgba(52, 211, 153, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: isUnlocked ? 1 : 0.45,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: isUnlocked ? '#34d399' : '#fff',
                }}
              >
                <span>{m.badge}</span>
                <span>{m.days}D</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hunter History & Facility Summary */}
      <div className="system-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
          <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>TOTAL XP</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
              {rpg.personalProgress.totalXp.toLocaleString()}
            </div>
          </div>
          <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>WORKOUTS</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
              {rpg.personalProgress.lifetimeWorkouts}
            </div>
          </div>
          <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>GYM RANK</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#a855f7' }}>
              {rpg.gymContext.facilityRank ? `#${rpg.gymContext.facilityRank}` : 'UNRANKED'}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Readiness Metric Bar */}
      <div className="system-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HeartPulse size={15} color={readiness.score < 50 ? '#ef4444' : '#38bdf8'} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc' }}>
              DAILY READINESS & RECOVERY
            </span>
          </div>

          <span
            style={{
              fontFamily: 'var(--font-system)',
              fontSize: '0.95rem',
              fontWeight: 800,
              color: readiness.score < 50 ? '#ef4444' : readiness.score < 75 ? '#fbbf24' : '#38bdf8',
            }}
          >
            {readiness.score} / 100
          </span>
        </div>

        <div style={{ marginTop: '8px' }}>
          <div className="glow-progress-track">
            <div
              className="glow-progress-fill"
              style={{
                width: `${readiness.score}%`,
                background:
                  readiness.score < 50 ? '#ef4444' : readiness.score < 75 ? '#fbbf24' : '#38bdf8',
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            marginTop: '6px',
          }}
        >
          <span>
            Status:{' '}
            <strong style={{ color: '#fff' }}>
              {readiness.isCalibrated ? readiness.status.replace('_', ' ') : 'BASELINE EST.'}
            </strong>
          </span>
          <span>
            Sleep: {readiness.isCalibrated ? `${readiness.sleepHoursLastNight}h` : 'Unlogged'}
          </span>
          <span>
            Workload:{' '}
            {readiness.acwrIsCalibrated ? `${readiness.acwrRatio}x` : 'Calibrating'}
          </span>
        </div>
      </div>

      {/* Measurement History Log */}
      {profile.measurementHistory && profile.measurementHistory.length > 0 && (
        <div className="system-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Scale size={15} color="var(--neon-cyan)" />
            <span className="system-title" style={{ fontSize: '0.8rem' }}>
              WEIGHT & PROGRESS HISTORY
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {profile.measurementHistory.map((m) => (
              <div
                key={m.id}
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
                  <span style={{ color: '#fff', fontWeight: 600 }}>{m.weightKg} kg</span>
                  {m.notes && <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>({m.notes})</span>}
                </div>
                <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                  {new Date(m.date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
