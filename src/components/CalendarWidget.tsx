import React, { useState } from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import { getLocalDateString, getStreakStatus } from '../lib/engines/streak-engine';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Lock,
  Flame,
  Dumbbell,
  HeartPulse,
  Sparkles,
  Shield,
  QrCode,
} from 'lucide-react';
import { sound } from '../lib/audio/sound-fx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const CalendarWidget: React.FC = () => {
  const { rpg, training, nutrition, quests, simulateCheckIn, activateStreakFreeze } = useEvolStore();
  const todayDate = new Date();
  const todayKey = getLocalDateString(todayDate);

  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  const calendarLedger = rpg.activityCalendar || {};
  const todayRecord = calendarLedger[todayKey];
  const isCheckedInToday = Boolean(todayRecord?.checkedIn || rpg.lastCheckInDate === todayKey);
  const isRecoveryRewardedToday = Boolean(todayRecord?.recoveryXpAwarded);
  const streakStatus = getStreakStatus(rpg.lastStreakDate || '');

  // Build map of workouts and recovery logs by local YYYY-MM-DD for historical dates too
  const workoutsByDate: Record<string, typeof training.workoutHistory> = {};
  for (const w of training.workoutHistory || []) {
    const key = w.date ? getLocalDateString(new Date(w.date)) : '';
    if (key) {
      if (!workoutsByDate[key]) workoutsByDate[key] = [];
      workoutsByDate[key].push(w);
    }
  }

  const recoveryByDate: Record<string, (typeof nutrition.recentLogs)[0]> = {};
  for (const r of nutrition.recentLogs || []) {
    const key = r.date ? getLocalDateString(new Date(r.date)) : '';
    if (key && !recoveryByDate[key]) {
      recoveryByDate[key] = r;
    }
  }

  const claimsByDate: Record<string, number> = {};
  for (const c of rpg.personalProgress.claimedRewardsHistory || []) {
    const key = c.claimedAt ? getLocalDateString(new Date(c.claimedAt)) : '';
    if (key) {
      claimsByDate[key] = (claimsByDate[key] || 0) + 1;
    }
  }

  const handlePrevMonth = () => {
    sound.playClick();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    sound.playClick();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToday = () => {
    sound.playClick();
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDateKey(getLocalDateString(now));
  };

  // Compute calendar grid days
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const calendarCells: Array<{ day: number | null; dateKey: string }> = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarCells.push({ day: null, dateKey: `empty-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    calendarCells.push({ day: d, dateKey: `${viewYear}-${mStr}-${dStr}` });
  }

  // Selected day details
  const selectedLedger = calendarLedger[selectedDateKey];
  const selectedWorkouts = workoutsByDate[selectedDateKey] || [];
  const selectedRecovery = recoveryByDate[selectedDateKey];
  const selectedClaimsCount =
    selectedLedger?.questsClaimedIds?.length || claimsByDate[selectedDateKey] || 0;
  const selectedCheckedIn =
    Boolean(selectedLedger?.checkedIn) ||
    (selectedDateKey === todayKey && isCheckedInToday) ||
    rpg.lastStreakDate === selectedDateKey;

  const todayClaimedQuestsCount = quests.filter(
    (q) => q.category !== 'PENALTY_QUEST' && q.status === 'CLAIMED'
  ).length;
  const totalStandardQuests = quests.filter((q) => q.category !== 'PENALTY_QUEST').length || 4;
  const todayWorkoutXpCount = todayRecord?.workoutXpAwardedCount || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Today's Anti-Spam Calendar Verification Lock Banner */}
      <div
        className="system-card"
        style={{
          background: 'linear-gradient(145deg, rgba(14, 21, 35, 0.96), rgba(10, 14, 24, 0.96))',
          border: '1px solid rgba(56, 189, 248, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={16} color="var(--neon-cyan)" />
            <div>
              <span className="system-title" style={{ fontSize: '0.76rem', display: 'block' }}>
                DAILY CALENDAR VERIFICATION
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                Date Key: {todayKey} (1 Check-In / Day Lock)
              </span>
            </div>
          </div>

          {isCheckedInToday ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(52, 211, 153, 0.14)',
                border: '1px solid rgba(52, 211, 153, 0.4)',
                color: '#34d399',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.68rem',
                fontFamily: 'var(--font-system)',
                fontWeight: 800,
              }}
            >
              <Lock size={11} /> LOCKED TODAY
            </span>
          ) : (
            <button
              type="button"
              onClick={simulateCheckIn}
              className="btn-system"
              style={{ padding: '6px 12px', fontSize: '0.72rem' }}
            >
              <QrCode size={13} />
              <span>Check-In (+50 XP)</span>
            </button>
          )}
        </div>

        {/* 4 Daily Anti-Spam Reward Slots */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: isCheckedInToday ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              border: isCheckedInToday ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(255, 255, 255, 0.07)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>DAILY CHECK-IN</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: isCheckedInToday ? '#34d399' : '#fff' }}>
                {isCheckedInToday ? '1 / 1 Verified ✓' : '0 / 1 Pending'}
              </div>
            </div>
            <CheckCircle2 size={16} color={isCheckedInToday ? '#34d399' : '#64748b'} />
          </div>

          <div
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: isRecoveryRewardedToday ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              border: isRecoveryRewardedToday
                ? '1px solid rgba(52, 211, 153, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.07)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>RECOVERY XP</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: isRecoveryRewardedToday ? '#34d399' : '#fff' }}>
                {isRecoveryRewardedToday ? '1 / 1 Claimed ✓' : '0 / 1 Available'}
              </div>
            </div>
            <HeartPulse size={16} color={isRecoveryRewardedToday ? '#34d399' : '#fbbf24'} />
          </div>

          <div
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>DAILY GOALS</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--neon-cyan)' }}>
                {todayClaimedQuestsCount} / {totalStandardQuests} Claimed
              </div>
            </div>
            <Sparkles size={16} color="var(--neon-cyan)" />
          </div>

          <div
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>WORKOUT XP CAP</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#a855f7' }}>
                {todayWorkoutXpCount} / 2 Sessions
              </div>
            </div>
            <Dumbbell size={16} color="#a855f7" />
          </div>
        </div>
      </div>

      {/* Interactive Monthly Calendar Grid */}
      <div className="system-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 className="cinzel-title" style={{ fontSize: '1.05rem', color: '#fff', margin: 0 }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={handleJumpToday}
              className="quick-chip-btn"
              style={{ padding: '4px 8px', fontSize: '0.65rem' }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous Month"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '4px 6px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next Month"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '4px 6px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '4px',
            textAlign: 'center',
            marginBottom: '6px',
          }}
        >
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-code)',
                padding: '2px 0',
              }}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '5px',
          }}
        >
          {calendarCells.map((cell) => {
            if (cell.day === null) {
              return <div key={cell.dateKey} style={{ minHeight: '44px' }} />;
            }

            const isToday = cell.dateKey === todayKey;
            const isSelected = cell.dateKey === selectedDateKey;
            const dayLedger = calendarLedger[cell.dateKey];
            const hasWorkout = Boolean(
              (workoutsByDate[cell.dateKey] && workoutsByDate[cell.dateKey].length > 0) ||
                (dayLedger && dayLedger.workoutsCount > 0)
            );
            const hasCheckIn = Boolean(
              dayLedger?.checkedIn ||
                (isToday && isCheckedInToday) ||
                rpg.lastStreakDate === cell.dateKey
            );
            const hasRecovery = Boolean(recoveryByDate[cell.dateKey] || dayLedger?.recoveryXpAwarded);
            const hasQuests = Boolean(
              (dayLedger?.questsClaimedIds && dayLedger.questsClaimedIds.length > 0) ||
                claimsByDate[cell.dateKey]
            );
            const isActiveDay = hasCheckIn || hasWorkout || hasRecovery || hasQuests;

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => {
                  sound.playClick();
                  setSelectedDateKey(cell.dateKey);
                }}
                style={{
                  minHeight: '44px',
                  borderRadius: '8px',
                  border: isSelected
                    ? '2px solid var(--neon-cyan)'
                    : isToday
                    ? '1px solid rgba(56, 189, 248, 0.5)'
                    : isActiveDay
                    ? '1px solid rgba(52, 211, 153, 0.35)'
                    : '1px solid rgba(255, 255, 255, 0.05)',
                  background: isSelected
                    ? 'rgba(56, 189, 248, 0.16)'
                    : isActiveDay
                    ? 'rgba(52, 211, 153, 0.08)'
                    : isToday
                    ? 'rgba(56, 189, 248, 0.06)'
                    : 'rgba(255, 255, 255, 0.02)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 2px',
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontFamily: 'var(--font-code)',
                    fontWeight: isToday || isSelected ? 800 : 600,
                    color: isToday ? 'var(--neon-cyan)' : isActiveDay ? '#34d399' : '#cbd5e1',
                  }}
                >
                  {cell.day}
                </span>

                {/* Activity Indicator Dots */}
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '8px' }}>
                  {hasCheckIn && (
                    <span
                      title="Checked In"
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: '#34d399',
                      }}
                    />
                  )}
                  {hasWorkout && (
                    <span
                      title="Workout Logged"
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: '#38bdf8',
                      }}
                    />
                  )}
                  {hasQuests && (
                    <span
                      title="Quest Claimed"
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: '#a855f7',
                      }}
                    />
                  )}
                  {hasRecovery && (
                    <span
                      title="Recovery Logged"
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: '#fbbf24',
                      }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div
          style={{
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: '8px',
            fontSize: '0.64rem',
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} /> Check-In
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' }} /> Workout
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a855f7' }} /> Quests
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbbf24' }} /> Recovery
          </span>
        </div>
      </div>

      {/* Selected Day Log Details */}
      <div className="system-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span className="system-title" style={{ fontSize: '0.76rem' }}>
            ACTIVITY LOG • {selectedDateKey === todayKey ? `TODAY (${selectedDateKey})` : selectedDateKey}
          </span>
          {selectedLedger?.totalXpEarnedToday ? (
            <span
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: '0.72rem',
                color: 'var(--neon-cyan)',
                fontWeight: 700,
              }}
            >
              +{selectedLedger.totalXpEarnedToday} XP Earned
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.74rem' }}>
          <div
            style={{
              padding: '7px 10px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Gym Check-In Status</span>
            <strong style={{ color: selectedCheckedIn ? '#34d399' : 'var(--text-muted)' }}>
              {selectedCheckedIn ? 'Verified ✓ (Locked)' : 'Not Checked In'}
            </strong>
          </div>

          <div
            style={{
              padding: '7px 10px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Workouts Completed</span>
            <strong style={{ color: selectedWorkouts.length > 0 ? 'var(--neon-cyan)' : 'var(--text-muted)' }}>
              {selectedWorkouts.length > 0
                ? `${selectedWorkouts.length} Session(s) (${selectedWorkouts
                    .reduce((acc, w) => acc + w.totalTonnageKg, 0)
                    .toLocaleString()} kg)`
                : '0 Sessions'}
            </strong>
          </div>

          <div
            style={{
              padding: '7px 10px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Daily Quests Claimed</span>
            <strong style={{ color: selectedClaimsCount > 0 ? '#a855f7' : 'var(--text-muted)' }}>
              {selectedClaimsCount} Goal(s)
            </strong>
          </div>

          <div
            style={{
              padding: '7px 10px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Recovery & Nutrition Log</span>
            <strong style={{ color: selectedRecovery ? '#fbbf24' : 'var(--text-muted)' }}>
              {selectedRecovery
                ? `Sleep ${selectedRecovery.sleepHours}h • Protein ${selectedRecovery.proteinGrams}g (${selectedRecovery.computedScore}/100)`
                : 'No Recovery Log'}
            </strong>
          </div>
        </div>
      </div>

      {/* Streak Protection Card */}
      <div className="system-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Flame size={18} color="#f97316" />
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>
              {rpg.streakDays} Day Streak • {streakStatus === 'completed_today' ? 'Safe Today' : 'Pending Today'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Longest Record: {Math.max(rpg.longestStreak || 0, rpg.streakDays)} Days
            </div>
          </div>
        </div>

        {rpg.streakFreezeActive ? (
          <span
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: '0.65rem',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '6px',
              padding: '5px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Shield size={12} /> Shield Active
          </span>
        ) : (
          <button
            type="button"
            onClick={activateStreakFreeze}
            className="btn-system-outline"
            style={{ padding: '6px 10px', fontSize: '0.68rem' }}
          >
            <Shield size={12} />
            <span>Activate Shield</span>
          </button>
        )}
      </div>
    </div>
  );
};
