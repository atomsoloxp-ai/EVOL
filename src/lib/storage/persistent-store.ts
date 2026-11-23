// Persistent Zustand Store for EVOL (EVOL.md Section 1, 3, 5)

import { create } from 'zustand';
import { isValidPersistedState, validateWorkoutInput } from './validation';
import { reconcileWorkoutHistory } from '../engines/workout-reconciliation';
import {
  CurrentMemberState,
  HunterProfile,
  ReadinessMetrics,
  NutritionRecoveryState,
  TrainingProgressState,
  RPGCharacterState,
  CalendarDayRecord,
} from '../../types/member-state';
import {
  WorkoutExercise,
  WorkoutSessionRecord,
  ExercisePRRecord,
  RecoveryLogRecord,
  EVOLEvent,
  ActivitySource,
  DailyNutritionRecord,
} from '../../types/events';
import {
  SystemQuest,
  DungeonGate,
  SystemCoachMessage,
  NextSessionPlan,
  RewardGrantRecord,
} from '../../types/rpg';
import { calculateEnergyExpenditure } from '../engines/body-intelligence';
import {
  analyzeWorkoutProgress,
  recalculateHistoricalMetrics,
} from '../engines/training-engine';
import {
  buildNutritionRecoverySnapshot,
  deriveReadinessFromHistory,
} from '../engines/recovery-engine';
import {
  calculateWorkoutXp,
  applyProgressionUpdate,
  getStatAllocations,
} from '../engines/rpg-engine';
import { synthesizeMemberContext } from '../engines/context-engine';
import {
  generateSystemQuests,
  generateSystemCoachResponse,
  reconcileQuestsWithState,
  getDailyDateKey,
} from '../engines/quest-engine';
import { eventBus } from '../events/event-bus';
import { sound } from '../audio/sound-fx';
import {
  processStreakCompletion,
  getActiveStreakCount,
} from '../engines/streak-engine';

export interface SystemModalState {
  isOpen: boolean;
  type: 'ALERT' | 'LEVEL_UP' | 'PENALTY' | 'QUEST_CLEAR' | 'GATE_CLEAR';
  title: string;
  subTitle: string;
  details?: string;
  statBonus?: { strength?: number; endurance?: number; discipline?: number; recovery?: number };
}

export interface PendingTimerReviewState {
  questId: string;
  sessionName: string;
  elapsedSeconds: number;
  measuredDurationMinutes: number;
  exercises: WorkoutExercise[];
}

interface EvolStoreState {
  currentDayKey: string;
  profile: HunterProfile;
  rpg: RPGCharacterState;
  readiness: ReadinessMetrics;
  nutrition: NutritionRecoveryState;
  training: TrainingProgressState;
  assignedSessionPlan: NextSessionPlan | null;
  quests: SystemQuest[];
  dungeonGate: DungeonGate;
  coachMessages: SystemCoachMessage[];
  systemModal: SystemModalState | null;
  storageWarning: string | null;
  processedEventIds: string[];
  recentWorkoutHistory: Array<{
    id: string;
    name: string;
    date: string;
    tonnageKg: number;
    sets: number;
    prsEarned: number;
    source?: string;
  }>;

  // Live Timer & Review State
  activeWorkoutTimer: {
    questId: string;
    startedAt?: number;
    pausedAt?: number;
    elapsedMs: number;
    isRunning: boolean;
    isPaused: boolean;
  } | null;
  pendingTimerReview: PendingTimerReviewState | null;
  lastQuestCompletedAt?: number;
  lastWorkoutCompletedAt?: number;
  pendingHonestyCheckQuestId: string | null;
  isApologyModalOpen: boolean;

  // Actions
  refreshDailyStateIfNeeded: (referenceDate?: Date) => void;
  simulateCheckIn: () => void;
  startWorkoutTimer: (questId: string) => void;
  pauseWorkoutTimer: () => void;
  resumeWorkoutTimer: () => void;
  stopWorkoutTimer: () => number;
  finishWorkoutTimerForReview: (questId: string) => PendingTimerReviewState | null;
  cancelTimerReview: () => void;
  submitTimerWorkoutReview: (reviewInput: {
    name: string;
    durationMinutes: number;
    durationEditedReason?: string;
    exercises: WorkoutExercise[];
  }) => void;
  setPendingHonestyCheck: (questId: string | null) => void;
  confirmHonestyQuestClaim: (questId: string) => void;
  openApologyModal: () => void;
  closeApologyModal: () => void;
  completePenaltyOath: () => void;
  logQuickHydration: (amountMl: number) => void;
  logQuickProtein: (amountGrams: number) => void;
  logQuickSleep: (hours: number) => void;
  triggerAntiCheatPenalty: (reason: string) => void;
  logWorkout: (workout: {
    id?: string;
    memberId?: string;
    gymId?: string;
    date?: string;
    version?: number;
    name: string;
    durationMinutes: number;
    measuredDurationSeconds?: number;
    durationEditedReason?: string;
    exercises: WorkoutExercise[];
    source?: ActivitySource;
    notes?: string;
  }) => void;
  editWorkout: (
    sessionId: string,
    updated: {
      name?: string;
      durationMinutes?: number;
      exercises?: WorkoutExercise[];
      notes?: string;
      date?: string;
      version?: number;
      gymId?: string;
      source?: ActivitySource;
    }
  ) => void;
  deleteWorkout: (sessionId: string) => void;
  logRecovery: (input: {
    sleepHours: number;
    subjectiveReadiness: number;
    hrvMs?: number;
    proteinGrams: number;
    notes?: string;
  }) => void;
  claimQuest: (questId: string) => void;
  allocateStat: (statKey: 'strength' | 'endurance' | 'discipline' | 'recovery') => void;
  updateProfile: (updated: Partial<HunterProfile>) => void;
  completeOnboarding: (onboardingData: Partial<HunterProfile>) => void;
  switchAvatar: (avatarId: 'monarch' | 'assassin' | 'knight') => void;
  switchGymFacility: (newGymId: string, newGymName: string, squadName?: string) => void;
  sendCoachPrompt: (prompt: string, persona?: 'SYSTEM_ADMIN' | 'SHADOW_BERU' | 'ARCHITECT') => void;
  closeSystemModal: () => void;
  dismissStorageWarning: () => void;
  exportStateJson: () => string;
  importStateJson: (rawJson: string) => boolean;
  triggerEmergencyDeloadTest: () => void;
  resetGateBoss: () => void;
  activateStreakFreeze: () => void;
  getSynthesizedState: () => CurrentMemberState;
  processActivity: (event: EVOLEvent) => void;
  resetToNewUser: () => void;
  loadDemoSimulation: () => void;
}

// ============================================================================
// CLEAN NEW USER BASELINE (HONEST UNMEASURED PROVENANCE)
// ============================================================================
const INITIAL_BMR = calculateEnergyExpenditure(75, 178, 24, 'MALE', 1.55, 'MUSCLE_GAIN');

export const CLEAN_NEW_PROFILE: HunterProfile = {
  id: 'hunter-novice',
  name: 'New Member',
  hunterTitle: 'Getting Stronger Every Day',
  avatarId: 'monarch',
  avatarUrl: '/assets/avatar-monarch.jpg',
  gender: 'MALE',
  ageYears: 24,
  fitnessGoal: 'MUSCLE_GAIN',
  experienceLevel: 'BEGINNER',
  availableEquipment: 'FULL_GYM',
  preferredSessionDurationMinutes: 60,
  preferredTrainingDays: [1, 3, 5],
  activeLimitations: [],
  currentWeightKg: 75,
  targetWeightKg: 75,
  bodyFatPct: undefined, // Unmeasured until user records body composition
  muscleMassKg: undefined, // Unmeasured until user records body composition
  heightCm: 178,
  activityMultiplier: 1.55,
  targetProteinGrams: INITIAL_BMR.proteinGramsTarget,
  daysAvailablePerWeek: 3,
  measurementHistory: [],
  onboardingCompleted: false,
  gymId: 'facility-local',
  gymName: 'Local Gym',
  squadName: 'Community Group',
};

export const CLEAN_NEW_WORKOUT_HISTORY: WorkoutSessionRecord[] = [];
export const CLEAN_NEW_HISTORICAL_PRS: Record<string, ExercisePRRecord> = {};

export const CLEAN_NEW_READINESS: ReadinessMetrics = {
  score: 100,
  status: 'OPTIMAL',
  isCalibrated: false,
  fatigueIndex: 0,
  acuteFatigueStrain: 0,
  sleepHoursLastNight: 0,
  hrvMs: undefined,
  recoveryDeficit: false,
  deloadRecommended: false,
  acwrRatio: 1.0,
  acwrStatus: 'CALIBRATING',
  acwrIsCalibrated: false,
  readinessExplanation: 'Baseline readiness estimate. Log sleep and recovery to calibrate.',
  lastAssessmentTimestamp: new Date().toISOString(),
};

export const CLEAN_NEW_NUTRITION: NutritionRecoveryState = {
  proteinAdherencePct: 0,
  todayProteinGrams: 0,
  targetProteinGrams: INITIAL_BMR.proteinGramsTarget,
  todayHydrationMl: 0,
  sleepHoursLastNight: 0,
  targetSleepHours: 8.0,
  recoveryScore: 100,
  recoveryDeficit: false,
  recentLogs: [],
  dailyNutritionLogs: {},
};

export const CLEAN_NEW_TRAINING: TrainingProgressState = {
  volumeTrend: 'STABLE',
  weeklyTonnageKg: 0,
  rollingVolume7dKg: 0,
  rollingVolume28dKg: 0,
  plateauDetected: false,
  acwr: {
    ratio: 1.0,
    status: 'CALIBRATING',
    isCalibrated: false,
    sessionsCount28d: 0,
    historySpanDays: 0,
    recommendation:
      'Calibrating workload baseline (requires at least 4 sessions across 10+ days before ACWR ratio overrides apply).',
  },
  recentPRs: [],
  historicalPRs: CLEAN_NEW_HISTORICAL_PRS,
  workoutHistory: CLEAN_NEW_WORKOUT_HISTORY,
  muscleGroupVolumes: {},
  exerciseTrends: {},
};

export const CLEAN_NEW_RPG: RPGCharacterState = {
  level: 1,
  xp: 0,
  currentLevelBaseXp: 0,
  nextLevelXp: 400,
  hunterRank: 'E-RANK',
  unallocatedStatPoints: 5,
  stats: {
    strength: 10,
    endurance: 10,
    discipline: 10,
    recovery: 10,
  },
  streakDays: 0,
  trainingStreakDays: 0,
  lastStreakDate: '',
  lastCheckInDate: '',
  longestStreak: 0,
  streakFreezeActive: false,
  activityCalendar: {},
  grantLedger: {},
  lastActiveDate: new Date().toISOString(),
  personalProgress: {
    totalXp: 0,
    lifetimeWorkouts: 0,
    achievementsUnlocked: ['AWAKENING_INITIALIZED'],
    claimedRewardsHistory: [],
  },
  gymContext: {
    localGymId: 'facility-local',
    localGymName: 'Local Facility',
    localGymXp: 0,
    facilityRank: null, // Unranked until connected to verified facility leaderboard
    squadName: 'Solo Adventurer',
    squadRank: null,
    isDemoScenario: false,
    archivedFacilities: [],
  },
};

export const CLEAN_NEW_DUNGEON_GATE: DungeonGate = {
  id: 'gate-e-01',
  name: 'Starter Volume Challenge',
  gateRank: 'E',
  bossName: 'Weekly Lifting Target (2,000 kg)',
  bossMaxHp: 2000,
  bossCurrentHp: 2000,
  recommendedTonnageKg: 2000,
  cleared: false,
  rewardGranted: false,
  rewards: {
    xp: 200,
    title: 'First Challenge Complete',
    item: 'Starter Finisher Badge',
  },
};

// ============================================================================
// OPTIONAL DEMO SEED DATASET (FOR TESTING & SIMULATION ONLY)
// ============================================================================
export const DEMO_SEED_PROFILE: HunterProfile = {
  id: 'hunter-001',
  name: 'Sung Jin-Woo',
  hunterTitle: 'Shadow Monarch (Awakened)',
  avatarId: 'monarch',
  avatarUrl: '/assets/avatar-monarch.jpg',
  gender: 'MALE',
  ageYears: 24,
  fitnessGoal: 'MUSCLE_GAIN',
  experienceLevel: 'ADVANCED',
  availableEquipment: 'FULL_GYM',
  preferredSessionDurationMinutes: 60,
  preferredTrainingDays: [1, 2, 4, 5, 6],
  activeLimitations: ['LEFT_SHOULDER_IMPINGEMENT'],
  currentWeightKg: 82,
  targetWeightKg: 85,
  bodyFatPct: 11.5,
  muscleMassKg: 42.8,
  heightCm: 184,
  activityMultiplier: 1.55,
  targetProteinGrams: 164,
  daysAvailablePerWeek: 5,
  measurementHistory: [
    { id: 'm-1', date: '2026-10-12T08:00:00Z', weightKg: 80.5, bodyFatPct: 12.0, muscleMassKg: 41.5 },
    { id: 'm-2', date: '2026-10-20T08:00:00Z', weightKg: 81.2, bodyFatPct: 11.8, muscleMassKg: 42.1 },
    { id: 'm-3', date: '2026-10-25T08:00:00Z', weightKg: 82.0, bodyFatPct: 11.5, muscleMassKg: 42.8 },
  ],
  onboardingCompleted: true,
  gymId: 'facility-alpha-seoul',
  gymName: 'Seoul Hunters Association HQ (Iron Alpha)',
  squadName: 'Ahjin Guild Strike Squad',
};

