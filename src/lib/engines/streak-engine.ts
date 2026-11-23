/**
 * Streak Engine for SoloLvlUp // EVOL
 * 
 * Provides timezone-safe date calculations, active streak decay,
 * consecutive day detection, streak freeze/shields, and RPG milestone bonuses.
 */

export interface StreakState {
  streak: number;
  lastStreakDate: string; // Format: "YYYY-MM-DD" in user's local timezone
  longestStreak?: number;
  streakFreezeActive?: boolean;
}

export type StreakStatus = 
  | 'completed_today' // Already completed a quest today; streak is safe & incremented
  | 'active_pending'  // Completed yesterday; needs completion today to maintain
  | 'broken';         // Missed 1+ full calendar days; streak has reset to 0

export interface StreakMilestone {
  days: number;
  title: string;
  bonusXp: number;
  badge: string;
}

export interface StreakUpdateResult {
  streak: number;
  lastStreakDate: string;
  longestStreak: number;
  status: StreakStatus;
  isNewDayIncrement: boolean;
  usedFreeze: boolean;
  milestoneUnlocked?: StreakMilestone | null;
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 3, title: '3-Day Start', bonusXp: 50, badge: '⚡' },
  { days: 7, title: '1-Week Habit', bonusXp: 150, badge: '🛡️' },
  { days: 14, title: '2-Week Strong', bonusXp: 350, badge: '💪' },
  { days: 30, title: '30-Day Rhythm', bonusXp: 1000, badge: '👑' },
  { days: 60, title: '60-Day Pro', bonusXp: 2500, badge: '🔥' },
  { days: 100, title: '100-Day Club', bonusXp: 5000, badge: '🏆' },
  { days: 365, title: '1-Year Legend', bonusXp: 20000, badge: '🌟' },
];

// ─── Date Utilities (Timezone Resilient) ──────────────────────────────────────────

/**
 * Returns a date string formatted as "YYYY-MM-DD" in local time.
 * Avoids the UTC-boundary glitch caused by `toISOString().split('T')[0]`.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns yesterday's date string in "YYYY-MM-DD" in local time.
 */
export function getYesterdayLocalDateString(referenceDate: Date = new Date()): string {
  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday);
}

/**
 * Calculates the calendar day difference between two "YYYY-MM-DD" strings.
 * Returns Infinity if any date is invalid or empty.
 */
export function getCalendarDayDifference(fromDateStr: string, toDateStr: string): number {
  if (!fromDateStr || !toDateStr) return Number.POSITIVE_INFINITY;

  const [y1, m1, d1] = fromDateStr.split('-').map(Number);
  const [y2, m2, d2] = toDateStr.split('-').map(Number);

  if (isNaN(y1) || isNaN(m1) || isNaN(d1) || isNaN(y2) || isNaN(m2) || isNaN(d2)) {
    return Number.POSITIVE_INFINITY;
  }

  // Use UTC midnight comparison to prevent Daylight Saving Time shifts (e.g. 23 or 25-hour days)
  const ms1 = Date.UTC(y1, m1 - 1, d1);
  const ms2 = Date.UTC(y2, m2 - 1, d2);
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  return Math.round((ms2 - ms1) / MS_PER_DAY);
}

// ─── Status & Active Decay ──────────────────────────────────────────────────────

/**
 * Checks the current live status of a user's streak based on the current date.
 */
export function getStreakStatus(lastStreakDate: string, currentDate: Date = new Date()): StreakStatus {
  if (!lastStreakDate) return 'broken';

  const todayStr = getLocalDateString(currentDate);
  const dayDiff = getCalendarDayDifference(lastStreakDate, todayStr);

  if (dayDiff === 0) {
    return 'completed_today';
  }
  if (dayDiff === 1) {
    return 'active_pending';
  }
  return 'broken';
}

/**
 * Returns the effective streak count currently active.
 * If 2 or more calendar days have passed without activity, returns 0.
 * Useful on app launch/dashboard display so players don't see an obsolete streak.
 */
export function getActiveStreakCount(
  streak: number,
  lastStreakDate: string,
  currentDate: Date = new Date()
): number {
  if (!lastStreakDate || streak <= 0) return 0;

  const status = getStreakStatus(lastStreakDate, currentDate);
  if (status === 'broken') {
    return 0;
  }
  return streak;
}

// ─── Streak Completion Processor ────────────────────────────────────────────────

export interface ProcessStreakOptions {
  currentDate?: Date;
  hasStreakFreeze?: boolean; // If true, one missed day will be saved by consuming the freeze
}

/**
 * Core streak updater to call whenever a quest, workout, or check-in is completed.
 */
export function processStreakCompletion(
  current: StreakState,
  options: ProcessStreakOptions = {}
): StreakUpdateResult {
  const currentDate = options.currentDate || new Date();
  const todayStr = getLocalDateString(currentDate);
  const previousStreak = typeof current.streak === 'number' && current.streak > 0 ? current.streak : 0;
  const previousLongest = typeof current.longestStreak === 'number' ? current.longestStreak : previousStreak;

  // 1. If already completed today, keep streak unchanged (idempotent)
  if (current.lastStreakDate === todayStr) {
    return {
      streak: previousStreak,
      lastStreakDate: todayStr,
      longestStreak: Math.max(previousLongest, previousStreak),
      status: 'completed_today',
      isNewDayIncrement: false,
      usedFreeze: false,
      milestoneUnlocked: null,
    };
  }

  const daysSinceLast = getCalendarDayDifference(current.lastStreakDate, todayStr);
  let newStreak = 1;
  let usedFreeze = false;

  if (daysSinceLast === 1) {
    // 2. Completed yesterday -> regular consecutive-day increment
    newStreak = previousStreak + 1;
  } else if (daysSinceLast === 2 && options.hasStreakFreeze) {
    // 3. Missed exactly 1 day, but player has an active streak freeze shield!
    newStreak = previousStreak + 1;
    usedFreeze = true;
  } else {
    // 4. Broken streak or first day -> reset to 1
    newStreak = 1;
  }

  const newLongestStreak = Math.max(previousLongest, newStreak);

  // Check if a milestone was reached today
  const milestoneUnlocked = STREAK_MILESTONES.find((m) => m.days === newStreak) || null;

  return {
    streak: newStreak,
    lastStreakDate: todayStr,
    longestStreak: newLongestStreak,
    status: 'completed_today',
    isNewDayIncrement: true,
    usedFreeze,
    milestoneUnlocked,
  };
}
