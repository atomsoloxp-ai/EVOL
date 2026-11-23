// Module 5: Progression & RPG Engine (Deterministic Math) - EVOL.md Section 4 & 5

import { HunterRank, RPGCharacterState } from '../../types/member-state';
import { RewardGrantRecord } from '../../types/rpg';

/**
 * Deterministic Level Calculation:
 * Level = floor(0.1 * sqrt(XP))
 */
export function calculateLevelFromXP(totalXp: number): number {
  if (totalXp <= 0) return 1;
  const rawLevel = Math.floor(0.1 * Math.sqrt(totalXp));
  return Math.max(1, rawLevel);
}

/**
 * Minimum XP required to reach a specific level:
 * XP = (Level / 0.1)^2 = (10 * Level)^2 = 100 * Level^2
 */
export function getMinXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 100 * Math.pow(level, 2);
}

/**
 * XP threshold to achieve the NEXT level
 */
export function getNextLevelXpThreshold(currentLevel: number): number {
  return 100 * Math.pow(currentLevel + 1, 2);
}

/**
 * Calculates current level progress percentage (0 - 100)
 */
export function getLevelProgressPercentage(currentXp: number, currentLevel: number): number {
  const baseFloor = getMinXpForLevel(currentLevel);
  const nextTarget = getNextLevelXpThreshold(currentLevel);
  const span = nextTarget - baseFloor;
  if (span <= 0) return 0;
  const currentInTier = Math.max(0, currentXp - baseFloor);
  return Math.min(100, Math.round((currentInTier / span) * 100));
}

/**
 * Maps Level to Solo Leveling Hunter Rank
 */
export function getHunterRank(level: number): HunterRank {
  if (level >= 70) return 'SHADOW_MONARCH';
  if (level >= 55) return 'NATIONAL_HUNTER';
  if (level >= 40) return 'S-RANK';
  if (level >= 30) return 'A-RANK';
  if (level >= 20) return 'B-RANK';
  if (level >= 10) return 'C-RANK';
  if (level >= 5) return 'D-RANK';
  return 'E-RANK';
}

/**
 * Rank Badge metadata (color, title, glow effect)
 */
export function getRankDetails(rank: HunterRank) {
  switch (rank) {
    case 'SHADOW_MONARCH':
      return {
        badge: 'LEGEND',
        title: 'Elite Legend',
        color: '#a855f7',
        glow: 'rgba(168, 85, 247, 0.7)',
        auraDescription: 'Top-tier mastery and unmatched consistency.',
      };
    case 'NATIONAL_HUNTER':
      return {
        badge: 'MASTER',
        title: 'Master Athlete',
        color: '#fbbf24',
        glow: 'rgba(251, 191, 36, 0.7)',
        auraDescription: 'Elite strength, endurance, and discipline.',
      };
    case 'S-RANK':
      return {
        badge: 'DIAMOND',
        title: 'Diamond Athlete',
        color: '#00e5ff',
        glow: 'rgba(0, 229, 255, 0.7)',
        auraDescription: 'Peak performance and long-term dedication.',
      };
    case 'A-RANK':
      return {
        badge: 'PLATINUM',
        title: 'Platinum Athlete',
        color: '#38bdf8',
        glow: 'rgba(56, 189, 248, 0.5)',
        auraDescription: 'Advanced training consistency and output.',
      };
    case 'B-RANK':
      return {
        badge: 'GOLD',
        title: 'Gold Athlete',
        color: '#34d399',
        glow: 'rgba(52, 211, 153, 0.5)',
        auraDescription: 'Experienced lifter with strong weekly habits.',
      };
    case 'C-RANK':
      return {
        badge: 'SILVER',
        title: 'Silver Athlete',
        color: '#60a5fa',
        glow: 'rgba(96, 165, 250, 0.4)',
        auraDescription: 'Steady progress and solid training foundation.',
      };
    case 'D-RANK':
      return {
        badge: 'BRONZE',
        title: 'Bronze Athlete',
        color: '#94a3b8',
        glow: 'rgba(148, 163, 184, 0.3)',
        auraDescription: 'Building momentum and weekly consistency.',
      };
    default:
      return {
        badge: 'STARTER',
        title: 'Starter Member',
        color: '#64748b',
        glow: 'rgba(100, 116, 139, 0.3)',
        auraDescription: 'Beginning your fitness journey.',
      };
  }
}

/**
 * Calculates XP gain from a workout session:
 * XP = (Base XP + Volume Bonus + PR Bonus) * Streak Multiplier
 */
export function calculateWorkoutXp(
  sessionTonnageKg: number,
  setsCount: number,
  prsCount: number,
  streakDays: number
): {
  totalXpEarned: number;
  baseXp: number;
  volumeBonus: number;
  prBonus: number;
  streakMultiplier: number;
  statPointsEarned: {
    strength: number;
    endurance: number;
    discipline: number;
    recovery: number;
  };
} {
  if (setsCount <= 0) {
    return {
      totalXpEarned: 0,
      baseXp: 0,
      volumeBonus: 0,
      prBonus: 0,
      streakMultiplier: 1.0,
      statPointsEarned: { strength: 0, endurance: 0, discipline: 0, recovery: 0 },
    };
  }

  const baseXp = 100;
  const volumeBonus = Math.min(250, Math.round(sessionTonnageKg / 15));
  const prBonus = prsCount * 75;
  const streakMultiplier = Math.min(2.0, 1.0 + Math.min(streakDays, 20) * 0.05);

  const rawEarned = (baseXp + volumeBonus + prBonus) * streakMultiplier;
  const totalXpEarned = Math.round(rawEarned);

  const strengthGrowth = Math.max(1, Math.round(sessionTonnageKg / 1000) + prsCount);
  const enduranceGrowth = Math.max(1, Math.round(setsCount / 4));
  const disciplineGrowth = 2;
  const recoveryGrowth = 0;

  return {
    totalXpEarned,
    baseXp,
    volumeBonus,
    prBonus,
    streakMultiplier: Number(streakMultiplier.toFixed(2)),
    statPointsEarned: {
      strength: strengthGrowth,
      endurance: enduranceGrowth,
      discipline: disciplineGrowth,
      recovery: recoveryGrowth,
    },
  };
}