export const DEMO_SEED_WORKOUT_HISTORY: WorkoutSessionRecord[] = [
  {
    id: 'w-seed-1',
    source: 'MANUAL_SELF_REPORTED',
    name: 'Upper Body Compound Hypertrophy',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    exercises: [
      {
        exerciseId: 'dumbbell_neutral_incline_press',
        exerciseName: 'Dumbbell Neutral Incline Press',
        muscleGroup: 'CHEST',
        sets: [
          { id: 's-1', setIndex: 1, weightKg: 40, reps: 10, rpe: 8 },
          { id: 's-2', setIndex: 2, weightKg: 42.5, reps: 8, rpe: 8.5 },
          { id: 's-3', setIndex: 3, weightKg: 45, reps: 6, rpe: 9 },
        ],
      },
      {
        exerciseId: 'chest_supported_row',
        exerciseName: 'Chest-Supported Row',
        muscleGroup: 'BACK',
        sets: [
          { id: 's-4', setIndex: 1, weightKg: 75, reps: 10, rpe: 8 },
          { id: 's-5', setIndex: 2, weightKg: 85, reps: 8, rpe: 8.5 },
        ],
      },
      {
        exerciseId: 'incline_db_bicep_curl',
        exerciseName: 'Incline DB Bicep Curl',
        muscleGroup: 'ARMS',
        sets: [
          { id: 's-6', setIndex: 1, weightKg: 18, reps: 10, rpe: 8 },
          { id: 's-7', setIndex: 2, weightKg: 20, reps: 8, rpe: 8.5 },
        ],
      },
    ],
    totalTonnageKg: 2990,
    totalSets: 7,
    fatigueStrainPoints: 42,
    prsEarned: [
      {
        exerciseId: 'dumbbell_neutral_incline_press',
        exerciseName: 'Dumbbell Neutral Incline Press',
        oneRepMaxKg: 54,
        weightKg: 45,
        reps: 6,
        achievedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        sessionId: 'w-seed-1',
      },
    ],
    status: 'COMPLETED',
  },
  {
    id: 'w-seed-2',
    source: 'MANUAL_SELF_REPORTED',
    name: 'Posterior Chain & Quad Overload',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 65,
    exercises: [
      {
        exerciseId: 'romanian_deadlift',
        exerciseName: 'Romanian Deadlift',
        muscleGroup: 'LEGS',
        sets: [
          { id: 's-8', setIndex: 1, weightKg: 140, reps: 8, rpe: 8 },
          { id: 's-9', setIndex: 2, weightKg: 155, reps: 6, rpe: 8.5 },
        ],
      },
      {
        exerciseId: 'barbell_back_squat',
        exerciseName: 'Barbell Back Squat',
        muscleGroup: 'LEGS',
        sets: [
          { id: 's-10', setIndex: 1, weightKg: 120, reps: 8, rpe: 8 },
          { id: 's-11', setIndex: 2, weightKg: 130, reps: 6, rpe: 8.5 },
        ],
      },
    ],
    totalTonnageKg: 3790,
    totalSets: 4,
    fatigueStrainPoints: 46,
    prsEarned: [
      {
        exerciseId: 'romanian_deadlift',
        exerciseName: 'Romanian Deadlift',
        oneRepMaxKg: 186,
        weightKg: 155,
        reps: 6,
        achievedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        sessionId: 'w-seed-2',
      },
    ],
    status: 'COMPLETED',
  },
];

export const DEMO_SEED_HISTORICAL_PRS: Record<string, ExercisePRRecord> = {
  'Dumbbell Neutral Incline Press': {
    exerciseId: 'dumbbell_neutral_incline_press',
    exerciseName: 'Dumbbell Neutral Incline Press',
    oneRepMaxKg: 54,
    weightKg: 45,
    reps: 6,
    achievedAt: '1 day ago',
  },
  'Romanian Deadlift': {
    exerciseId: 'romanian_deadlift',
    exerciseName: 'Romanian Deadlift',
    oneRepMaxKg: 186,
    weightKg: 155,
    reps: 6,
    achievedAt: '3 days ago',
  },
};

export const DEMO_SEED_READINESS: ReadinessMetrics = {
  score: 84,
  status: 'OPTIMAL',
  isCalibrated: true,
  fatigueIndex: 38,
  acuteFatigueStrain: 38,
  sleepHoursLastNight: 7.8,
  hrvMs: 68,
  recoveryDeficit: false,
  deloadRecommended: false,
  acwrRatio: 1.05,
  acwrStatus: 'OPTIMAL',
  acwrIsCalibrated: true,
  readinessExplanation: 'Workload in optimal sweet-spot (ACWR 1.05). Systems primed for progressive overload.',
  lastAssessmentTimestamp: new Date().toISOString(),
};

export const DEMO_SEED_NUTRITION: NutritionRecoveryState = {
  proteinAdherencePct: 88,
  todayProteinGrams: 145,
  targetProteinGrams: 164,
  todayHydrationMl: 2000,
  sleepHoursLastNight: 7.8,
  targetSleepHours: 8.0,
  recoveryScore: 84,
  recoveryDeficit: false,
  recentLogs: [
    {
      id: 'rec-seed-1',
      dateKey: getDailyDateKey(),
      source: 'MANUAL_SELF_REPORTED',
      date: new Date().toISOString(),
      sleepHours: 7.8,
      hrvMs: 68,
      subjectiveReadiness: 8,
      proteinGrams: 145,
      computedScore: 84,
      strainAtLog: 38,
      status: 'COMPLETED',
    },
  ],
  dailyNutritionLogs: {
    [getDailyDateKey()]: {
      dateKey: getDailyDateKey(),
      proteinGrams: 145,
      hydrationMl: 2000,
      updatedAt: new Date().toISOString(),
    },
  },
};

export const DEMO_SEED_TRAINING: TrainingProgressState = {
  volumeTrend: 'UP',
  weeklyTonnageKg: 6780,
  rollingVolume7dKg: 6780,
  rollingVolume28dKg: 25800,
  plateauDetected: false,
  acwr: {
    ratio: 1.05,
    status: 'OPTIMAL',
    isCalibrated: true,
    sessionsCount28d: 12,
    historySpanDays: 24,
    recommendation: 'Sweet spot (0.8 - 1.3). Optimal adaptation zone.',
  },
  recentPRs: [
    { exerciseId: 'dumbbell_neutral_incline_press', exerciseName: 'Dumbbell Neutral Incline Press', oneRepMaxKg: 54, achievedAt: '1 day ago' },
    { exerciseId: 'romanian_deadlift', exerciseName: 'Romanian Deadlift', oneRepMaxKg: 186, achievedAt: '3 days ago' },
  ],
  historicalPRs: DEMO_SEED_HISTORICAL_PRS,
  workoutHistory: DEMO_SEED_WORKOUT_HISTORY,
  muscleGroupVolumes: {
    CHEST: 14,
    BACK: 16,
    LEGS: 18,
    SHOULDERS: 10,
    ARMS: 12,
  },
  exerciseTrends: {
    'Dumbbell Neutral Incline Press': { last1RM: 54, trend: 'UP' },
    'Romanian Deadlift': { last1RM: 186, trend: 'UP' },
  },
};

export const DEMO_SEED_RPG: RPGCharacterState = {
  level: 18,
  xp: 32400,
  currentLevelBaseXp: 32400,
  nextLevelXp: 36100,
  hunterRank: 'C-RANK',
  unallocatedStatPoints: 4,
  stats: {
    strength: 48,
    endurance: 34,
    discipline: 52,
    recovery: 31,
  },
  streakDays: 6,
  trainingStreakDays: 4,
  lastStreakDate: getDailyDateKey(),
  lastCheckInDate: getDailyDateKey(),
  longestStreak: 14,
  streakFreezeActive: false,
  activityCalendar: {
    [getDailyDateKey()]: {
      date: getDailyDateKey(),
      checkedIn: true,
      checkedInAt: new Date().toISOString(),
      recoveryXpAwarded: true,
      workoutsCount: 1,
      workoutXpAwardedCount: 1,
      questsClaimedIds: [],
      totalXpEarnedToday: 420,
      streakCountAtDay: 6,
    },
  },
  grantLedger: {},
  lastActiveDate: new Date().toISOString(),
  personalProgress: {
    totalXp: 32400,
    lifetimeWorkouts: 2,
    achievementsUnlocked: ['FIRST_AWAKENING', 'TONNAGE_TITAN_10K', 'SHADOW_STREAK_7D'],
    claimedRewardsHistory: [],
  },
  gymContext: {
    localGymId: 'facility-alpha-seoul',
    localGymName: 'Iron Alpha Facility (Demo)',
    localGymXp: 8600,
    facilityRank: 3,
    squadName: 'Ahjin Guild Strike Squad',
    squadRank: 1,
    isDemoScenario: true,
    archivedFacilities: [],
  },
};

export const DEMO_SEED_DUNGEON_GATE: DungeonGate = {
  id: 'gate-red-01',
  name: 'Red Gate: Ice Elf Cavern Raid',
  gateRank: 'B',
  bossName: 'Baruka (Ice Monarch Chieftain)',
  bossMaxHp: 8000,
  bossCurrentHp: 4600,
  recommendedTonnageKg: 6000,
  cleared: false,
  rewardGranted: false,
  rewards: {
    xp: 500,
    title: 'B-Rank Dungeon Conqueror',
    item: "Baruka's Dagger of Frost",
  },
};

// ============================================================================
// STORAGE VALIDATION, VERSIONED MIGRATION & RECOVERY
// ============================================================================
const LOCAL_STORAGE_KEY = 'evol_progression_store_v3';
const CORRUPTED_BACKUP_KEY = 'evol_corrupted_backup';

function isValidPersistedShape(obj: unknown): boolean {
  return isValidPersistedState(obj);
}

function loadPersistedState(): { state: Partial<EvolStoreState>; warning: string | null } {
  if (typeof window === 'undefined') return { state: {}, warning: null };
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!isValidPersistedShape(parsed)) {
        localStorage.setItem(CORRUPTED_BACKUP_KEY, raw);
        return {
          state: {},
          warning:
            'Saved state had an invalid schema structure. A backup was preserved in evol_corrupted_backup and safe defaults were loaded.',
        };
      }
      // Preserve the exact pre-upgrade snapshot; never discard valid progress
      // just because the browser cannot allocate room for an extra backup.
      let warning: string | null = null;
      if (parsed.schemaVersion !== 4) {
        try {
          if (!localStorage.getItem('evol_before_reconciliation_v4')) localStorage.setItem('evol_before_reconciliation_v4', raw);
        } catch {
          warning = 'Progress loaded, but the browser could not save the pre-upgrade backup. Export your data before making corrections.';
        }
      }
      return { state: parsed, warning };
    }

    // Schema-based v2 migration (never discards legitimate progress based solely on character name)
    const oldRaw = localStorage.getItem('evol_progression_store_v2');
    if (oldRaw) {
      const parsed = JSON.parse(oldRaw);
      if (isValidPersistedShape(parsed)) {
        const hasRealActivity =
          parsed.profile?.onboardingCompleted ||
          (Array.isArray(parsed.training?.workoutHistory) && parsed.training.workoutHistory.length > 0) ||
          (parsed.rpg?.xp && parsed.rpg.xp > 0);
        if (hasRealActivity) {
          return { state: parsed, warning: null };
        }
      }
    }
  } catch (e) {
    try {
      const rawBroken = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (rawBroken) localStorage.setItem(CORRUPTED_BACKUP_KEY, rawBroken);
    } catch {
      // ignore
    }
    return {
      state: {},
      warning:
        'Saved local storage data was corrupted or malformed JSON. Backup saved to evol_corrupted_backup; started with clean state.',
    };
  }
  return { state: {}, warning: null };
}

