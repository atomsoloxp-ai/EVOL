import React, { useState } from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import { getRankDetails, getLevelProgressPercentage } from '../lib/engines/rpg-engine';
import { sound } from '../lib/audio/sound-fx';
import {
  Flame,
  Volume2,
  VolumeX,
  QrCode,
  Sparkles,
  Shield,
  MoreVertical,
  Menu,
  Calendar,
  CheckCircle2,
  Settings,
} from 'lucide-react';
import { getStreakStatus, getLocalDateString } from '../lib/engines/streak-engine';
import { ActiveTab } from './BottomNavDock';

interface HeaderNavProps {
  onOpenMenu?: () => void;
  onNavigate?: (tab: ActiveTab) => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({ onOpenMenu, onNavigate }) => {
  const { rpg, profile, simulateCheckIn } = useEvolStore();
  const [muted, setMuted] = useState(sound.isMuted());
  const rankInfo = getRankDetails(rpg.hunterRank);
  const progressPct = getLevelProgressPercentage(rpg.xp, rpg.level);
  const streakStatus = getStreakStatus(rpg.lastStreakDate || '');

  const todayKey = getLocalDateString();
  const isCheckedInToday = Boolean(
    rpg.activityCalendar?.[todayKey]?.checkedIn || rpg.lastCheckInDate === todayKey
  );

  const toggleSound = () => {
    const nextMuted = !muted;
    sound.setMuted(nextMuted);
    setMuted(nextMuted);
    if (!nextMuted) sound.playClick();
  };

  return (
    <header style={{ padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Top utility row with 3-Dots / Side Menu Trigger */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Three-Dots / Side Navigation Drawer Button */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onOpenMenu?.();
            }}
            aria-label="Open Main Navigation Menu"
            title="Open Side Navigation Menu"
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '8px',
              padding: '6px 8px',
              color: 'var(--neon-cyan)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <MoreVertical size={16} />
            <Menu size={15} />
          </button>

          <span
            className="system-title"
            style={{ fontSize: '0.88rem', fontWeight: 800, letterSpacing: '0.12em', whiteSpace: 'nowrap' }}
          >
            EVOL FITNESS
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Quick Calendar Button */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onNavigate?.('CALENDAR');
            }}
            aria-label="Open Activity Calendar"
            title="Activity Calendar & Anti-Spam Verification"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px',
              color: 'var(--neon-cyan)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Calendar size={15} />
          </button>

          {/* Quick Settings Button */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onNavigate?.('SETTINGS');
            }}
            aria-label="Open Settings"
            title="Settings & Calendar Setup"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Settings size={15} />
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            aria-label="Toggle Sound"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px',
              color: muted ? 'var(--text-muted)' : 'var(--neon-cyan)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Daily Calendar-Locked Gym Check-In Button */}
          <button
            type="button"
            onClick={simulateCheckIn}
            className={isCheckedInToday ? 'btn-system-outline' : 'btn-system'}
            style={{
              padding: '6px 10px',
              fontSize: '0.7rem',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              ...(isCheckedInToday
                ? {
                    background: 'rgba(52, 211, 153, 0.14)',
                    borderColor: 'rgba(52, 211, 153, 0.45)',
                    color: '#34d399',
                  }
                : {}),
            }}
            title={
              isCheckedInToday
                ? `Already checked in for ${todayKey} (Locked until tomorrow)`
                : "Log today's daily gym check-in (+50 XP)"
            }
          >
            {isCheckedInToday ? <CheckCircle2 size={13} /> : <QrCode size={13} />}
            <span>{isCheckedInToday ? 'Checked In' : 'Check-In'}</span>
          </button>
        </div>
      </div>

      {/* Hunter Status Bar (Fixed responsive layout so Level, Name, and Streak never collide) */}
      <div
        className="system-card"
        style={{
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'rgba(13, 17, 28, 0.85)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            {/* Rank Crest Pill */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${rankInfo.color}66`,
                borderRadius: '6px',
                padding: '3px 7px',
                fontFamily: 'var(--font-system)',
                fontSize: '0.7rem',
                fontWeight: 800,
                color: rankInfo.color,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              <Sparkles size={11} />
              {rankInfo.badge}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '6px',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-system)',
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                LVL {rpg.level}
              </span>
              <span
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {profile.name}
              </span>
            </div>
          </div>

          {/* Clickable Streak Indicator -> Opens Calendar */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onNavigate?.('CALENDAR');
            }}
            title={
              streakStatus === 'completed_today'
                ? 'Streak completed for today! Click to open Calendar.'
                : streakStatus === 'active_pending'
                ? 'Streak active! Complete a quest or workout today to maintain.'
                : 'Streak reset. Complete a workout or quest to begin leveling!'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              color: streakStatus === 'completed_today' ? '#34d399' : '#f97316',
              fontFamily: 'var(--font-system)',
              fontSize: '0.74rem',
              fontWeight: 700,
              background:
                streakStatus === 'completed_today'
                  ? 'rgba(52, 211, 153, 0.12)'
                  : 'rgba(249, 115, 22, 0.1)',
              padding: '4px 8px',
              borderRadius: '6px',
              border:
                streakStatus === 'completed_today'
                  ? '1px solid rgba(52, 211, 153, 0.35)'
                  : '1px solid rgba(249, 115, 22, 0.3)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            <Flame size={13} />
            <span>{rpg.streakDays}D STREAK</span>
            {rpg.streakFreezeActive && (
              <span title="Streak Freeze Shield Active" style={{ display: 'flex', alignItems: 'center' }}>
                <Shield size={11} color="#38bdf8" />
              </span>
            )}
          </button>
        </div>

        {/* Level XP Progress Bar */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.68rem',
              fontFamily: 'var(--font-code)',
              color: 'var(--text-muted)',
              marginBottom: '4px',
            }}
          >
            <span>LEVEL {rpg.level}</span>
            <span>
              {rpg.xp.toLocaleString()} / {rpg.nextLevelXp.toLocaleString()} XP
            </span>
          </div>
          <div className="glow-progress-track" style={{ height: '6px' }}>
            <div
              className="glow-progress-fill"
              style={{
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, var(--neon-cyan), ${rankInfo.color})`,
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
};