export interface ProgressionUpdateOptions {
  cause?: 'WORKOUT' | 'CHECK_IN' | 'QUEST_CLAIM' | 'RECOVERY_LOG' | 'GATE_CLEAR' | 'CORRECTION';
  workoutCountDelta?: number; // Explicit delta for lifetimeWorkouts (+1 for workout, -1 for delete, 0 for check-in/quest/recovery)
}

type StatKey = keyof RPGCharacterState['stats'];
export function getStatAllocations(current: RPGCharacterState): StatKey[] {
  if (current.statAllocations) return [...current.statAllocations];
  // Legacy saves did not record spending. Recover a deterministic allocation history
  // from the earned budget and stat surplus, without adding or removing points on load.
  const budget = Math.max(0, 5 + (current.level - 1) * 3 - current.unallocatedStatPoints);
  const history: StatKey[] = [];
  for (const key of ['strength','endurance','discipline','recovery'] as const) {
    const grants = Object.values(current.grantLedger || {}).filter(g=>!g.revokedAt).reduce((s,g)=>s+g.statPoints[key],0);
    const count = Math.min(budget-history.length, Math.max(0,Math.round(current.stats[key]-10-grants)));
    for(let i=0;i<count;i++) history.push(key);
  }
  return history;
}

/**
 * Applies XP and checks for level-up.
 * Fixes audit Finding 7:
 * - Never increments lifetimeWorkouts unless workoutCountDelta is explicitly provided (or cause === 'WORKOUT').
 * - Respects explicit gymXpBonus === 0 without falling back to personal xpEarned.
 */
export function applyProgressionUpdate(
  current: RPGCharacterState,
  xpEarned: number,
  statsDelta?: { strength?: number; endurance?: number; discipline?: number; recovery?: number },
  gymXpBonus?: number,
  options?: ProgressionUpdateOptions
): {
  updatedState: RPGCharacterState;
  didLevelUp: boolean;
  oldLevel: number;
  newLevel: number;
} {
  const oldLevel = current.level;
  const newTotalXp = Math.max(0, current.xp + xpEarned);
  const newLevel = calculateLevelFromXP(newTotalXp);
  const didLevelUp = newLevel > oldLevel;

  const currentLevelBaseXp = getMinXpForLevel(newLevel);
  const nextLevelXp = getNextLevelXpThreshold(newLevel);
  const hunterRank = getHunterRank(newLevel);

  const levelDiff = newLevel - oldLevel;
  const additionalStatPoints = levelDiff !== 0 ? levelDiff * 3 : 0;
  const allocations = getStatAllocations(current);
  const allocationRevocations = {strength:0,endurance:0,discipline:0,recovery:0};
  let debt = Math.max(0, -(current.unallocatedStatPoints + additionalStatPoints));
  while (debt > 0 && allocations.length) {
    allocationRevocations[allocations.pop()!]++;
    debt--;
  }

  // Only count actual workouts toward lifetimeWorkouts (check-ins, recovery, and quest claims default to 0)
  const workoutDelta =
    typeof options?.workoutCountDelta === 'number'
      ? options.workoutCountDelta
      : options?.cause === 'WORKOUT' && xpEarned > 0
      ? 1
      : 0;

  // Explicit 0 gymXpBonus stays 0!
  const effectiveGymXpDelta = typeof gymXpBonus === 'number' ? gymXpBonus : 0;

  const updatedState: RPGCharacterState = {
    ...current,
    level: newLevel,
    xp: newTotalXp,
    currentLevelBaseXp,
    nextLevelXp,
    hunterRank,
    unallocatedStatPoints: Math.max(0, current.unallocatedStatPoints + additionalStatPoints),
    statAllocations: allocations,
    stats: {
      strength: Math.max(1, current.stats.strength + (statsDelta?.strength || 0) - allocationRevocations.strength),
      endurance: Math.max(1, current.stats.endurance + (statsDelta?.endurance || 0) - allocationRevocations.endurance),
      discipline: Math.max(1, current.stats.discipline + (statsDelta?.discipline || 0) - allocationRevocations.discipline),
      recovery: Math.max(1, current.stats.recovery + (statsDelta?.recovery || 0) - allocationRevocations.recovery),
    },
    personalProgress: {
      ...current.personalProgress,
      totalXp: newTotalXp,
      lifetimeWorkouts: Math.max(0, current.personalProgress.lifetimeWorkouts + workoutDelta),
    },
    gymContext: {
      ...current.gymContext,
      localGymXp: Math.max(0, current.gymContext.localGymXp + effectiveGymXpDelta),
    },
  };

  return {
    updatedState,
    didLevelUp,
    oldLevel,
    newLevel,
  };
}
