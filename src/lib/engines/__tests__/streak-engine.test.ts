import { describe, it, expect } from 'vitest';
import {
  getLocalDateString,
  getYesterdayLocalDateString,
  getCalendarDayDifference,
  getStreakStatus,
  getActiveStreakCount,
  processStreakCompletion,
  STREAK_MILESTONES,
  StreakState,
} from '../streak-engine';

describe('Streak Engine', () => {
  describe('Date Utilities (Timezone Resilient)', () => {
    it('formats a date as YYYY-MM-DD in local time', () => {
      const fixedDate = new Date(2026, 9, 26, 12, 0, 0); // Month is 0-indexed (9 = Oct)
      expect(getLocalDateString(fixedDate)).toBe('2026-10-26');
    });

    it('returns yesterday date correctly', () => {
      const refDate = new Date(2026, 9, 26, 10, 0, 0);
      expect(getYesterdayLocalDateString(refDate)).toBe('2026-10-25');

      // Month rollover
      const monthStart = new Date(2026, 9, 1, 10, 0, 0);
      expect(getYesterdayLocalDateString(monthStart)).toBe('2026-09-30');
    });

    it('calculates calendar day differences accurately', () => {
      expect(getCalendarDayDifference('2026-10-25', '2026-10-26')).toBe(1);
      expect(getCalendarDayDifference('2026-10-26', '2026-10-26')).toBe(0);
      expect(getCalendarDayDifference('2026-10-20', '2026-10-26')).toBe(6);
      expect(getCalendarDayDifference('2026-10-26', '2026-10-25')).toBe(-1);
      expect(getCalendarDayDifference('', '2026-10-26')).toBe(Number.POSITIVE_INFINITY);
      expect(getCalendarDayDifference('invalid-date', '2026-10-26')).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe('Streak Status & Active Decay', () => {
    const today = new Date(2026, 9, 26);

    it('returns completed_today if lastStreakDate is today', () => {
      expect(getStreakStatus('2026-10-26', today)).toBe('completed_today');
    });

    it('returns active_pending if last completed yesterday', () => {
      expect(getStreakStatus('2026-10-25', today)).toBe('active_pending');
    });

    it('returns broken if missed 2 or more days', () => {
      expect(getStreakStatus('2026-10-24', today)).toBe('broken');
      expect(getStreakStatus('2026-10-10', today)).toBe('broken');
      expect(getStreakStatus('', today)).toBe('broken');
    });

    it('decays active streak to 0 if broken on app load', () => {
      expect(getActiveStreakCount(10, '2026-10-24', today)).toBe(0);
      expect(getActiveStreakCount(10, '', today)).toBe(0);
      expect(getActiveStreakCount(0, '2026-10-26', today)).toBe(0);
    });

    it('preserves active streak count if completed today or pending today', () => {
      expect(getActiveStreakCount(5, '2026-10-26', today)).toBe(5);
      expect(getActiveStreakCount(5, '2026-10-25', today)).toBe(5);
    });
  });

  describe('processStreakCompletion', () => {
    const today = new Date(2026, 9, 26);

    it('initializes streak to 1 on first ever completion', () => {
      const state: StreakState = { streak: 0, lastStreakDate: '' };
      const res = processStreakCompletion(state, { currentDate: today });

      expect(res.streak).toBe(1);
      expect(res.lastStreakDate).toBe('2026-10-26');
      expect(res.longestStreak).toBe(1);
      expect(res.isNewDayIncrement).toBe(true);
      expect(res.status).toBe('completed_today');
    });

    it('is idempotent when completed multiple times on the same day', () => {
      const state: StreakState = { streak: 5, lastStreakDate: '2026-10-26', longestStreak: 7 };
      const res = processStreakCompletion(state, { currentDate: today });

      expect(res.streak).toBe(5);
      expect(res.lastStreakDate).toBe('2026-10-26');
      expect(res.longestStreak).toBe(7);
      expect(res.isNewDayIncrement).toBe(false);
      expect(res.usedFreeze).toBe(false);
    });

    it('increments streak when completed on consecutive day (yesterday -> today)', () => {
      const state: StreakState = { streak: 4, lastStreakDate: '2026-10-25', longestStreak: 4 };
      const res = processStreakCompletion(state, { currentDate: today });

      expect(res.streak).toBe(5);
      expect(res.lastStreakDate).toBe('2026-10-26');
      expect(res.longestStreak).toBe(5);
      expect(res.isNewDayIncrement).toBe(true);
    });

    it('resets streak to 1 if broken (missed 2+ days) without streak freeze', () => {
      const state: StreakState = { streak: 12, lastStreakDate: '2026-10-24', longestStreak: 12 };
      const res = processStreakCompletion(state, { currentDate: today, hasStreakFreeze: false });

      expect(res.streak).toBe(1);
      expect(res.lastStreakDate).toBe('2026-10-26');
      expect(res.longestStreak).toBe(12); // Longest streak is preserved!
      expect(res.usedFreeze).toBe(false);
    });

    it('saves streak when exactly 1 day was missed and player has streak freeze', () => {
      const state: StreakState = { streak: 6, lastStreakDate: '2026-10-24', longestStreak: 6 };
      // 2026-10-24 -> 2026-10-26 is 2 days diff (missed Oct 25)
      const res = processStreakCompletion(state, { currentDate: today, hasStreakFreeze: true });

      expect(res.streak).toBe(7); // Rescued and incremented!
      expect(res.lastStreakDate).toBe('2026-10-26');
      expect(res.usedFreeze).toBe(true);
    });

    it('triggers milestone bonuses when hitting key thresholds (3, 7, 14, 30, etc.)', () => {
      const stateDay2: StreakState = { streak: 2, lastStreakDate: '2026-10-25' };
      const res3 = processStreakCompletion(stateDay2, { currentDate: today });

      expect(res3.streak).toBe(3);
      expect(res3.milestoneUnlocked).toEqual({
        days: 3,
        title: '3-Day Start',
        bonusXp: 50,
        badge: '⚡',
      });

      const stateDay6: StreakState = { streak: 6, lastStreakDate: '2026-10-25' };
      const res7 = processStreakCompletion(stateDay6, { currentDate: today });
      expect(res7.streak).toBe(7);
      expect(res7.milestoneUnlocked?.title).toBe('1-Week Habit');
      expect(res7.milestoneUnlocked?.bonusXp).toBe(150);
    });
  });
});
