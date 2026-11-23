// EVOL Member State Schema (EVOL.md Section 5)

import { WorkoutSessionRecord, ExercisePRRecord, RecoveryLogRecord, DailyNutritionRecord } from './events';
import { NextSessionPlan, QuestClaimRecord, RewardGrantRecord } from './rpg';

export type FitnessGoal = 'FAT_LOSS' | 'MUSCLE_GAIN' | 'STRENGTH' | 'ENDURANCE';
export type ExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type ReadinessStatus = 'OPTIMAL' | 'MODERATE' | 'FATIGUED' | 'CRITICAL_RECOVERY';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type AvailableEquipment =
  | 'FULL_GYM'
  | 'BARBELL_DUMBBELL'
  | 'HOME_GYM'
  | 'DUMBBELL_ONLY'
  | 'BODYWEIGHT_CABLES';

export type ACWRStatus = 'OPTIMAL' | 'OVERTRAINING_RISK' | 'UNDERTRAINING' | 'CALIBRATING';

export type ImmediatePriority =
  | 'DELOAD_REQUIRED'
  | 'PROTEIN_FOCUS'
  | 'HYPERSTROPHY'
  | 'STRENGTH_PEAK'
  | 'METABOLIC_CONDITIONING'
  | 'WORK_CAPACITY'
  | 'CONSISTENCY_STREAK'
  | 'MOBILITY_RESTORE'
  | 'INPUT_STALE';

export type HunterRank =
  | 'E-RANK'
  | 'D-RANK'
  | 'C-RANK'
  | 'B-RANK'
  | 'A-RANK'
  | 'S-RANK'
  | 'NATIONAL_HUNTER'
  | 'SHADOW_MONARCH';

export interface MeasurementEntry {
  id: string;
  date: string; // ISO 8601
  weightKg: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  notes?: string;
}

export interface HunterProfile {
  id: string;
  name: string;
  hunterTitle: string;
  avatarId: 'monarch' | 'assassin' | 'knight';
  avatarUrl: string;
  gender: Gender;
  ageYears: number;
  fitnessGoal: FitnessGoal;
  experienceLevel: ExperienceLevel;
  availableEquipment: AvailableEquipment;
  preferredSessionDurationMinutes: number;
  preferredTrainingDays: number[]; // 0=Sun .. 6=Sat
  activeLimitations: string[];
  targetWeightKg: number;
  currentWeightKg: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  heightCm: number;
  activityMultiplier: number;
  targetProteinGrams: number;
  daysAvailablePerWeek: number;
  measurementHistory: MeasurementEntry[];
  onboardingCompleted: boolean;
  gymId: string;
  gymName: string;
  squadName: string;
}

export interface ReadinessMetrics {
  score: number; // 0 - 100
  status: ReadinessStatus;
  isCalibrated?: boolean; // True when backed by recent user-logged recovery data
  fatigueIndex: number; // Acute strain indicator
  acuteFatigueStrain: number; // Residual strain derived from dated workouts & dated recovery logs
  sleepHoursLastNight: number;
  hrvMs?: number;
  recoveryDeficit: boolean;
  deloadRecommended: boolean;
  acwrRatio: number;
  acwrStatus: ACWRStatus;
  acwrIsCalibrated?: boolean;
  readinessExplanation: string;
  lastAssessmentTimestamp: string;
}

export interface NutritionRecoveryState {
  proteinAdherencePct: number;
  todayProteinGrams: number;
  targetProteinGrams: number;
  todayHydrationMl?: number;
  sleepHoursLastNight: number;
  targetSleepHours: number;
  recoveryScore: number;
  recoveryDeficit: boolean;
  recentLogs: RecoveryLogRecord[];
  dailyNutritionLogs?: Record<string, DailyNutritionRecord>;
}

export interface TrainingProgressState {
  volumeTrend: 'UP' | 'STABLE' | 'DOWN';
  weeklyTonnageKg: number;
  rollingVolume7dKg: number;
  rollingVolume28dKg: number;
  plateauDetected: boolean;
  acwr: {
    ratio: number;
    status: ACWRStatus;
    isCalibrated?: boolean;
    sessionsCount28d?: number;
    historySpanDays?: number;
    recommendation: string;
  };
  recentPRs: Array<{
    exerciseId?: string;
    exerciseName: string;
    oneRepMaxKg: number;
    achievedAt: string;
  }>;
  historicalPRs: Record<string, ExercisePRRecord>;
  workoutHistory: WorkoutSessionRecord[];
  muscleGroupVolumes: Record<string, number>;
  exerciseTrends: Record<string, { last1RM: number; previous1RM?: number; trend: 'UP' | 'STABLE' | 'DOWN'; plateauCount?: number }>;
}

export interface CalendarDayRecord {
  date: string; // YYYY-MM-DD in local timezone
  checkedIn: boolean;
  checkedInAt?: string;
  recoveryXpAwarded: boolean;
  workoutsCount: number;
  workoutXpAwardedCount: number;
  questsClaimedIds: string[];
  totalXpEarnedToday: number;
  streakCountAtDay: number;
}

export interface FacilityHistoryArchive {
  gymId: string;
  gymName: string;
  localGymXp: number;
  archivedAt: string;
}

export interface RPGCharacterState {
  level: number;
  xp: number;
  currentLevelBaseXp: number;
  nextLevelXp: number;
  hunterRank: HunterRank;
  unallocatedStatPoints: number;
  statAllocations?: Array<'strength' | 'endurance' | 'discipline' | 'recovery'>;
  stats: {
    strength: number;
    endurance: number;
    discipline: number;
    recovery: number;
  };
  streakDays: number;
  trainingStreakDays?: number;
  lastActiveDate: string;
  lastStreakDate?: string; // YYYY-MM-DD format in local timezone
  lastCheckInDate?: string; // YYYY-MM-DD format in local timezone
  longestStreak?: number;
  streakFreezeActive?: boolean;
  activityCalendar?: Record<string, CalendarDayRecord>;
  grantLedger?: Record<string, RewardGrantRecord>;
  personalProgress: {
    totalXp: number;
    lifetimeWorkouts: number;
    achievementsUnlocked: string[];
    claimedRewardsHistory: QuestClaimRecord[];
  };
  gymContext: {
    localGymId: string;
    localGymName: string;
    localGymXp: number;
    facilityRank: number | null; // null when no live verified leaderboard backend is connected
    squadName: string;
    squadRank: number | null;
    isDemoScenario: boolean;
    archivedFacilities?: FacilityHistoryArchive[];
  };
}

export interface CurrentMemberState {
  memberId: string;
  timestamp: string;
  profileSummary: {
    fitnessGoal: FitnessGoal;
    experienceLevel: ExperienceLevel;
    availableEquipment: AvailableEquipment;
    preferredSessionDurationMinutes: number;
    preferredTrainingDays?: number[];
    daysAvailablePerWeek?: number;
    activeLimitations: string[];
  };
  readiness: ReadinessMetrics;
  nutritionRecovery: NutritionRecoveryState;
  trainingProgress: TrainingProgressState;
  rpgState: RPGCharacterState;
  immediatePriorities: ImmediatePriority[];
  priorityExplanations: Record<string, string>;
  inputStaleness: {
    recoveryStale: boolean;
    workoutStale: boolean;
    unmeasuredBaseline?: boolean;
    lastRecoveryDate?: string;
    lastWorkoutDate?: string;
    message?: string;
  };
  assignedSessionPlan?: NextSessionPlan;
  nextSessionPlan: NextSessionPlan;
}
