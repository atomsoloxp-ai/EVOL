// RPG Quests, Dungeons, and System Dialogue Interfaces

import { MuscleGroup } from './events';

export type QuestCategory = 'MAIN_QUEST' | 'SIDE_QUEST' | 'PENALTY_QUEST' | 'DUNGEON_GATE';
export type QuestStatus = 'IN_PROGRESS' | 'OBJECTIVES_MET' | 'CLAIMED' | 'EXPIRED';
export type ObjectiveMetricType = 'WORKING_SETS' | 'TONNAGE_KG' | 'DURATION_MINUTES' | 'PROTEIN_GRAMS' | 'HYDRATION_ML' | 'SLEEP_HOURS';

export interface QuestReward {
  xp: number;
  statPoints?: {
    strength?: number;
    endurance?: number;
    discipline?: number;
    recovery?: number;
  };
  itemReward?: string;
  badge?: string;
}

export interface QuestRequirement {
  id?: string;
  metricType?: ObjectiveMetricType;
  description: string;
  targetCount: number;
  currentCount: number;
  unit: string; // "sets", "kg", "g", "ml", "h", "min"
}

export interface SystemQuest {
  id: string; // Stable deterministic daily ID, e.g., 'quest-main-2026-10-26'
  dateAssigned: string; // YYYY-MM-DD in local timezone
  prescriptionVersion?: number;
  assignedSessionName?: string;
  title: string;
  subTitle: string;
  category: QuestCategory;
  isDeloadOrRecovery: boolean;
  requiredForDailyClear: boolean;
  requirements: QuestRequirement[];
  rewards: QuestReward;
  status: QuestStatus;
  penaltyWarning?: string;
  deadlineHoursRemaining: number;
  expiresAt?: string; // ISO timestamp for end of local day
  injuryFilteredWarning?: string;
  claimedAt?: string;
}

export interface QuestClaimRecord {
  grantId?: string;
  questId: string;
  questTitle: string;
  dateKey?: string;
  claimedAt: string;
  xpEarned: number;
  statPointsEarned?: {
    strength?: number;
    endurance?: number;
    discipline?: number;
    recovery?: number;
  };
  itemReward?: string;
}

export interface RewardGrantRecord {
  grantId: string; // Unique deterministic grant key, e.g., 'workout-xp-w-123', 'quest-claim-...', 'gate-clear-...'
  cause: 'WORKOUT' | 'CHECK_IN' | 'QUEST_CLAIM' | 'RECOVERY_LOG' | 'GATE_CLEAR' | 'STREAK_MILESTONE';
  sourceId: string; // sessionId, questId, gateId, or dateKey
  dateKey: string; // YYYY-MM-DD
  timestamp: string;
  personalXp: number;
  gymXp: number;
  workoutCountDelta: number;
  statPoints: {
    strength: number;
    endurance: number;
    discipline: number;
    recovery: number;
  };
  bossDamage?: number;
  gymId?: string;
  gateId?: string;
  gateMaxHp?: number;
  gateRewardXp?: number;
  gateTitle?: string;
  rewardStreakDays?: number;
  revokedAt?: string;
  notes?: string;
}

export interface PlannedExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  targetSets: number;
  targetRepRange: [number, number];
  suggestedWeightKg?: number;
  isBodyweight?: boolean;
  isCalibrationEstimate?: boolean;
  progressionAction?: 'PROGRESS_LOAD' | 'PROGRESS_REPS' | 'HOLD' | 'REGRESS' | 'CALIBRATE' | 'DELOAD';
  progressionReason?: string;
  rpeTarget: number;
  restSeconds: number;
  substitutionReason?: string;
}

export interface NextSessionPlan {
  planId?: string;
  version?: number;
  dateKey?: string;
  sessionName: string;
  focus: 'STRENGTH' | 'HYPERSTROPHY' | 'ENDURANCE' | 'ACTIVE_DELOAD' | 'RECOVERY_MOBILITY' | 'METABOLIC_CONDITIONING';
  plannedDurationMinutes: number;
  targetTonnageKg: number;
  rationale: string;
  scheduleStatus?: 'TRAINING_DAY' | 'REST_DAY_OVERRIDE' | 'MISSED_SESSION_MAKEUP' | 'WEEKLY_TARGET_MET';
  exercises: PlannedExercise[];
  adjustmentNotes: string[];
  unknownLimitations?: string[];
  updatedAt: string;
}

export interface DungeonGate {
  id: string;
  name: string;
  gateRank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  bossName: string;
  bossMaxHp: number;
  bossCurrentHp: number;
  recommendedTonnageKg: number;
  cleared: boolean;
  rewardGranted?: boolean;
  rewards: {
    xp: number;
    title: string;
    item: string;
  };
}

export interface SystemCoachMessage {
  id: string;
  timestamp: string;
  sender: 'SYSTEM' | 'HUNTER';
  persona: 'SYSTEM_ADMIN' | 'SHADOW_BERU' | 'ARCHITECT';
  content: string;
  userPrompt?: string;
  actionPrompt?: string;
}

// AtomOS Forward-Compatibility Interface (Decoupled Adapter Pattern)
export interface IAtomOSAdapter {
  isAvailable(): boolean;
  isSimulatedAdapter?: () => boolean;
  connect(facilityId: string): Promise<boolean>;
  disconnect(): Promise<void>;
  simulateMemberCheckIn(memberId: string, facilityId: string): Promise<boolean>;
  simulateWorkoutSync(memberId: string, workoutData: any): Promise<boolean>;
  getFacilityStatus(): { connected: boolean; isSimulated?: boolean; facilityName: string; activeMembersCount: number };
}
