// Decoupled Client Event Bus Types (EVOL.md Section 5)

export type ActivitySource = 'MANUAL_SELF_REPORTED' | 'ATOM_OS_VERIFIED' | 'SYSTEM_SIMULATION';

export type MuscleGroup = 'CHEST' | 'BACK' | 'LEGS' | 'SHOULDERS' | 'ARMS' | 'CORE' | 'CARDIO';

export type WorkoutSet = {
  id?: string;
  setIndex?: number;
  weightKg: number;
  reps: number;
  rpe?: number; // 1 - 10
  isWarmup?: boolean;
  confirmed?: boolean; // True when user explicitly confirmed performing this set
  completedAt?: string;
};

export type WorkoutExercise = {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: WorkoutSet[];
  notes?: string;
};

export interface ExercisePRRecord {
  exerciseId?: string;
  exerciseName: string;
  oneRepMaxKg: number;
  weightKg: number;
  reps: number;
  achievedAt: string;
  sessionId?: string;
}

export interface WorkoutSessionRecord {
  id: string;
  memberId?: string;
  gymId?: string;
  version?: number;
  source: ActivitySource;
  name: string;
  date: string; // ISO 8601 occurrence timestamp
  durationMinutes: number;
  measuredDurationSeconds?: number;
  durationEditedReason?: string;
  assignedQuestId?: string;
  exercises: WorkoutExercise[];
  totalTonnageKg: number;
  totalSets: number;
  fatigueStrainPoints: number;
  prsEarned: ExercisePRRecord[];
  status: 'COMPLETED' | 'DRAFT' | 'CORRECTED';
  notes?: string;
}

export interface RecoveryLogRecord {
  id: string;
  dateKey?: string; // YYYY-MM-DD local date key (1 canonical observation per day)
  source: ActivitySource;
  date: string; // ISO 8601
  sleepHours: number;
  hrvMs?: number;
  subjectiveReadiness: number; // 1-10
  proteinGrams: number;
  computedScore: number;
  strainAtLog: number;
  status: 'COMPLETED' | 'CORRECTED';
  notes?: string;
}

export interface DailyNutritionRecord {
  dateKey: string; // YYYY-MM-DD local date
  proteinGrams: number;
  hydrationMl: number;
  updatedAt: string;
}

export type EVOLEvent =
  | {
      eventId?: string;
      isPostCommitNotification?: boolean;
      type: 'MEMBER_CHECKED_IN';
      timestamp: string;
      gymId: string;
      memberId: string;
      facilityName?: string;
      source: ActivitySource;
    }
  | {
      eventId?: string;
      isPostCommitNotification?: boolean;
      type: 'WORKOUT_COMPLETED';
      timestamp: string;
      gymId: string;
      memberId: string;
      workout: WorkoutSessionRecord;
    }
  | {
      eventId?: string;
      isPostCommitNotification?: boolean;
      type: 'RECOVERY_LOGGED';
      timestamp: string;
      memberId: string;
      record: RecoveryLogRecord;
    }
  | {
      eventId?: string;
      isPostCommitNotification?: boolean;
      type: 'GATE_ACCESS_GRANTED';
      timestamp: string;
      gymId: string;
      turnstileId: string;
      memberId: string;
      source: ActivitySource;
    };