function saveState(state: EvolStoreState, setWarning?: (msg: string) => void) {
  if (typeof window === 'undefined') return true;
  try {
    const serialized = JSON.stringify({
      schemaVersion: 4,
      currentDayKey: state.currentDayKey,
      profile: state.profile,
      rpg: state.rpg,
      readiness: state.readiness,
      nutrition: state.nutrition,
      training: state.training,
      assignedSessionPlan: state.assignedSessionPlan,
      quests: state.quests,
      dungeonGate: state.dungeonGate,
      recentWorkoutHistory: state.recentWorkoutHistory,
      activeWorkoutTimer: state.activeWorkoutTimer,
      processedEventIds: (state.processedEventIds || []).slice(-200),
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
    return true;
  } catch (e: any) {
    const msg = `Storage quota or write failure: ${e?.message || 'Unable to save progress to localStorage.'}`;
    if (setWarning) setWarning(msg);
    return false;
  }
}

export const useEvolStore = create<EvolStoreState>((set, get) => {
  const { state: persisted, warning: initialStorageWarning } = loadPersistedState();
  const todayKey = getDailyDateKey();

  const profile: HunterProfile = { ...CLEAN_NEW_PROFILE, ...(persisted.profile || {}) };
  // Canonical protein target sync between profile and nutrition
  const canonicalBmr = calculateEnergyExpenditure(
    profile.currentWeightKg,
    profile.heightCm,
    profile.ageYears || 24,
    profile.gender || 'MALE',
    profile.activityMultiplier || 1.55,
    profile.fitnessGoal
  );
  const canonicalProteinTarget = profile.targetProteinGrams || canonicalBmr.proteinGramsTarget;
  profile.targetProteinGrams = canonicalProteinTarget;

  const rawRpg: RPGCharacterState = {
    ...CLEAN_NEW_RPG,
    ...(persisted.rpg || {}),
    stats: {...CLEAN_NEW_RPG.stats,...(persisted.rpg?.stats || {})},
    personalProgress: {
      ...CLEAN_NEW_RPG.personalProgress,
      ...(persisted.rpg?.personalProgress || {}),
    },
    gymContext: {
      ...CLEAN_NEW_RPG.gymContext,
      ...(persisted.rpg?.gymContext || {}),
    },
    activityCalendar: persisted.rpg?.activityCalendar || {},
    grantLedger: persisted.rpg?.grantLedger || {},
  };

  if (!rawRpg.gymContext.isDemoScenario && rawRpg.gymContext.facilityRank === 1 && rawRpg.gymContext.localGymXp === 0) {
    rawRpg.gymContext.facilityRank = null;
    rawRpg.gymContext.squadRank = null;
  }

  for (const grant of Object.values(rawRpg.grantLedger || {})) {
    if (!grant.gymId) {
      const session = persisted.training?.workoutHistory?.find(w=>w.id===grant.sourceId);
      grant.gymId = session?.gymId || rawRpg.gymContext.localGymId;
    }
    if(grant.cause==='WORKOUT' && !grant.gateId) grant.gateId = persisted.dungeonGate?.id || CLEAN_NEW_DUNGEON_GATE.id;
  }
  const effectiveStreak = getActiveStreakCount(rawRpg.streakDays, rawRpg.lastStreakDate || '');
  const rpg: RPGCharacterState = {
    ...rawRpg,
    streakDays: effectiveStreak,
  };

  const persistedWorkouts = Array.isArray(persisted.training?.workoutHistory)
    ? persisted.training!.workoutHistory
    : CLEAN_NEW_WORKOUT_HISTORY;

  // Always recompute rolling 7d/28d metrics, PRs, and ACWR from durable timestamps on load!
  const initialHistMetrics = recalculateHistoricalMetrics(persistedWorkouts);

  const training: TrainingProgressState = {
    ...CLEAN_NEW_TRAINING,
    ...(persisted.training || {}),
    weeklyTonnageKg: initialHistMetrics.rollingVolume7dKg,
    rollingVolume7dKg: initialHistMetrics.rollingVolume7dKg,
    rollingVolume28dKg: initialHistMetrics.rollingVolume28dKg,
    acwr: initialHistMetrics.acwr,
    plateauDetected: initialHistMetrics.plateauDetected,
    muscleGroupVolumes: initialHistMetrics.muscleGroupVolumes7d,
    exerciseTrends: initialHistMetrics.exerciseTrends,
    historicalPRs:
      persistedWorkouts.length > 0
        ? initialHistMetrics.recomputedHistoricalPRs
        : persisted.training?.historicalPRs || CLEAN_NEW_HISTORICAL_PRS,
    recentPRs:
      persistedWorkouts.length > 0
        ? initialHistMetrics.recomputedRecentPRs
        : persisted.training?.recentPRs || [],
    workoutHistory: persistedWorkouts,
  };

  // Date-aware nutrition loading: only use today's protein/hydration for todayKey!
  const rawNutrition: NutritionRecoveryState = {
    ...CLEAN_NEW_NUTRITION,
    ...(persisted.nutrition || {}),
    targetProteinGrams: canonicalProteinTarget,
    recentLogs: Array.isArray(persisted.nutrition?.recentLogs) ? persisted.nutrition!.recentLogs : [],
    dailyNutritionLogs: persisted.nutrition?.dailyNutritionLogs || {},
  };

  const todayNutritionEntry = rawNutrition.dailyNutritionLogs?.[todayKey];
  const todayRecLog = rawNutrition.recentLogs.find(
    (l) => (l.dateKey || getDailyDateKey(new Date(l.date))) === todayKey
  );
  const effectiveTodayProtein =
    todayNutritionEntry !== undefined
      ? todayNutritionEntry.proteinGrams
      : todayRecLog
      ? todayRecLog.proteinGrams
      : persisted.currentDayKey === todayKey
      ? rawNutrition.todayProteinGrams
      : 0;
  const effectiveTodayHydration =
    todayNutritionEntry !== undefined
      ? todayNutritionEntry.hydrationMl
      : persisted.currentDayKey === todayKey
      ? rawNutrition.todayHydrationMl || 0
      : 0;

  const nutrition: NutritionRecoveryState = {
    ...rawNutrition,
    todayProteinGrams: effectiveTodayProtein,
    todayHydrationMl: effectiveTodayHydration,
    proteinAdherencePct: Math.min(
      100,
      Math.round((effectiveTodayProtein / Math.max(1, canonicalProteinTarget)) * 100)
    ),
  };

  const readiness: ReadinessMetrics =
    persistedWorkouts.length > 0 || nutrition.recentLogs.length > 0
      ? deriveReadinessFromHistory(
          persistedWorkouts,
          nutrition.recentLogs,
          {
            todayProteinGrams: nutrition.todayProteinGrams,
            targetProteinGrams: nutrition.targetProteinGrams,
            targetSleepHours: nutrition.targetSleepHours,
          },
          training.acwr
        )
      : { ...CLEAN_NEW_READINESS, ...(persisted.readiness || {}) };

  const dungeonGate = persisted.dungeonGate || CLEAN_NEW_DUNGEON_GATE;

  // Synthesize context & preserve frozen assignedSessionPlan if already assigned for todayKey
  const tempContext = synthesizeMemberContext(profile, readiness, nutrition, training, rpg);
  const initialAssignedPlan =
    persisted.assignedSessionPlan && persisted.assignedSessionPlan.dateKey === todayKey
      ? persisted.assignedSessionPlan
      : tempContext.nextSessionPlan;
  const context = synthesizeMemberContext(
    profile,
    readiness,
    nutrition,
    training,
    rpg,
    initialAssignedPlan
  );

  const initialQuests = generateSystemQuests(context, persisted.quests || []);
  const initialCoach = generateSystemCoachResponse(context, 'SYSTEM_ADMIN');

  const recentWorkoutHistory = training.workoutHistory.slice(0, 20).map((w) => ({
    id: w.id,
    name: w.name,
    date: new Date(w.date).toLocaleDateString(),
    tonnageKg: w.totalTonnageKg,
    sets: w.totalSets,
    prsEarned: (w.prsEarned || []).length,
    source: w.source,
  }));

  // Subscribe to decoupled event bus ONLY for inbound external events (ignoring post-commit notifications!)
  eventBus.subscribe((event) => {
    if (event.isPostCommitNotification) return;
    if (event.type === 'WORKOUT_COMPLETED' && event.workout?.source === 'ATOM_OS_VERIFIED') {
      get().processActivity(event);
    }
  });

  const persistWithWarning = () => {
    return saveState(get(), (msg) => set({ storageWarning: msg }));
  };


  const reconcileHistory = (history: WorkoutSessionRecord[]) => {
    const state = get();
    const reconciled = reconcileWorkoutHistory(state, history);
    const readiness = deriveReadinessFromHistory(reconciled.training.workoutHistory, state.nutrition.recentLogs,
      {todayProteinGrams:state.nutrition.todayProteinGrams,targetProteinGrams:state.nutrition.targetProteinGrams,targetSleepHours:state.nutrition.targetSleepHours},reconciled.training.acwr);
    const context = synthesizeMemberContext(state.profile,readiness,state.nutrition,reconciled.training,reconciled.rpg,state.assignedSessionPlan);
    set({...reconciled,readiness,quests:reconcileQuestsWithState(state.quests,context),recentWorkoutHistory:reconciled.training.workoutHistory.slice(0,20).map(w=>({id:w.id,name:w.name,date:new Date(w.date).toLocaleDateString(),tonnageKg:w.totalTonnageKg,sets:w.totalSets,prsEarned:w.prsEarned.length,source:w.source}))});
    persistWithWarning();
  };

  return {
    currentDayKey: todayKey,
    profile,
    rpg,
    readiness,
    nutrition,
    training,
    assignedSessionPlan: initialAssignedPlan,
    quests: initialQuests,
    dungeonGate,
    coachMessages: [initialCoach],
    systemModal: null,
    storageWarning: initialStorageWarning,
    processedEventIds: Array.isArray(persisted.processedEventIds) ? persisted.processedEventIds : [],
    recentWorkoutHistory,

    // Live Timer & Review State
    activeWorkoutTimer: persisted.activeWorkoutTimer || null,
    pendingTimerReview: null,
    lastQuestCompletedAt: undefined,
    lastWorkoutCompletedAt: undefined,
    pendingHonestyCheckQuestId: null,
    isApologyModalOpen: false,

    refreshDailyStateIfNeeded: (referenceDate = new Date()) => {
      const state = get();
      const nowKey = getDailyDateKey(referenceDate);
      const nowMs = referenceDate.getTime();

      const histMetrics = recalculateHistoricalMetrics(state.training.workoutHistory, nowMs);
      const isNewDay = state.currentDayKey !== nowKey;

      const dayNutrition = state.nutrition.dailyNutritionLogs?.[nowKey];
      const dayRecovery = state.nutrition.recentLogs.find(
        (l) => (l.dateKey || getDailyDateKey(new Date(l.date))) === nowKey
      );

      const todayProteinGrams = isNewDay
        ? dayNutrition?.proteinGrams ?? dayRecovery?.proteinGrams ?? 0
        : state.nutrition.todayProteinGrams;
      const todayHydrationMl = isNewDay
        ? dayNutrition?.hydrationMl ?? 0
        : state.nutrition.todayHydrationMl || 0;

      const updatedNutrition: NutritionRecoveryState = {
        ...state.nutrition,
        todayProteinGrams,
        todayHydrationMl,
        proteinAdherencePct: Math.min(
          100,
          Math.round((todayProteinGrams / Math.max(1, state.nutrition.targetProteinGrams)) * 100)
        ),
      };

      const updatedTraining: TrainingProgressState = {
        ...state.training,
        weeklyTonnageKg: histMetrics.rollingVolume7dKg,
        rollingVolume7dKg: histMetrics.rollingVolume7dKg,
        rollingVolume28dKg: histMetrics.rollingVolume28dKg,
        acwr: histMetrics.acwr,
        plateauDetected: histMetrics.plateauDetected,
        muscleGroupVolumes: histMetrics.muscleGroupVolumes7d,
        exerciseTrends: histMetrics.exerciseTrends,
        historicalPRs: histMetrics.recomputedHistoricalPRs,
        recentPRs: histMetrics.recomputedRecentPRs,
      };

      const updatedReadiness = deriveReadinessFromHistory(
        state.training.workoutHistory,
        updatedNutrition.recentLogs,
        {
          todayProteinGrams: updatedNutrition.todayProteinGrams,
          targetProteinGrams: updatedNutrition.targetProteinGrams,
          targetSleepHours: updatedNutrition.targetSleepHours,
        },
        histMetrics.acwr,
        nowMs
      );

      const effectiveStreak = getActiveStreakCount(
        state.rpg.streakDays,
        state.rpg.lastStreakDate || '',
        referenceDate
      );
      const updatedRpg: RPGCharacterState = {
        ...state.rpg,
        streakDays: effectiveStreak,
      };

      const tempContext = synthesizeMemberContext(
        state.profile,
        updatedReadiness,
        updatedNutrition,
        updatedTraining,
        updatedRpg,
        null,
        referenceDate
      );

      const newAssignedPlan =
        !isNewDay && state.assignedSessionPlan && state.assignedSessionPlan.dateKey === nowKey
          ? state.assignedSessionPlan
          : tempContext.nextSessionPlan;

      const finalContext = synthesizeMemberContext(
        state.profile,
        updatedReadiness,
        updatedNutrition,
        updatedTraining,
        updatedRpg,
        newAssignedPlan,
        referenceDate
      );

      const updatedQuests = generateSystemQuests(finalContext, state.quests, {
        forceRegenerateMainPrescription: isNewDay,
        referenceDate,
      });

      set({
        currentDayKey: nowKey,
        nutrition: updatedNutrition,
        training: updatedTraining,
        readiness: updatedReadiness,
        rpg: updatedRpg,
        assignedSessionPlan: newAssignedPlan,
        quests: updatedQuests,
      });
      persistWithWarning();
    },

    startWorkoutTimer: (questId) => {
      sound.playClick();
      set({
        activeWorkoutTimer: {
          questId,
          startedAt: Date.now(),
          pausedAt: undefined,
          elapsedMs: 0,
          isRunning: true,
          isPaused: false,
        },
      });
      persistWithWarning();
    },

    pauseWorkoutTimer: () => {
      const timer = get().activeWorkoutTimer;
      if (!timer || !timer.startedAt || timer.isPaused) return;
      sound.playClick();
      const now = Date.now();
      const elapsed = timer.elapsedMs + (now - timer.startedAt);
      set({
        activeWorkoutTimer: {
          ...timer,
          startedAt: undefined,
          pausedAt: now,
          elapsedMs: elapsed,
          isRunning: false,
          isPaused: true,
        },
      });
      persistWithWarning();
    },

    resumeWorkoutTimer: () => {
      const timer = get().activeWorkoutTimer;
      if (!timer || !timer.isPaused) return;
      sound.playClick();
      set({
        activeWorkoutTimer: {
          ...timer,
          startedAt: Date.now(),
          pausedAt: undefined,
          isRunning: true,
          isPaused: false,
        },
      });
      persistWithWarning();
    },

    stopWorkoutTimer: () => {
      const timer = get().activeWorkoutTimer;
      if (!timer) return 0;
      sound.playClick();
      const now = Date.now();
      let totalElapsed = timer.elapsedMs;
      if (timer.startedAt && !timer.pausedAt) {
        totalElapsed += now - timer.startedAt;
      }
      const minutes = Math.max(0, Math.round(totalElapsed / 60000));
      set({
        activeWorkoutTimer: null,
      });
      persistWithWarning();
      return minutes;
    },

    finishWorkoutTimerForReview: (questId) => {
      const state = get();
      const timer = state.activeWorkoutTimer;
      sound.playClick();

      const now = Date.now();
      let totalElapsedMs = timer ? timer.elapsedMs : 0;
      if (timer?.startedAt && !timer.pausedAt) {
        totalElapsedMs += now - timer.startedAt;
      }
      const elapsedSeconds = Math.max(0, Math.round(totalElapsedMs / 1000));
      const measuredDurationMinutes = Math.max(1, Math.round(totalElapsedMs / 60000));

      const plan = state.assignedSessionPlan || state.getSynthesizedState().nextSessionPlan;
      // Critical Fix (Finding 1): Do NOT auto-confirm sets or fabricate performance from elapsed time!
      // All sets start unconfirmed (confirmed: false) so the user must explicitly confirm what they actually performed.
      const draftExercises: WorkoutExercise[] = (plan?.exercises || []).map((ex, idx) => ({
        exerciseId: ex.exerciseId || `ex-${idx}`,
        exerciseName: ex.exerciseName,
        muscleGroup: ex.muscleGroup || 'CHEST',
        sets: Array.from({ length: ex.targetSets }).map((_, sIdx) => ({
          id: `timer-s-${idx}-${sIdx}`,
          setIndex: sIdx + 1,
          weightKg: ex.isBodyweight ? 0 : ex.suggestedWeightKg || 20,
          reps: ex.targetRepRange[0] || 10,
          rpe: ex.rpeTarget || 8,
          isWarmup: false,
          confirmed: false,
        })),
      }));

      const reviewState: PendingTimerReviewState = {
        questId,
        sessionName: plan?.sessionName || 'Daily Workout',
        elapsedSeconds,
        measuredDurationMinutes,
        exercises: draftExercises,
      };

      set({
        activeWorkoutTimer: null,
        pendingTimerReview: reviewState,
      });
      persistWithWarning();
      return reviewState;
    },

    cancelTimerReview: () => {
      sound.playClick();
      set({ pendingTimerReview: null });
    },

    submitTimerWorkoutReview: (reviewInput) => {
      const state = get();
      // Filter to only sets explicitly confirmed as performed
      const confirmedExercises: WorkoutExercise[] = reviewInput.exercises
        .map((ex) => ({
          ...ex,
          sets: ex.sets.filter((s) => s.confirmed === true && (s.reps || 0) > 0),
        }))
        .filter((ex) => ex.sets.length > 0);

      if (confirmedExercises.length === 0) {
        set({
          systemModal: {
            isOpen: true,
            type: 'ALERT',
            title: 'No Performed Sets Confirmed',
            subTitle: 'Check at least one completed set',
            details:
              'Timer completion requires confirming the sets you actually performed before logging a workout or awarding XP.',
          },
        });
        return;
      }

      const measuredSecs = state.pendingTimerReview?.elapsedSeconds;
      set({ pendingTimerReview: null });

      get().logWorkout({
        name: reviewInput.name,
        durationMinutes: Math.max(1, reviewInput.durationMinutes),
        measuredDurationSeconds: measuredSecs,
        durationEditedReason: reviewInput.durationEditedReason,
        exercises: confirmedExercises,
        source: 'MANUAL_SELF_REPORTED',
        notes: reviewInput.durationEditedReason
          ? `Self-reported session (Timer: ${measuredSecs || 0}s, Duration note: ${reviewInput.durationEditedReason}).`
          : `Self-reported session (${ confirmedExercises.reduce((a, e) => a + e.sets.length, 0) } confirmed sets).`,
      });
    },

    setPendingHonestyCheck: (questId) => {
      set({ pendingHonestyCheckQuestId: questId });
    },

    confirmHonestyQuestClaim: (questId) => {
      set({ pendingHonestyCheckQuestId: null });
      get().claimQuest(questId);
    },

    openApologyModal: () => {
      set({ isApologyModalOpen: true });
    },

    closeApologyModal: () => {
      set({ isApologyModalOpen: false });
    },

    triggerAntiCheatPenalty: (reason: string) => {
      const state = get();
      sound.playPenaltyWarning();
      const penaltyQuestId = `quest-penalty-${Date.now()}`;
      const todayKey = getDailyDateKey();

      const penaltyQuest: SystemQuest = {
        id: penaltyQuestId,
        dateAssigned: todayKey,
        title: 'Penalty Quest: Accountability Check',
        subTitle: `Notice: ${reason}`,
        category: 'PENALTY_QUEST',
        isDeloadOrRecovery: true,
        requiredForDailyClear: true,
        requirements: [
          {
            description: 'Complete Accountability Reminder (3 Times)',
            targetCount: 3,
            currentCount: 0,
            unit: 'oaths',
          },
        ],
        rewards: {
          xp: 0,
        },
        status: 'IN_PROGRESS',
        deadlineHoursRemaining: 4,
        penaltyWarning: 'Quest claims are paused until accountability check is completed.',
      };

      set({
        quests: [penaltyQuest, ...state.quests.filter((q) => q.category !== 'PENALTY_QUEST')],
        isApologyModalOpen: true,
      });
      persistWithWarning();
    },

    completePenaltyOath: () => {
      const state = get();
      sound.playLevelUp();
      const updatedQuests = state.quests.filter((q) => q.category !== 'PENALTY_QUEST');

      set({
        quests: updatedQuests,
        isApologyModalOpen: false,
        systemModal: {
          isOpen: true,
          type: 'ALERT',
          title: 'Accountability Check Complete',
          subTitle: 'Progression Restored',
          details: 'Standard quest progression is active.',
        },
      });
      persistWithWarning();
    },

    logQuickHydration: (amountMl: number) => {
      get().refreshDailyStateIfNeeded();
      const state = get();
      sound.playClick();
      const todayKey = getDailyDateKey();
      const prevRecord = state.nutrition.dailyNutritionLogs?.[todayKey];
      const currentHydration =
        prevRecord?.hydrationMl ?? state.nutrition.todayHydrationMl ?? 0;
      const newHydration = Math.max(0, Math.min(10000, currentHydration + amountMl));

      const updatedDailyLogs: Record<string, DailyNutritionRecord> = {
        ...(state.nutrition.dailyNutritionLogs || {}),
        [todayKey]: {
          dateKey: todayKey,
          proteinGrams: prevRecord?.proteinGrams ?? state.nutrition.todayProteinGrams,
          hydrationMl: newHydration,
          updatedAt: new Date().toISOString(),
        },
      };

      const updatedNutrition: NutritionRecoveryState = {
        ...state.nutrition,
        todayHydrationMl: newHydration,
        dailyNutritionLogs: updatedDailyLogs,
      };

      const newContext = synthesizeMemberContext(
        state.profile,
        state.readiness,
        updatedNutrition,
        state.training,
        state.rpg,
        state.assignedSessionPlan
      );
      const updatedQuests = reconcileQuestsWithState(state.quests, newContext);

      set({ nutrition: updatedNutrition, quests: updatedQuests });
      persistWithWarning();
    },

    logQuickProtein: (amountGrams: number) => {
      get().refreshDailyStateIfNeeded();
      const state = get();
      sound.playClick();
      const todayKey = getDailyDateKey();
      const prevRecord = state.nutrition.dailyNutritionLogs?.[todayKey];
      const newProtein = Math.max(0, state.nutrition.todayProteinGrams + amountGrams);
      const targetProtein = Math.max(1, state.nutrition.targetProteinGrams || state.profile.targetProteinGrams || 150);
      const proteinAdherencePct = Math.min(100, Math.round((newProtein / targetProtein) * 100));

      const updatedDailyLogs: Record<string, DailyNutritionRecord> = {
        ...(state.nutrition.dailyNutritionLogs || {}),
        [todayKey]: {
          dateKey: todayKey,
          proteinGrams: newProtein,
          hydrationMl: prevRecord?.hydrationMl ?? state.nutrition.todayHydrationMl ?? 0,
          updatedAt: new Date().toISOString(),
        },
      };

      // Also sync protein on today's recovery log if one exists, WITHOUT re-running sleep/strain decay!
      const updatedRecentLogs = (state.nutrition.recentLogs || []).map((log) => {
        const logKey = log.dateKey || getDailyDateKey(new Date(log.date));
        if (logKey === todayKey) {
          return { ...log, proteinGrams: newProtein };
        }
        return log;
      });

      const updatedNutrition: NutritionRecoveryState = {
        ...state.nutrition,
        todayProteinGrams: newProtein,
        proteinAdherencePct,
        recentLogs: updatedRecentLogs,
        dailyNutritionLogs: updatedDailyLogs,
      };

      const newContext = synthesizeMemberContext(
        state.profile,
        state.readiness,
        updatedNutrition,
        state.training,
        state.rpg,
        state.assignedSessionPlan
      );
      const updatedQuests = reconcileQuestsWithState(state.quests, newContext);

      set({
        nutrition: updatedNutrition,
        quests: updatedQuests,
      });
      persistWithWarning();
    },

    logQuickSleep: (hours: number) => {
      const state = get();
      sound.playClick();
      const todayKey = getDailyDateKey();
      const todayLog = (state.nutrition.recentLogs || []).find(
        (l) => (l.dateKey || getDailyDateKey(new Date(l.date))) === todayKey
      );
      get().logRecovery({
        sleepHours: hours,
        subjectiveReadiness: todayLog?.subjectiveReadiness ?? 8,
        hrvMs: todayLog?.hrvMs ?? state.readiness.hrvMs,
        proteinGrams: state.nutrition.todayProteinGrams,
        notes: 'Quick sleep log',
      });
    },

    getSynthesizedState: () => {
      const { profile, readiness, nutrition, training, rpg, assignedSessionPlan } = get();
      return synthesizeMemberContext(
        profile,
        readiness,
        nutrition,
        training,
        rpg,
        assignedSessionPlan
      );
    },

    processActivity: (event) => {
      const state = get();
      if (event.isPostCommitNotification) return;

      // 1. Validate member identity
      if (event.memberId && event.memberId !== state.profile.id) {
        return;
      }

      // 2. Deduplicate by stable eventId / record id
      const dedupeId =
        event.eventId ||
        (event.type === 'WORKOUT_COMPLETED'
          ? `evt-workout-${event.workout?.id}`
          : event.type === 'RECOVERY_LOGGED'
          ? `evt-recovery-${event.record?.id}`
          : undefined);

      if (dedupeId && state.processedEventIds.includes(dedupeId)) {
        return;
      }

      if(!Number.isFinite(Date.parse(event.timestamp)) || Date.parse(event.timestamp)>Date.now()) return;

      if (event.type === 'MEMBER_CHECKED_IN') {
        get().simulateCheckIn();
      } else if (event.type === 'WORKOUT_COMPLETED') {
        // Preserve original workout ID, occurrence timestamp, and source
        get().logWorkout({
          id: event.workout.id,
          memberId: event.memberId,
          gymId: event.gymId,
          date: event.workout.date || event.timestamp,
          version: event.workout.version,
          name: event.workout.name,
          durationMinutes: event.workout.durationMinutes,
          exercises: event.workout.exercises,
          source: event.workout.source,
          notes: event.workout.notes,
        });
        const accepted=get().training.workoutHistory.find(w=>w.id===event.workout.id);
        if(!accepted || (accepted.version||1)<(event.workout.version||1)) return;
        if(dedupeId) {
          set({processedEventIds:[...new Set([...get().processedEventIds,dedupeId])]});
          persistWithWarning();
        }
      } else if (event.type === 'RECOVERY_LOGGED') {
        get().logRecovery({
          sleepHours: event.record.sleepHours,
          subjectiveReadiness: event.record.subjectiveReadiness,
          hrvMs: event.record.hrvMs,
          proteinGrams: event.record.proteinGrams,
          notes: event.record.notes,
        });
      }
    },

    simulateCheckIn: () => {
      get().refreshDailyStateIfNeeded();
      const state = get();
      sound.playClick();
      sound.triggerHaptic(40);

      const todayKey = getDailyDateKey();
      const calendar = { ...(state.rpg.activityCalendar || {}) };
      const grantLedger = { ...(state.rpg.grantLedger || {}) };
      const checkInGrantId = `checkin-${todayKey}`;

      const todayEntry: CalendarDayRecord = calendar[todayKey] || {
        date: todayKey,
        checkedIn: false,
        recoveryXpAwarded: false,
        workoutsCount: 0,
        workoutXpAwardedCount: 0,
        questsClaimedIds: [],
        totalXpEarnedToday: 0,
        streakCountAtDay: state.rpg.streakDays,
      };

      // Calendar Anti-Spam Check: Only 1 Check-In allowed per calendar day (YYYY-MM-DD)
      if (todayEntry.checkedIn || state.rpg.lastCheckInDate === todayKey || grantLedger[checkInGrantId]) {
        sound.playPenaltyWarning();
        set({
          systemModal: {
            isOpen: true,
            type: 'ALERT',
            title: '[CALENDAR LOCK: ALREADY CHECKED IN]',
            subTitle: `Daily Check-In Verified for ${todayKey}`,
            details:
              'You have already completed your daily gym check-in on the calendar today. Daily check-in XP (+50 XP & +2 Habit) is locked until tomorrow (00:00 local time).',
          },
        });
        return;
      }

      const streakResult = processStreakCompletion(
        {
          streak: state.rpg.streakDays,
          lastStreakDate: state.rpg.lastStreakDate || '',
          longestStreak: state.rpg.longestStreak || state.rpg.streakDays,
          streakFreezeActive: state.rpg.streakFreezeActive,
        },
        {
          hasStreakFreeze: state.rpg.streakFreezeActive,
        }
      );

      let milestoneBonusXp = 0;
      let milestoneNotice = '';
      if (streakResult.milestoneUnlocked) {
        const milestoneGrantId = `milestone-${streakResult.milestoneUnlocked.days}d-${todayKey}`;
        if (!grantLedger[milestoneGrantId]) {
          milestoneBonusXp = streakResult.milestoneUnlocked.bonusXp;
          milestoneNotice = ` [MILESTONE: ${streakResult.milestoneUnlocked.title} +${milestoneBonusXp} XP]`;
          grantLedger[milestoneGrantId] = {
            grantId: milestoneGrantId,
            cause: 'STREAK_MILESTONE',
            sourceId: `${streakResult.milestoneUnlocked.days}d`,
            dateKey: todayKey,
            timestamp: new Date().toISOString(),
            personalXp: milestoneBonusXp,
            gymXp: 0,
            workoutCountDelta: 0,
            statPoints: { strength: 0, endurance: 0, discipline: 0, recovery: 0 },
          };
        }
      }

      const earnedXp = 50 + milestoneBonusXp;
      grantLedger[checkInGrantId] = {
        grantId: checkInGrantId,
        cause: 'CHECK_IN',
        gymId: state.profile.gymId,
        sourceId: todayKey,
        dateKey: todayKey,
        timestamp: new Date().toISOString(),
        personalXp: 50,
        gymXp: 75,
        workoutCountDelta: 0,
        statPoints: { strength: 0, endurance: 0, discipline: 2, recovery: 0 },
      };

      calendar[todayKey] = {
        ...todayEntry,
        checkedIn: true,
        checkedInAt: new Date().toISOString(),
        totalXpEarnedToday: todayEntry.totalXpEarnedToday + earnedXp,
        streakCountAtDay: streakResult.streak,
      };

      // Finding 7 Fix: workoutCountDelta is explicitly 0 for check-ins!
      const { updatedState, didLevelUp, oldLevel, newLevel } = applyProgressionUpdate(
        {
          ...state.rpg,
          streakDays: streakResult.streak,
          lastStreakDate: streakResult.lastStreakDate,
          lastCheckInDate: todayKey,
          longestStreak: streakResult.longestStreak,
          streakFreezeActive: streakResult.usedFreeze ? false : state.rpg.streakFreezeActive,
          activityCalendar: calendar,
          grantLedger,
          lastActiveDate: new Date().toISOString(),
        },
        earnedXp,
        { discipline: 2 },
        75,
        { cause: 'CHECK_IN', workoutCountDelta: 0 }
      );

      sound.playQuestComplete();

      set({
        rpg: updatedState,
        systemModal: didLevelUp
          ? {
              isOpen: true,
              type: 'LEVEL_UP',
              title: '[LEVEL UP! SYSTEM AWAKENING]',
              subTitle: `You have advanced from Level ${oldLevel} to Level ${newLevel}!`,
              details: `Rank: ${updatedState.hunterRank}. +3 Free Stat Points Awarded!${milestoneNotice}`,
              statBonus: { discipline: 2 },
            }
          : {
              isOpen: true,
              type: 'ALERT',
              title: '[DAILY CHECK-IN RECORDED]',
              subTitle: `Calendar Day ${todayKey} • ${state.profile.gymName}`,
              details: `Streak: ${streakResult.streak} Days!${milestoneNotice} +50 Personal XP, +2 Habit, +75 Facility XP recorded on your Calendar.${
                streakResult.usedFreeze ? ' (Streak freeze shield was consumed to preserve streak!)' : ''
              }`,
            },
      });

      persistWithWarning();

      // Emit post-commit outbound notification AFTER state commit
      eventBus.emit({
        eventId: `notif-checkin-${todayKey}`,
        isPostCommitNotification: true,
        type: 'MEMBER_CHECKED_IN',
        timestamp: new Date().toISOString(),
        gymId: state.profile.gymId,
        memberId: state.profile.id,
        facilityName: state.profile.gymName,
        source: 'MANUAL_SELF_REPORTED',
      });
    },

    logWorkout: (workoutInput) => {
      const error=validateWorkoutInput(workoutInput);
      if(error) { set({systemModal:{isOpen:true,type:'ALERT',title:'Workout rejected',subTitle:'Check the entered values',details:error}}); return; }
      if(workoutInput.memberId && workoutInput.memberId !== get().profile.id) return;
      const knownGyms = [get().profile.gymId, ...(get().rpg.gymContext.archivedFacilities || []).map(a=>a.gymId)];
      if(workoutInput.gymId && !knownGyms.includes(workoutInput.gymId)) return;
      get().refreshDailyStateIfNeeded();
      const state = get();
      sound.playClick();

      if (workoutInput.memberId && workoutInput.memberId !== state.profile.id) {
        return;
      }

      const existing = state.training.workoutHistory.find(w=>w.id===workoutInput.id);
      if(existing) {
        if((workoutInput.version || 1) > (existing.version || 1) &&
          (!workoutInput.gymId || workoutInput.gymId===existing.gymId)) {
          get().editWorkout(existing.id,{name:workoutInput.name,durationMinutes:workoutInput.durationMinutes,
            exercises:workoutInput.exercises,notes:workoutInput.notes,date:workoutInput.date || existing.date,
            version:workoutInput.version,gymId:existing.gymId,source:workoutInput.source || existing.source});
        }
        return;
      }

      if ((workoutInput.durationMinutes || 0) < 1) {
        set({
          systemModal: {
            isOpen: true,
            type: 'ALERT',
            title: '[INVALID WORKOUT DURATION]',
            subTitle: 'Duration Required',
            details: 'Please enter a valid workout duration (at least 1 minute).',
          },
        });
        return;
      }

      // Clean exercises to only confirmed working/warmup sets with positive reps
      const cleanedExercises: WorkoutExercise[] = (workoutInput.exercises || [])
        .map((ex) => ({
          ...ex,
          sets: (ex.sets || []).filter((s) => s.confirmed !== false && (s.reps || 0) > 0),
        }))
        .filter((ex) => ex.sets.length > 0);

      const workingSetsTotal = cleanedExercises.reduce(
        (acc, ex) => acc + ex.sets.filter((s) => !s.isWarmup).length,
        0
      );

      if (workingSetsTotal === 0) {
        set({
          systemModal: {
            isOpen: true,
            type: 'ALERT',
            title: '[NO WORKING SETS RECORDED]',
            subTitle: 'Confirm Performed Sets',
            details: 'At least one confirmed working set is required to log a completed workout.',
          },
        });
        return;
      }

      const source = workoutInput.source || 'MANUAL_SELF_REPORTED';
      const occurrenceDate = workoutInput.date || new Date().toISOString();
      const sessionId = workoutInput.id || `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // 1. Analyze training telemetry with set-level precision & RPE
      const metrics = analyzeWorkoutProgress(
        cleanedExercises,
        state.training.historicalPRs,
        occurrenceDate
      );

      // 2. Create durable WorkoutSessionRecord
      const newSessionRecord: WorkoutSessionRecord = {
        id: sessionId,
        memberId: state.profile.id,
        gymId: workoutInput.gymId || state.profile.gymId,
        version: workoutInput.version || 1,
        source,
        name: workoutInput.name,
        date: occurrenceDate,
        durationMinutes: workoutInput.durationMinutes,
        measuredDurationSeconds: workoutInput.measuredDurationSeconds,
        durationEditedReason: workoutInput.durationEditedReason,
        exercises: cleanedExercises,
        totalTonnageKg: metrics.totalSessionTonnageKg,
        totalSets: metrics.setsCount,
        fatigueStrainPoints: metrics.fatigueStrainPoints,
        prsEarned: metrics.newPRsDetected.map((p) => ({ ...p, sessionId })),
        status: 'COMPLETED',
        notes: workoutInput.notes,
      };

      // 3. Update durable workout history
      const updatedWorkoutHistory = [newSessionRecord, ...state.training.workoutHistory];

      // 4. Recalculate rolling 7d/28d volume, ACWR, PRs, and trends from full history
      const histMetrics = recalculateHistoricalMetrics(updatedWorkoutHistory);

      // 5. Derive readiness deterministically from dated workout history + dated recovery logs
      const updatedReadiness = deriveReadinessFromHistory(
        updatedWorkoutHistory,
        state.nutrition.recentLogs,
        {
          todayProteinGrams: state.nutrition.todayProteinGrams,
          targetProteinGrams: state.nutrition.targetProteinGrams,
          targetSleepHours: state.nutrition.targetSleepHours,
        },
        histMetrics.acwr
      );

      // 6. Streak update & RPG Progression with Calendar Ledger & Grant Ledger
      const sessionDayKey = getDailyDateKey(new Date(occurrenceDate));
      const calendar = { ...(state.rpg.activityCalendar || {}) };
      const grantLedger = { ...(state.rpg.grantLedger || {}) };

      const dayEntry: CalendarDayRecord = calendar[sessionDayKey] || {
        date: sessionDayKey,
        checkedIn: state.rpg.lastCheckInDate === sessionDayKey,
        recoveryXpAwarded: false,
        workoutsCount: 0,
        workoutXpAwardedCount: 0,
        questsClaimedIds: [],
        totalXpEarnedToday: 0,
        streakCountAtDay: state.rpg.streakDays,
      };

      const streakResult = processStreakCompletion(
        {
          streak: state.rpg.streakDays,
          lastStreakDate: state.rpg.lastStreakDate || '',
          longestStreak: state.rpg.longestStreak || state.rpg.streakDays,
          streakFreezeActive: state.rpg.streakFreezeActive,
        },
        {
          currentDate: new Date(occurrenceDate),
          hasStreakFreeze: state.rpg.streakFreezeActive,
        }
      );

      let milestoneBonusXp = 0;
      if (streakResult.milestoneUnlocked) {
        const milestoneGrantId = `milestone-${streakResult.milestoneUnlocked.days}d-${sessionDayKey}`;
        if (!grantLedger[milestoneGrantId]) {
          milestoneBonusXp = streakResult.milestoneUnlocked.bonusXp;
          grantLedger[milestoneGrantId] = {
            grantId: milestoneGrantId,
            cause: 'STREAK_MILESTONE',
            sourceId: `${streakResult.milestoneUnlocked.days}d`,
            dateKey: sessionDayKey,
            timestamp: occurrenceDate,
            personalXp: milestoneBonusXp,
            gymXp: 0,
            workoutCountDelta: 0,
            statPoints: { strength: 0, endurance: 0, discipline: 0, recovery: 0 },
          };
        }
      }

      const isWithinDailyWorkoutXpCap = dayEntry.workoutXpAwardedCount < 2;
      const xpCalc = calculateWorkoutXp(
        metrics.totalSessionTonnageKg,
        metrics.setsCount,
        metrics.newPRsDetected.length,
        streakResult.streak
      );

      const workoutPersonalXp = isWithinDailyWorkoutXpCap ? xpCalc.totalXpEarned : 0;
      const effectiveStatPoints = isWithinDailyWorkoutXpCap
        ? xpCalc.statPointsEarned
        : { strength: 0, endurance: 0, discipline: 0, recovery: 0 };

      // 7. Dungeon Gate damage & Gate Clear Reward Grant (Finding 7 Fix!)
      const damageToBoss = Math.round(metrics.totalSessionTonnageKg);
      const newBossHp = Math.max(0, state.dungeonGate.bossCurrentHp - damageToBoss);
      const isBossDefeated = newBossHp === 0 && !state.dungeonGate.cleared;
      const gateGrantId = `gate-clear-${state.dungeonGate.id}`;
      let gateClearBonusXp = 0;
      let gateClearNotice = '';

      if (isBossDefeated && (!grantLedger[gateGrantId] || grantLedger[gateGrantId].revokedAt)) {
        gateClearBonusXp = state.dungeonGate.rewards.xp;
        gateClearNotice = ` 🏆 [CHALLENGE CLEARED: ${state.dungeonGate.name} +${gateClearBonusXp} XP & ${state.dungeonGate.rewards.title}]`;
        grantLedger[gateGrantId] = {
          grantId: gateGrantId,
          cause: 'GATE_CLEAR',
          gymId: newSessionRecord.gymId,
          sourceId: state.dungeonGate.id,
          dateKey: sessionDayKey,
          timestamp: occurrenceDate,
          personalXp: gateClearBonusXp,
          gymXp: gateClearBonusXp,
          workoutCountDelta: 0,
          statPoints: { strength: 0, endurance: 0, discipline: 0, recovery: 0 },
        };
      }

      // Record workout grant in grantLedger so edits/deletes can replay or revoke accurately
      const workoutGrantId = `workout-xp-${sessionId}`;
      grantLedger[workoutGrantId] = {
        grantId: workoutGrantId,
        cause: 'WORKOUT',
        gymId: newSessionRecord.gymId,
        gateId: state.dungeonGate.id,
        gateMaxHp: state.dungeonGate.bossMaxHp,
        gateRewardXp: state.dungeonGate.rewards.xp,
        gateTitle: state.dungeonGate.rewards.title,
        rewardStreakDays: streakResult.streak,
        sourceId: sessionId,
        dateKey: sessionDayKey,
        timestamp: occurrenceDate,
        personalXp: workoutPersonalXp,
        gymXp: workoutPersonalXp,
        workoutCountDelta: 1,
        statPoints: effectiveStatPoints,
        bossDamage: damageToBoss,
      };

      const totalXpToApply = workoutPersonalXp + milestoneBonusXp + gateClearBonusXp;
      const totalGymXpToApply = workoutPersonalXp + gateClearBonusXp;

      calendar[sessionDayKey] = {
        ...dayEntry,
        workoutsCount: dayEntry.workoutsCount + 1,
        workoutXpAwardedCount: isWithinDailyWorkoutXpCap
          ? dayEntry.workoutXpAwardedCount + 1
          : dayEntry.workoutXpAwardedCount,
        totalXpEarnedToday: dayEntry.totalXpEarnedToday + totalXpToApply,
        streakCountAtDay: streakResult.streak,
      };

      const unlockedAchievements = [...(state.rpg.personalProgress.achievementsUnlocked || [])];
      if (isBossDefeated && !unlockedAchievements.includes(state.dungeonGate.rewards.title)) {
        unlockedAchievements.push(state.dungeonGate.rewards.title);
      }

      const { updatedState, didLevelUp, newLevel } = applyProgressionUpdate(
        {
          ...state.rpg,
          streakDays: streakResult.streak,
          trainingStreakDays: (state.rpg.trainingStreakDays || 0) + 1,
          lastStreakDate: streakResult.lastStreakDate,
          longestStreak: streakResult.longestStreak,
          streakFreezeActive: streakResult.usedFreeze ? false : state.rpg.streakFreezeActive,
          activityCalendar: calendar,
          grantLedger,
          lastActiveDate: new Date().toISOString(),
          personalProgress: {
            ...state.rpg.personalProgress,
            achievementsUnlocked: unlockedAchievements,
          },
        },
        totalXpToApply,
        effectiveStatPoints,
        totalGymXpToApply,
        { cause: 'WORKOUT', workoutCountDelta: 1 }
      );

      const updatedDungeonGate: DungeonGate = {
        ...state.dungeonGate,
        bossCurrentHp: newBossHp,
        cleared: isBossDefeated || state.dungeonGate.cleared,
        rewardGranted: isBossDefeated || state.dungeonGate.rewardGranted,
      };

      const updatedRecentSummaries = updatedWorkoutHistory.slice(0, 20).map((w) => ({
        id: w.id,
        name: w.name,
        date: w.id === sessionId ? 'Just Now' : new Date(w.date).toLocaleDateString(),
        tonnageKg: w.totalTonnageKg,
        sets: w.totalSets,
        prsEarned: (w.prsEarned || []).length,
        source: w.source,
      }));

      const updatedTraining: TrainingProgressState = {
        ...state.training,
        weeklyTonnageKg: histMetrics.rollingVolume7dKg,
        rollingVolume7dKg: histMetrics.rollingVolume7dKg,
        rollingVolume28dKg: histMetrics.rollingVolume28dKg,
        acwr: histMetrics.acwr,
        plateauDetected: histMetrics.plateauDetected,
        recentPRs: histMetrics.recomputedRecentPRs,
        historicalPRs: histMetrics.recomputedHistoricalPRs,
        workoutHistory: updatedWorkoutHistory,
        muscleGroupVolumes: histMetrics.muscleGroupVolumes7d,
        exerciseTrends: histMetrics.exerciseTrends,
      };

      // 8. Recompute member context keeping today's assignedSessionPlan FROZEN (Finding 5 Fix!)
      const newContext = synthesizeMemberContext(
        state.profile,
        updatedReadiness,
        state.nutrition,
        updatedTraining,
        updatedState,
        state.assignedSessionPlan
      );

      // 9. Reconcile daily quests against frozen assignment
      const reconciledQuests = reconcileQuestsWithState(state.quests, newContext);

      if (didLevelUp) {
        sound.playLevelUp();
      } else {
        sound.playQuestComplete();
      }

      const processedIds = workoutInput.id
        ? [...state.processedEventIds, `evt-workout-${workoutInput.id}`]
        : state.processedEventIds;

      set({
        rpg: updatedState,
        readiness: updatedReadiness,
        training: updatedTraining,
        dungeonGate: updatedDungeonGate,
        quests: reconciledQuests,
        recentWorkoutHistory: updatedRecentSummaries,
        processedEventIds: processedIds,
        lastWorkoutCompletedAt: Date.now(),
        systemModal: didLevelUp
          ? {
              isOpen: true,
              type: 'LEVEL_UP',
              title: 'Level Up!',
              subTitle: `You reached Level ${newLevel}!`,
              details: `Session effort: +${metrics.fatigueStrainPoints} pts. Earned +${totalXpToApply} XP. Weekly challenge progress: +${damageToBoss.toLocaleString()} kg!${gateClearNotice}`,
              statBonus: effectiveStatPoints,
            }
          : isBossDefeated
          ? {
              isOpen: true,
              type: 'GATE_CLEAR',
              title: 'Challenge Complete!',
              subTitle: `${state.dungeonGate.name} Finished`,
              details: `You hit your weekly lifting target! Earned: ${state.dungeonGate.rewards.title} & +${gateClearBonusXp} Challenge XP (+${workoutPersonalXp} Workout XP)!`,
              statBonus: effectiveStatPoints,
            }
          : {
              isOpen: true,
              type: 'ALERT',
              title: 'Workout Saved!',
              subTitle: `Total Lifted: ${metrics.totalSessionTonnageKg.toLocaleString()} kg (${metrics.setsCount} sets)`,
              details: `Workout strain: +${metrics.fatigueStrainPoints} pts. Readiness: ${updatedReadiness.score}/100.${gateClearNotice}`,
              statBonus: effectiveStatPoints,
            },
      });

      const saved = persistWithWarning();
      if (!saved) return;

      // 10. Emit post-commit outbound notification AFTER set() & saveState() (prevents recursion!)
      eventBus.emit({
        eventId: `notif-workout-${sessionId}`,
        isPostCommitNotification: true,
        type: 'WORKOUT_COMPLETED',
        timestamp: newSessionRecord.date,
        gymId: state.profile.gymId,
        memberId: state.profile.id,
        workout: newSessionRecord,
      });
    },

    editWorkout: (sessionId, updatedFields) => {
      const state=get();
      const current=state.training.workoutHistory.find(w=>w.id===sessionId);
      if(!current) return;
      if(updatedFields.gymId && updatedFields.gymId !== current.gymId) return;
      const updated={...current,...updatedFields,version:updatedFields.version ?? (current.version || 1)+1,status:'CORRECTED' as const};
      const error=validateWorkoutInput(updated);
      if(error) { set({systemModal:{isOpen:true,type:'ALERT',title:'Workout correction rejected',subTitle:'Check the entered values',details:error}}); return; }
      reconcileHistory(state.training.workoutHistory.map(w=>w.id===sessionId?updated:w));
    },

    deleteWorkout: (sessionId) => {
      const state=get();
      if(!state.training.workoutHistory.some(w=>w.id===sessionId)) return;
      reconcileHistory(state.training.workoutHistory.filter(w=>w.id!==sessionId));
    },

    logRecovery: (input) => {
      get().refreshDailyStateIfNeeded();
      const state = get();
      sound.playClick();

      // Finding 3 Fix: Pass workoutHistory and dailyNutritionLogs so today's recovery observation
      // is deduplicated by dateKey and strain is computed idempotently from dated records!
      const { metrics, nutrition, newRecord } = buildNutritionRecoverySnapshot(
        {
          sleepHours: input.sleepHours,
          targetSleepHours: state.nutrition.targetSleepHours,
          subjectiveReadiness: input.subjectiveReadiness,
          hrvMs: input.hrvMs,
          todayProteinGrams: input.proteinGrams,
          targetProteinGrams: state.profile.targetProteinGrams,
          recentStrainIndex: state.readiness.fatigueIndex,
          acuteFatigueStrain: state.readiness.acuteFatigueStrain,
          acwrRatio: state.training.acwr?.ratio,
          acwrStatus: state.training.acwr?.status,
          acwrIsCalibrated: state.training.acwr?.isCalibrated,
        },
        state.nutrition.recentLogs,
        state.training.workoutHistory,
        state.nutrition.dailyNutritionLogs
      );

      // Calendar Anti-Spam Lock: Award recovery check-in XP (+75 XP, +2 REC, +1 DIS) strictly ONCE per calendar day
      const todayKey = getDailyDateKey();
      const calendar = { ...(state.rpg.activityCalendar || {}) };
      const grantLedger = { ...(state.rpg.grantLedger || {}) };
      const recoveryGrantId = `recovery-xp-${todayKey}`;

      const todayEntry: CalendarDayRecord = calendar[todayKey] || {
        date: todayKey,
        checkedIn: state.rpg.lastCheckInDate === todayKey,
        recoveryXpAwarded: false,
        workoutsCount: 0,
        workoutXpAwardedCount: 0,
        questsClaimedIds: [],
        totalXpEarnedToday: 0,
        streakCountAtDay: state.rpg.streakDays,
      };

      const shouldAwardRecoveryXp = !todayEntry.recoveryXpAwarded && !grantLedger[recoveryGrantId];
      const recoveryXp = shouldAwardRecoveryXp ? 75 : 0;
      const recoveryStats = shouldAwardRecoveryXp ? { recovery: 2, discipline: 1 } : undefined;

      if (shouldAwardRecoveryXp) {
        grantLedger[recoveryGrantId] = {
          grantId: recoveryGrantId,
          cause: 'RECOVERY_LOG',
          sourceId: newRecord.id,
          dateKey: todayKey,
          timestamp: newRecord.date,
          personalXp: 75,
          gymXp: 0,
          workoutCountDelta: 0,
          statPoints: { strength: 0, endurance: 0, discipline: 1, recovery: 2 },
        };
      }

      calendar[todayKey] = {
        ...todayEntry,
        recoveryXpAwarded: true,
        totalXpEarnedToday: todayEntry.totalXpEarnedToday + recoveryXp,
      };

      // Finding 7 Fix: workoutCountDelta is 0 and gymXpBonus is 0 for personal recovery check-ins!
      const { updatedState } = applyProgressionUpdate(
        {
          ...state.rpg,
          activityCalendar: calendar,
          grantLedger,
        },
        recoveryXp,
        recoveryStats,
        0,
        { cause: 'RECOVERY_LOG', workoutCountDelta: 0 }
      );

      const newContext = synthesizeMemberContext(
        state.profile,
        metrics,
        nutrition,
        state.training,
        updatedState,
        state.assignedSessionPlan
      );
      const reconciledQuests = reconcileQuestsWithState(state.quests, newContext);

      if (metrics.deloadRecommended) {
        sound.playPenaltyWarning();
      } else {
        sound.playQuestComplete();
      }

      set({
        readiness: metrics,
        nutrition,
        rpg: updatedState,
        quests: reconciledQuests,
        systemModal: {
          isOpen: true,
          type: metrics.deloadRecommended ? 'PENALTY' : 'ALERT',
          title: metrics.deloadRecommended
            ? 'Recovery Mode Recommended'
            : shouldAwardRecoveryXp
            ? 'Check-In Saved! (+75 XP)'
            : 'Recovery Metrics Updated',
          subTitle: `Readiness Score: ${metrics.score}/100`,
          details: metrics.deloadRecommended
            ? 'High fatigue & low recovery detected. Your next workout recommendation has been adjusted to Light Recovery & Mobility.'
            : shouldAwardRecoveryXp
            ? `Daily recovery reward recorded on Calendar (${todayKey}). Fatigue adjusted to ${metrics.fatigueIndex}/100.`
            : `Readiness and nutrition updated for ${todayKey}. (Daily recovery check-in XP was already claimed today).`,
          statBonus: recoveryStats,
        },
      });

      persistWithWarning();

      eventBus.emit({
        eventId: `notif-recovery-${newRecord.id}`,
        isPostCommitNotification: true,
        type: 'RECOVERY_LOGGED',
        timestamp: newRecord.date,
        memberId: state.profile.id,
        record: newRecord,
      });
    },

    claimQuest: (questId) => {
      get().refreshDailyStateIfNeeded();
      const state = get();
      const todayKey = getDailyDateKey();

      // Reconcile quests with live state BEFORE checking eligibility (Finding 6 Fix!)
      const liveContext = synthesizeMemberContext(
        state.profile,
        state.readiness,
        state.nutrition,
        state.training,
        state.rpg,
        state.assignedSessionPlan
      );
      const liveQuests = reconcileQuestsWithState(state.quests, liveContext);
      const targetQuest = liveQuests.find((q) => q.id === questId);

      if (!targetQuest) {
        set({
          quests: liveQuests,
          systemModal: {
            isOpen: true,
            type: 'ALERT',
            title: '[QUEST EXPIRED OR NOT FOUND]',
            subTitle: 'Daily Rollover Check',
            details: 'This quest is no longer active for today’s calendar date.',
          },
        });
        return;
      }

      // Reject expired or wrong-day quest claims
      if (targetQuest.dateAssigned !== todayKey) {
        set({
          quests: liveQuests,
          systemModal: {
            isOpen: true,
            type: 'ALERT',
            title: '[QUEST EXPIRED]',
            subTitle: targetQuest.title,
            details: `Quest was assigned for ${targetQuest.dateAssigned} and cannot be claimed on ${todayKey}.`,
          },
        });
        return;
      }

      // Check active penalty quest
      const hasActivePenalty = liveQuests.some(
        (q) => q.category === 'PENALTY_QUEST' && q.status !== 'CLAIMED'
      );
      if (hasActivePenalty && targetQuest.category !== 'PENALTY_QUEST') {
        set({
          quests: liveQuests,
          isApologyModalOpen: true,
          systemModal: {
            isOpen: true,
            type: 'PENALTY',
            title: '[ACCOUNTABILITY CHECK REQUIRED]',
            subTitle: 'Active Accountability Notice',
            details: 'Complete the accountability prompt before claiming quest rewards.',
          },
        });
        return;
      }

      const calendar = { ...(state.rpg.activityCalendar || {}) };
      const grantLedger = { ...(state.rpg.grantLedger || {}) };
      const questGrantId = `quest-claim-${targetQuest.id}`;

      const todayEntry: CalendarDayRecord = calendar[todayKey] || {
        date: todayKey,
        checkedIn: state.rpg.lastCheckInDate === todayKey,
        recoveryXpAwarded: false,
        workoutsCount: 0,
        workoutXpAwardedCount: 0,
        questsClaimedIds: [],
        totalXpEarnedToday: 0,
        streakCountAtDay: state.rpg.streakDays,
      };

      // Idempotent duplicate claim prevention (Finding 6 & Finding 14 Fix!)
      if (
        targetQuest.status === 'CLAIMED' ||
        todayEntry.questsClaimedIds.includes(targetQuest.id) ||
        Boolean(grantLedger[questGrantId])
      ) {
        set({
          quests: liveQuests,
          systemModal: {
            isOpen: true,
            type: 'ALERT',
            title: '[CALENDAR LOCK: REWARD ALREADY CLAIMED]',
            subTitle: targetQuest.title,
            details: `This quest's rewards were already verified and deposited on your Calendar for ${todayKey}.`,
          },
        });
        return;
      }

      // Strict claim-time requirement verification against current live evidence!
      const allRequirementsMetNow =
        targetQuest.requirements.length > 0 &&
        targetQuest.requirements.every((r) => r.currentCount >= r.targetCount);

      if (!allRequirementsMetNow || targetQuest.status !== 'OBJECTIVES_MET') {
        const incompleteReqs = targetQuest.requirements
          .filter((r) => r.currentCount < r.targetCount)
          .map((r) => `• ${r.description}: ${r.currentCount}/${r.targetCount} ${r.unit}`)
          .join('\n');

        set({
          quests: liveQuests,
          systemModal: {
            isOpen: true,
            type: 'ALERT',
            title: '[QUEST OBJECTIVES INCOMPLETE]',
            subTitle: targetQuest.title,
            details: `Requirements remaining before rewards unlock:\n${incompleteReqs}`,
          },
        });
        return;
      }

      sound.playQuestComplete();
      sound.triggerHaptic(60);

      const claimedAt = new Date().toISOString();
      const updatedQuests = liveQuests.map((q) =>
        q.id === questId ? { ...q, status: 'CLAIMED' as const, claimedAt } : q
      );

      const claimRecord = {
        grantId: questGrantId,
        questId: targetQuest.id,
        questTitle: targetQuest.title,
        dateKey: todayKey,
        claimedAt,
        xpEarned: targetQuest.rewards.xp,
        statPointsEarned: targetQuest.rewards.statPoints,
        itemReward: targetQuest.rewards.itemReward,
      };

      const streakResult = processStreakCompletion(
        {
          streak: state.rpg.streakDays,
          lastStreakDate: state.rpg.lastStreakDate || '',
          longestStreak: state.rpg.longestStreak || state.rpg.streakDays,
          streakFreezeActive: state.rpg.streakFreezeActive,
        },
        {
          hasStreakFreeze: state.rpg.streakFreezeActive,
        }
      );

      let milestoneBonusXp = 0;
      let milestoneText = '';
      if (streakResult.milestoneUnlocked) {
        const milestoneGrantId = `milestone-${streakResult.milestoneUnlocked.days}d-${todayKey}`;
        if (!grantLedger[milestoneGrantId]) {
          milestoneBonusXp = streakResult.milestoneUnlocked.bonusXp;
          milestoneText = `\n🔥 [STREAK MILESTONE]: ${streakResult.milestoneUnlocked.title} (${streakResult.streak} Days)! +${milestoneBonusXp} Bonus XP!`;
          grantLedger[milestoneGrantId] = {
            grantId: milestoneGrantId,
            cause: 'STREAK_MILESTONE',
            sourceId: `${streakResult.milestoneUnlocked.days}d`,
            dateKey: todayKey,
            timestamp: claimedAt,
            personalXp: milestoneBonusXp,
            gymXp: 0,
            workoutCountDelta: 0,
            statPoints: { strength: 0, endurance: 0, discipline: 0, recovery: 0 },
          };
        }
      }

      const totalClaimXp = targetQuest.rewards.xp + milestoneBonusXp;
      const gymQuestXp = targetQuest.category === 'MAIN_QUEST' ? targetQuest.rewards.xp : 0;

      grantLedger[questGrantId] = {
        grantId: questGrantId,
        cause: 'QUEST_CLAIM',
        sourceId: targetQuest.id,
        dateKey: todayKey,
        timestamp: claimedAt,
        personalXp: targetQuest.rewards.xp,
        gymXp: gymQuestXp,
        workoutCountDelta: 0,
        statPoints: {
          strength: targetQuest.rewards.statPoints?.strength || 0,
          endurance: targetQuest.rewards.statPoints?.endurance || 0,
          discipline: targetQuest.rewards.statPoints?.discipline || 0,
          recovery: targetQuest.rewards.statPoints?.recovery || 0,
        },
      };

      calendar[todayKey] = {
        ...todayEntry,
        questsClaimedIds: [...todayEntry.questsClaimedIds, targetQuest.id],
        totalXpEarnedToday: todayEntry.totalXpEarnedToday + totalClaimXp,
        streakCountAtDay: streakResult.streak,
      };

      // Finding 7 Fix: workoutCountDelta is 0 for quest claims, and side quests give 0 gym XP!
      const { updatedState } = applyProgressionUpdate(
        {
          ...state.rpg,
          streakDays: streakResult.streak,
          lastStreakDate: streakResult.lastStreakDate,
          longestStreak: streakResult.longestStreak,
          streakFreezeActive: streakResult.usedFreeze ? false : state.rpg.streakFreezeActive,
          activityCalendar: calendar,
          grantLedger,
        },
        totalClaimXp,
        targetQuest.rewards.statPoints,
        gymQuestXp,
        { cause: 'QUEST_CLAIM', workoutCountDelta: 0 }
      );

      updatedState.personalProgress.claimedRewardsHistory = [
        claimRecord,
        ...(state.rpg.personalProgress.claimedRewardsHistory || []),
      ];

      set({
        quests: updatedQuests,
        rpg: updatedState,
        lastQuestCompletedAt: Date.now(),
        systemModal: {
          isOpen: true,
          type: 'QUEST_CLEAR',
          title: '[QUEST COMPLETE: REWARD CLAIMED]',
          subTitle: targetQuest.title,
          details: `Earned +${targetQuest.rewards.xp} XP! ${
            targetQuest.rewards.itemReward ? `Acquired: [${targetQuest.rewards.itemReward}]` : ''
          }${milestoneText}`,
          statBonus: targetQuest.rewards.statPoints,
        },
      });

      persistWithWarning();
    },

    allocateStat: (statKey) => {
      const state = get();
      if (state.rpg.unallocatedStatPoints <= 0) return;

      sound.playClick();
      sound.triggerHaptic(30);

      const updatedRpg: RPGCharacterState = {
        ...state.rpg,
        unallocatedStatPoints: state.rpg.unallocatedStatPoints - 1,
        statAllocations: [...getStatAllocations(state.rpg), statKey],
        stats: {
          ...state.rpg.stats,
          [statKey]: state.rpg.stats[statKey] + 1,
        },
      };

      set({ rpg: updatedRpg });
      persistWithWarning();
    },

    updateProfile: (updated) => {
      const state = get();
      const merged: HunterProfile = { ...state.profile, ...updated };

      const bmrCalc = calculateEnergyExpenditure(
        merged.currentWeightKg,
        merged.heightCm,
        merged.ageYears || 24,
        merged.gender || 'MALE',
        merged.activityMultiplier || 1.55,
        merged.fitnessGoal
      );

      merged.targetProteinGrams = bmrCalc.proteinGramsTarget;

      // Finding 13 Fix: Synchronize nutrition.targetProteinGrams with profile.targetProteinGrams!
      const updatedNutrition: NutritionRecoveryState = {
        ...state.nutrition,
        targetProteinGrams: bmrCalc.proteinGramsTarget,
        proteinAdherencePct: Math.min(
          100,
          Math.round((state.nutrition.todayProteinGrams / Math.max(1, bmrCalc.proteinGramsTarget)) * 100)
        ),
      };

      if (updated.currentWeightKg && updated.currentWeightKg !== state.profile.currentWeightKg) {
        merged.measurementHistory = [
          {
            id: `m-${Date.now()}`,
            date: new Date().toISOString(),
            weightKg: updated.currentWeightKg,
            bodyFatPct: merged.bodyFatPct,
            muscleMassKg: merged.muscleMassKg,
            notes: 'Profile weight update',
          },
          ...(merged.measurementHistory || []),
        ];
      }

      // If goal, equipment, duration, or limitations changed and today's Main Quest is not yet claimed, update assigned plan
      const mainQuestClaimed = state.quests.some(
        (q) => q.category === 'MAIN_QUEST' && q.status === 'CLAIMED'
      );
      const hasTrainingDoneToday = state.training.workoutHistory.some(
        (w) => getDailyDateKey(new Date(w.date)) === getDailyDateKey()
      );
      const shouldUpdatePrescription = !mainQuestClaimed && !hasTrainingDoneToday;

      const tempContext = synthesizeMemberContext(
        merged,
        state.readiness,
        updatedNutrition,
        state.training,
        state.rpg
      );
      const newAssignedPlan = shouldUpdatePrescription
        ? tempContext.nextSessionPlan
        : state.assignedSessionPlan || tempContext.nextSessionPlan;

      const newContext = synthesizeMemberContext(
        merged,
        state.readiness,
        updatedNutrition,
        state.training,
        state.rpg,
        newAssignedPlan
      );
      const newQuests = reconcileQuestsWithState(state.quests, newContext, {
        forceRegenerateMainPrescription: shouldUpdatePrescription,
      });

      sound.playClick();
      set({
        profile: merged,
        nutrition: updatedNutrition,
        assignedSessionPlan: newAssignedPlan,
        quests: newQuests,
      });
      persistWithWarning();
    },

    completeOnboarding: (onboardingData) => {
      const state = get();
      sound.playLevelUp();

      const merged: HunterProfile = {
        ...state.profile,
        ...onboardingData,
        onboardingCompleted: true,
      };

      const bmrCalc = calculateEnergyExpenditure(
        merged.currentWeightKg,
        merged.heightCm,
        merged.ageYears || 24,
        merged.gender || 'MALE',
        merged.activityMultiplier || 1.55,
        merged.fitnessGoal
      );

      merged.targetProteinGrams = bmrCalc.proteinGramsTarget;

      // Finding 13 Fix: Keep profile.targetProteinGrams, nutrition.targetProteinGrams, and Protein Quest identical!
      const updatedNutrition: NutritionRecoveryState = {
        ...state.nutrition,
        targetProteinGrams: bmrCalc.proteinGramsTarget,
        proteinAdherencePct: Math.min(
          100,
          Math.round((state.nutrition.todayProteinGrams / Math.max(1, bmrCalc.proteinGramsTarget)) * 100)
        ),
      };

      const tempContext = synthesizeMemberContext(
        merged,
        state.readiness,
        updatedNutrition,
        state.training,
        state.rpg
      );
      const newAssignedPlan = tempContext.nextSessionPlan;
      const newContext = synthesizeMemberContext(
        merged,
        state.readiness,
        updatedNutrition,
        state.training,
        state.rpg,
        newAssignedPlan
      );
      const newQuests = generateSystemQuests(newContext, state.quests, {
        forceRegenerateMainPrescription: true,
      });

      set({
        profile: merged,
        nutrition: updatedNutrition,
        assignedSessionPlan: newAssignedPlan,
        quests: newQuests,
        systemModal: {
          isOpen: true,
          type: 'ALERT',
          title: 'Profile Ready!',
          subTitle: `Goal: ${merged.fitnessGoal.replace('_', ' ')} (${merged.experienceLevel})`,
          details: `Daily protein target set to ${merged.targetProteinGrams}g. Your personalized workout plan and daily goals are ready!`,
        },
      });

      persistWithWarning();
    },

    switchAvatar: (avatarId) => {
      const state = get();
      let avatarUrl = '/assets/avatar-monarch.jpg';
      let hunterTitle = 'Power Style';
      if (avatarId === 'assassin') {
        avatarUrl = '/assets/avatar-assassin.jpg';
        hunterTitle = 'Agile Style';
      } else if (avatarId === 'knight') {
        avatarUrl = '/assets/avatar-knight.jpg';
        hunterTitle = 'Balanced Style';
      }

      sound.playClick();
      const updatedProfile: HunterProfile = {
        ...state.profile,
        avatarId,
        avatarUrl,
        hunterTitle,
      };

      set({ profile: updatedProfile });
      persistWithWarning();
    },

    switchGymFacility: (newGymId, newGymName, squadName = 'Local Squad') => {
      const state = get();
      sound.playClick();

      if(newGymId === state.rpg.gymContext.localGymId) return;
      const archiveEntry = {
        gymId: state.rpg.gymContext.localGymId,
        gymName: state.rpg.gymContext.localGymName,
        localGymXp: state.rpg.gymContext.localGymXp,
        archivedAt: new Date().toISOString(),
      };

      const previousArchives = state.rpg.gymContext.archivedFacilities || [];
      const existingArchiveForTarget = previousArchives.find((a) => a.gymId === newGymId);
      const restoredGymXp = existingArchiveForTarget ? existingArchiveForTarget.localGymXp : 0;

      const updatedProfile: HunterProfile = {
        ...state.profile,
        gymId: newGymId,
        gymName: newGymName,
        squadName,
      };

      // Dual Context Boundary (EVOL.md Section 3): Personal progress (level, totalXp, PRs, stats) is 100% preserved;
      // local facility XP & rank archive/reset cleanly upon switching facilities.
      const updatedRpg: RPGCharacterState = {
        ...state.rpg,
        gymContext: {
          localGymId: newGymId,
          localGymName: newGymName,
          localGymXp: restoredGymXp,
          facilityRank: null,
          squadName,
          squadRank: null,
          isDemoScenario: false,
          archivedFacilities: [
            archiveEntry,
            ...previousArchives.filter((a) => a.gymId !== state.rpg.gymContext.localGymId),
          ],
        },
      };

      set({
        profile: updatedProfile,
        rpg: updatedRpg,
        systemModal: {
          isOpen: true,
          type: 'ALERT',
          title: 'Facility Context Switched',
          subTitle: `Now training at ${newGymName}`,
          details: `Your personal Level (${updatedRpg.level}), Total XP (${updatedRpg.xp.toLocaleString()}), and PR history followed you. Previous facility XP (${archiveEntry.localGymXp} XP at ${archiveEntry.gymName}) was archived.`,
        },
      });
      persistWithWarning();
    },

    sendCoachPrompt: (prompt, persona = 'SYSTEM_ADMIN') => {
      const state = get();
      sound.playClick();

      const userMsg: SystemCoachMessage = {
        id: `user-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: 'HUNTER',
        persona,
        content: prompt,
      };

      const context = synthesizeMemberContext(
        state.profile,
        state.readiness,
        state.nutrition,
        state.training,
        state.rpg,
        state.assignedSessionPlan
      );
      const botMsg = generateSystemCoachResponse(context, persona, prompt);

      set({
        coachMessages: [...state.coachMessages, userMsg, botMsg],
      });
      sound.playSystemAlert();
    },

    closeSystemModal: () => {
      set({ systemModal: null });
    },

    dismissStorageWarning: () => {
      set({ storageWarning: null });
    },

    exportStateJson: () => {
      const state = get();
      return JSON.stringify(
        {
          version: 3,
          exportedAt: new Date().toISOString(),
          profile: state.profile,
          rpg: state.rpg,
          readiness: state.readiness,
          nutrition: state.nutrition,
          training: state.training,
          assignedSessionPlan: state.assignedSessionPlan,
          quests: state.quests,
          dungeonGate: state.dungeonGate,
        },
        null,
        2
      );
    },

    importStateJson: (rawJson: string) => {
      try {
        const parsed = JSON.parse(rawJson);
        if (!isValidPersistedShape(parsed)) {
          set({
            storageWarning: 'Import rejected: JSON does not match a valid EVOL member state schema.',
          });
          return false;
        }
        const mergedProfile: HunterProfile = { ...CLEAN_NEW_PROFILE, ...(parsed.profile || {}) };
        const workouts = Array.isArray(parsed.training?.workoutHistory)
          ? parsed.training.workoutHistory
          : [];
        const hist = recalculateHistoricalMetrics(workouts);
        const mergedTraining: TrainingProgressState = {
          ...CLEAN_NEW_TRAINING,
          ...(parsed.training || {}),
          workoutHistory: workouts,
          weeklyTonnageKg: hist.rollingVolume7dKg,
          rollingVolume7dKg: hist.rollingVolume7dKg,
          rollingVolume28dKg: hist.rollingVolume28dKg,
          acwr: hist.acwr,
          historicalPRs: hist.recomputedHistoricalPRs,
          recentPRs: hist.recomputedRecentPRs,
          muscleGroupVolumes: hist.muscleGroupVolumes7d,
          exerciseTrends: hist.exerciseTrends,
        };
        const mergedNutrition: NutritionRecoveryState = {
          ...CLEAN_NEW_NUTRITION,
          ...(parsed.nutrition || {}),
          targetProteinGrams: mergedProfile.targetProteinGrams,
        };
        const mergedReadiness = deriveReadinessFromHistory(
          workouts,
          mergedNutrition.recentLogs,
          {
            todayProteinGrams: mergedNutrition.todayProteinGrams,
            targetProteinGrams: mergedNutrition.targetProteinGrams,
            targetSleepHours: mergedNutrition.targetSleepHours,
          },
          hist.acwr
        );
        const mergedRpg: RPGCharacterState = { ...CLEAN_NEW_RPG, ...(parsed.rpg || {}),
          stats:{...CLEAN_NEW_RPG.stats,...(parsed.rpg?.stats || {})},
          personalProgress:{...CLEAN_NEW_RPG.personalProgress,...(parsed.rpg?.personalProgress || {})},
          gymContext:{...CLEAN_NEW_RPG.gymContext,...(parsed.rpg?.gymContext || {})} };
        const ctx = synthesizeMemberContext(
          mergedProfile,
          mergedReadiness,
          mergedNutrition,
          mergedTraining,
          mergedRpg
        );
        const newQuests = generateSystemQuests(ctx, parsed.quests || [], {
          forceRegenerateMainPrescription: true,
        });

        set({
          profile: mergedProfile,
          training: mergedTraining,
          nutrition: mergedNutrition,
          readiness: mergedReadiness,
          rpg: mergedRpg,
          assignedSessionPlan: ctx.nextSessionPlan,
          quests: newQuests,
          dungeonGate: parsed.dungeonGate || CLEAN_NEW_DUNGEON_GATE,
          storageWarning: null,
        });
        persistWithWarning();
        return true;
      } catch (e) {
        set({
          storageWarning: 'Import failed: malformed JSON string.',
        });
        return false;
      }
    },

    triggerEmergencyDeloadTest: () => {
      const state = get();
      sound.playPenaltyWarning();
      const forcedReadiness: ReadinessMetrics = {
        ...state.readiness,
        score: 38,
        status: 'CRITICAL_RECOVERY',
        isCalibrated: true,
        fatigueIndex: 88,
        acuteFatigueStrain: 88,
        deloadRecommended: true,
        recoveryDeficit: true,
        acwrRatio: 1.55,
        acwrStatus: 'OVERTRAINING_RISK',
        acwrIsCalibrated: true,
        readinessExplanation:
          'Simulated high fatigue test (Readiness 38/100, Calibrated ACWR 1.55).',
      };

      const tempContext = synthesizeMemberContext(
        state.profile,
        forcedReadiness,
        state.nutrition,
        state.training,
        state.rpg
      );
      const deloadPlan = tempContext.nextSessionPlan;
      const newContext = synthesizeMemberContext(
        state.profile,
        forcedReadiness,
        state.nutrition,
        state.training,
        state.rpg,
        deloadPlan
      );
      const newQuests = reconcileQuestsWithState(state.quests, newContext, {
        forceRegenerateMainPrescription: true,
      });

      set({
        readiness: forcedReadiness,
        assignedSessionPlan: deloadPlan,
        quests: newQuests,
        systemModal: {
          isOpen: true,
          type: 'PENALTY',
          title: 'Recovery Mode Active (Simulation)',
          subTitle: 'High Fatigue Detected (Readiness: 38/100)',
          details: 'Heavy lifts paused for today. Your daily goal has switched to Light Recovery & Mobility.',
        },
      });
    },

    resetGateBoss: () => {
      sound.playClick();
      set({
        dungeonGate: {
          ...CLEAN_NEW_DUNGEON_GATE,
          id: `gate-${Date.now()}`,
          bossCurrentHp: CLEAN_NEW_DUNGEON_GATE.bossMaxHp,
          cleared: false,
          rewardGranted: false,
        },
      });
      persistWithWarning();
    },

    activateStreakFreeze: () => {
      const state = get();
      sound.playClick();
      set({
        rpg: {
          ...state.rpg,
          streakFreezeActive: true,
        },
        systemModal: {
          isOpen: true,
          type: 'ALERT',
          title: 'Streak Protection Active',
          subTitle: '1-Day Streak Shield',
          details:
            'Your streak is now protected for 1 missed day. If you miss tomorrow, your streak will stay intact!',
        },
      });
      persistWithWarning();
    },

    resetToNewUser: () => {
      sound.playClick();
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem('evol_progression_store_v2');
        localStorage.removeItem('evol_workout_draft');
        localStorage.removeItem(`evol_workout_draft_${get().profile.id}`);
      }

      const cleanContext = synthesizeMemberContext(
        CLEAN_NEW_PROFILE,
        CLEAN_NEW_READINESS,
        CLEAN_NEW_NUTRITION,
        CLEAN_NEW_TRAINING,
        CLEAN_NEW_RPG
      );
      const cleanQuests = generateSystemQuests(cleanContext, [], {
        forceRegenerateMainPrescription: true,
      });
      const cleanCoach = generateSystemCoachResponse(cleanContext, 'SYSTEM_ADMIN');

      set({
        currentDayKey: getDailyDateKey(),
        profile: CLEAN_NEW_PROFILE,
        training: CLEAN_NEW_TRAINING,
        rpg: CLEAN_NEW_RPG,
        readiness: CLEAN_NEW_READINESS,
        nutrition: CLEAN_NEW_NUTRITION,
        assignedSessionPlan: cleanContext.nextSessionPlan,
        dungeonGate: CLEAN_NEW_DUNGEON_GATE,
        quests: cleanQuests,
        coachMessages: [cleanCoach],
        recentWorkoutHistory: [],
        activeWorkoutTimer: null,
        pendingTimerReview: null,
        processedEventIds: [],
        storageWarning: null,
        systemModal: {
          isOpen: true,
          type: 'ALERT',
          title: '[SYSTEM RESET COMPLETE]',
          subTitle: 'Player data reset to Level 1 E-Rank.',
          details: 'Complete onboarding to calibrate your profile from Day 0.',
        },
      });

      persistWithWarning();
    },

    loadDemoSimulation: () => {
      sound.playLevelUp();
      const demoContext = synthesizeMemberContext(
        DEMO_SEED_PROFILE,
        DEMO_SEED_READINESS,
        DEMO_SEED_NUTRITION,
        DEMO_SEED_TRAINING,
        DEMO_SEED_RPG
      );
      const demoQuests = generateSystemQuests(demoContext, [], {
        forceRegenerateMainPrescription: true,
      });
      const demoCoach = generateSystemCoachResponse(demoContext, 'SYSTEM_ADMIN');

      const demoHistory = DEMO_SEED_TRAINING.workoutHistory.map((w) => ({
        id: w.id,
        name: w.name,
        date: new Date(w.date).toLocaleDateString(),
        tonnageKg: w.totalTonnageKg,
        sets: w.totalSets,
        prsEarned: w.prsEarned.length,
        source: w.source,
      }));

      set({
        currentDayKey: getDailyDateKey(),
        profile: DEMO_SEED_PROFILE,
        training: DEMO_SEED_TRAINING,
        rpg: DEMO_SEED_RPG,
        readiness: DEMO_SEED_READINESS,
        nutrition: DEMO_SEED_NUTRITION,
        assignedSessionPlan: demoContext.nextSessionPlan,
        dungeonGate: DEMO_SEED_DUNGEON_GATE,
        quests: demoQuests,
        coachMessages: [demoCoach],
        recentWorkoutHistory: demoHistory,
        systemModal: {
          isOpen: true,
          type: 'ALERT',
          title: '[DEMO SCENARIO LOADED]',
          subTitle: 'Level 18 Sung Jin-Woo Simulation',
          details: 'Sample workout history, PRs, and raid challenge loaded for demonstration.',
        },
      });

      persistWithWarning();
    },
  };
});
