import React from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import { getRankDetails } from '../lib/engines/rpg-engine';
import { getLocalDateString } from '../lib/engines/streak-engine';
import { ActiveTab } from './BottomNavDock';
import { sound } from '../lib/audio/sound-fx';
import {
  Shield,
  Swords,
  Calendar,
  Flame,
  Activity,
  HeartPulse,
  Terminal,
  Settings,
  X,
  CheckCircle2,
  QrCode,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface SideNavDrawerProps {
  isOpen: boolean;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onClose: () => void;
}

export const SideNavDrawer: React.FC<SideNavDrawerProps> = ({
  isOpen,
  activeTab,
  onSelectTab,
  onClose,
}) => {
  const { profile, rpg, readiness, quests, simulateCheckIn } = useEvolStore();

  if (!isOpen) return null;

  const rankInfo = getRankDetails(rpg.hunterRank);
  const todayKey = getLocalDateString();
  const isCheckedInToday = Boolean(
    rpg.activityCalendar?.[todayKey]?.checkedIn || rpg.lastCheckInDate === todayKey
  );
  const pendingQuestsCount = quests.filter(
    (q) => q.category !== 'PENALTY_QUEST' && q.status !== 'CLAIMED'
  ).length;

  const menuItems: Array<{
    id: ActiveTab;
    label: string;
    subLabel: string;
    icon: React.FC<{ size?: number; color?: string }>;
    badge?: string;
    accentColor: string;
  }> = [
    {
      id: 'HUNTER',
      label: 'Hunter Profile',
      subLabel: 'Character stats, rank & milestones',
      icon: Shield,
      accentColor: '#38bdf8',
    },
    {
      id: 'QUESTS',
      label: 'Daily Goals & Quests',
      subLabel: 'Workout timer & daily habit goals',
      icon: Swords,
      badge: pendingQuestsCount > 0 ? `${pendingQuestsCount} Active` : 'Done ✓',
      accentColor: '#00e5ff',
    },
    {
      id: 'CALENDAR',
      label: 'Activity Calendar',
      subLabel: 'Daily check-in lock & streak history',
      icon: Calendar,
      badge: isCheckedInToday ? 'Verified ✓' : 'Check-In',
      accentColor: '#34d399',
    },
    {
      id: 'DUNGEON',
      label: 'Weekly Challenge',
      subLabel: 'Boss tonnage raid & rewards',
      icon: Flame,
      accentColor: '#f43f5e',
    },
    {
      id: 'WORKOUT',
      label: 'Workout Logger',
      subLabel: 'Log sets, weights, RPE & PRs',
      icon: Activity,
      accentColor: '#a855f7',
    },
    {
      id: 'RECOVERY',
      label: 'Recovery Check-In',
      subLabel: `Readiness ${readiness.score}% • Sleep & protein`,
      icon: HeartPulse,
      accentColor: '#fbbf24',
    },
    {
      id: 'SYSTEM',
      label: 'AI Coach & Biometrics',
      subLabel: 'Coach dialogue, BMR/TDEE & ACWR',
      icon: Terminal,
      accentColor: '#38bdf8',
    },
    {
      id: 'SETTINGS',
      label: 'Settings & Calendar Setup',
      subLabel: 'Profile setup, joint filters & calendar',
      icon: Settings,
      accentColor: '#94a3b8',
    },
  ];

  const handleNavigate = (tab: ActiveTab) => {
    sound.playClick();
    onSelectTab(tab);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        background: 'rgba(3, 5, 10, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'flex-start',
      }}
      onClick={onClose}
    >
      {/* Sideways Navigation Panel */}
      <aside
        style={{
          width: '84%',
          maxWidth: '330px',
          height: '100%',
          background: 'linear-gradient(180deg, #0d111c 0%, #090c14 100%)',
          borderRight: '1px solid rgba(56, 189, 248, 0.28)',
          boxShadow: '12px 0 40px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 14px',
          overflowY: 'auto',
          gap: '14px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drawer Brand & Close Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="var(--neon-cyan)" />
            <span className="system-title" style={{ fontSize: '0.85rem', letterSpacing: '0.12em' }}>
              EVOL MAIN MENU
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            aria-label="Close Menu"
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
            <X size={16} />
          </button>
        </div>

        {/* User Profile & Today's Calendar Check-In Card */}
        <div
          style={{
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={profile.avatarUrl}
              alt={profile.name}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                objectFit: 'cover',
                border: `2px solid ${rankInfo.color}`,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-system)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: rankInfo.color,
                  }}
                >
                  LVL {rpg.level} • {rankInfo.badge}
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {profile.name}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                🔥 {rpg.streakDays}D Streak • {rpg.xp.toLocaleString()} XP
              </div>
            </div>
          </div>

          {/* Quick Calendar Check-In Status Button */}
          {isCheckedInToday ? (
            <button
              type="button"
              onClick={() => handleNavigate('CALENDAR')}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                background: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.35)',
                color: '#34d399',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <CheckCircle2 size={14} />
              <span>Today&apos;s Check-In Verified ({todayKey})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                simulateCheckIn();
              }}
              className="btn-system"
              style={{ width: '100%', padding: '8px 10px', fontSize: '0.74rem' }}
            >
              <QrCode size={14} />
              <span>Daily Check-In (+50 XP)</span>
            </button>
          )}
        </div>

        {/* Navigation Links List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <span
            style={{
              fontSize: '0.64rem',
              fontFamily: 'var(--font-system)',
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              paddingLeft: '4px',
            }}
          >
            ALL MODULES & PAGES
          </span>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: isActive
                    ? `1px solid ${item.accentColor}`
                    : '1px solid rgba(255, 255, 255, 0.05)',
                  background: isActive
                    ? 'rgba(56, 189, 248, 0.14)'
                    : 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: isActive ? `${item.accentColor}25` : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${item.accentColor}44`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} color={item.accentColor} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: isActive ? '#fff' : '#e2e8f0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: '0.66rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.subLabel}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontFamily: 'var(--font-code)',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: item.accentColor,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
};
