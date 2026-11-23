// Module 2: Training Progression Engine (EVOL.md Section 4 & 5)

import { WorkoutExercise, WorkoutSessionRecord, ExercisePRRecord } from '../../types/events';
import {
  HunterProfile,
  ReadinessMetrics,
  TrainingProgressState,
  ACWRStatus,
} from '../../types/member-state';
import { NextSessionPlan, PlannedExercise } from '../../types/rpg';
import {
  resolveSafeExercise,
  findCatalogExercise,
  getLocalDateKeyFromTimestamp,
} from './training-helpers';

export interface ExercisePR {
  exerciseId?: string;
  exerciseName: string;
  oneRepMaxKg: number;
  weightKg: number;
  reps: number;
  achievedAt: string;
}

export interface TrainingMetrics {
  totalSessionTonnageKg: number;
  setsCount: number;
  muscleVolumes: Record<string, number>;
  newPRsDetected: ExercisePRRecord[];
  fatigueStrainPoints: number;
}

/**
 * Calculates Estimated 1RM using the Epley formula: 1RM = Weight * (1 + Reps / 30)
 */
export function calculateEpley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg);
  return Math.round(weightKg * (1 + reps / 30));
}

/**
 * Analyzes a completed workout for volume, tonnage, RPE strain, and PR improvements.
 * Excludes warmup sets and unconfirmed sets (if confirmed === false).
 */
export function analyzeWorkoutProgress(
  exercises: WorkoutExercise[],
  historicalPRs: Record<string, number | ExercisePRRecord> = {},
  sessionDate?: string
): TrainingMetrics {
  let totalSessionTonnageKg = 0;
  let setsCount = 0;
  let totalRpeWeightedStrain = 0;
  const muscleVolumes: Record<string, number> = {};
  const newPRsDetected: ExercisePRRecord[] = [];
  const achievedAt = sessionDate || new Date().toISOString();

  for (const ex of exercises) {
    const catalogMatch = findCatalogExercise(ex.exerciseId || ex.exerciseName);
    const canonicalId = catalogMatch?.exerciseId || ex.exerciseId || ex.exerciseName;
    let best1RMForExercise = 0;
    let bestWeight = 0;
    let bestReps = 0;

    for (const s of ex.sets) {
      if (s.isWarmup) continue;
      if (s.confirmed === false) continue;
      if ((s.reps || 0) <= 0) continue;

      const weight = Math.max(0, s.weightKg || 0);
      const reps = Math.max(0, s.reps || 0);
      const tonnage = weight * reps;
      totalSessionTonnageKg += tonnage;
      setsCount++;

      muscleVolumes[ex.muscleGroup] = (muscleVolumes[ex.muscleGroup] || 0) + 1;

      const rpe = s.rpe ? Math.min(10, Math.max(1, s.rpe)) : 7.5;
      const setStrain = tonnage / 1200 + rpe * 0.5;
      totalRpeWeightedStrain += setStrain;

      if (weight > 0) {
        const est1RM = calculateEpley1RM(weight, reps);
        if (est1RM > best1RMForExercise) {
          best1RMForExercise = est1RM;
          bestWeight = weight;
          bestReps = reps;
        }
      }
    }

    const previousPrObj = historicalPRs[ex.exerciseName] ?? historicalPRs[canonicalId];
    const previousBest =
      typeof previousPrObj === 'number' ? previousPrObj : previousPrObj?.oneRepMaxKg || 0;

    if (best1RMForExercise > previousBest && best1RMForExercise > 0) {
      newPRsDetected.push({
        exerciseId: canonicalId,
        exerciseName: ex.exerciseName,
        oneRepMaxKg: best1RMForExercise,
        weightKg: bestWeight,
        reps: bestReps,
        achievedAt,
      });
    }
  }

  const fatigueStrainPoints =
    setsCount === 0
      ? 0
      : Math.round(Math.min(100, setsCount * 1.8 + totalRpeWeightedStrain + totalSessionTonnageKg / 1500));

  return {
    totalSessionTonnageKg,
    setsCount,
    muscleVolumes,
    newPRsDetected,
    fatigueStrainPoints,
  };
}

/**
 * Acute:Chronic Workload Ratio (ACWR) Calculation with Cold-Start Gate.
 * Requires calibrated multi-week history before emitting overtraining/undertraining ratio overrides.
 */
export function calculateACWR(
  acuteWeeklyTonnage: number,
  chronicAverageWeeklyTonnage: number,
  options: { isCalibrated?: boolean; sessionsCount28d?: number; historySpanDays?: number } = {}
): {
  ratio: number;
  status: ACWRStatus;
  isCalibrated: boolean;
  sessionsCount28d: number;
  historySpanDays: number;
  recommendation: string;
} {
  const isCalibrated = options.isCalibrated ?? chronicAverageWeeklyTonnage > 0;

  const sessionsCount28d = options.sessionsCount28d ?? 0;
  const historySpanDays = options.historySpanDays ?? 0;

  if (!isCalibrated || chronicAverageWeeklyTonnage <= 0) {
    return {
      ratio: 1.0,
      status: 'CALIBRATING',
      isCalibrated: false,
      sessionsCount28d,
      historySpanDays,
      recommendation:
        'Calibrating workload baseline (requires at least 4 sessions across 10+ days before ACWR ratio overrides apply).',
    };
  }

  const ratio = Number((acuteWeeklyTonnage / chronicAverageWeeklyTonnage).toFixed(2));

  if (ratio > 1.4) {
    return {
      ratio,
      status: 'OVERTRAINING_RISK',
      isCalibrated: true,
      sessionsCount28d,
      historySpanDays,
      recommendation: `ACWR is elevated at ${ratio} (>1.4). Fatigue spike detected! Deload or volume reduction advised.`,
    };
  }

  if (ratio < 0.8) {
    return {
      ratio,
      status: 'UNDERTRAINING',
      isCalibrated: true,
      sessionsCount28d,
      historySpanDays,
      recommendation: `ACWR is ${ratio} (<0.8). Load is below recent chronic average. Ready for progressive volume increase.`,
    };
  }

  return {
    ratio,
    status: 'OPTIMAL',
    isCalibrated: true,
    sessionsCount28d,
    historySpanDays,
    recommendation: `ACWR is ${ratio} (0.8 - 1.3). Optimal adaptation zone for progressive overload.`,
  };
}

/**
 * Plateau Detection: Identifies if volume/load has stagnated for 3+ consecutive sessions
 */
export function checkPlateau(recentSessionTonnages: number[]): boolean {
  const positive = recentSessionTonnages.filter((t) => t > 0);
  if (positive.length < 3) return false;
  const lastThree = positive.slice(-3);
  const variance = Math.max(...lastThree) - Math.min(...lastThree);
  const average = lastThree.reduce((a, b) => a + b, 0) / 3;

  if (average <= 0) return false;
  const isUpward = lastThree[2] > lastThree[1] && lastThree[1] > lastThree[0];
  if (isUpward && variance >= average * 0.025) return false;
  return variance < average * 0.025 || lastThree[2] <= lastThree[0];
}

/**
 * Recomputes all historical training metrics, PRs, and trends from durable dated workout records.
 * Completely deterministic and safe for edits, deletions, and date rollovers.
 */
export function recalculateHistoricalMetrics(
  workoutHistory: WorkoutSessionRecord[],
  referenceNow: number = Date.now()
): {
  rollingVolume7dKg: number;
  rollingVolume28dKg: number;
  acwr: {
    ratio: number;
    status: ACWRStatus;
    isCalibrated: boolean;
    sessionsCount28d: number;
    historySpanDays: number;
    recommendation: string;
  };
  plateauDetected: boolean;
  muscleGroupVolumes7d: Record<string, number>;
  exerciseTrends: Record<
    string,
    { last1RM: number; previous1RM?: number; trend: 'UP' | 'STABLE' | 'DOWN'; plateauCount?: number }
  >;
  recomputedHistoricalPRs: Record<string, ExercisePRRecord>;
  recomputedRecentPRs: Array<{ exerciseId?: string; exerciseName: string; oneRepMaxKg: number; achievedAt: string }>;
} {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = referenceNow - 7 * ONE_DAY_MS;
  const twentyEightDaysAgo = referenceNow - 28 * ONE_DAY_MS;

  let rollingVolume7dKg = 0;
  let rollingVolume28dKg = 0;
  const muscleGroupVolumes7d: Record<string, number> = {};
  const recentTonnages: number[] = [];

  const exercise1RMHistory: Record<string, Array<{ date: number; max1RM: number }>> = {};
  const recomputedHistoricalPRs: Record<string, ExercisePRRecord> = {};
  const allPRMilestones: Array<{
    exerciseId?: string;
    exerciseName: string;
    oneRepMaxKg: number;
    achievedAt: string;
    timestamp: number;
  }> = [];

  // Filter out invalid or far-future timestamps (> 5 min ahead of referenceNow) and empty sessions
  const validSessions = (workoutHistory || []).filter((s) => {
    const t = new Date(s.date).getTime();
    return !isNaN(t) && t <= referenceNow + 5 * 60 * 1000 && s.totalSets > 0;
  });

  // Sort history chronologically ascending
  const sorted = [...validSessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let sessionsCount28d = 0;
  let earliestSessionIn28d = referenceNow;
  const distinctDays28d = new Set<string>();

  for (const session of sorted) {
    const sessionTime = new Date(session.date).getTime();
    recentTonnages.push(session.totalTonnageKg);

    if (sessionTime >= twentyEightDaysAgo) {
      rollingVolume28dKg += session.totalTonnageKg;
      if (session.totalTonnageKg > 0) {
        sessionsCount28d++;
        if (sessionTime < earliestSessionIn28d) earliestSessionIn28d = sessionTime;
        distinctDays28d.add(getLocalDateKeyFromTimestamp(sessionTime));
      }
    }

    if (sessionTime >= sevenDaysAgo) {
      rollingVolume7dKg += session.totalTonnageKg;

      for (const ex of session.exercises) {
        const workingSetsCount = ex.sets.filter((s) => !s.isWarmup && s.confirmed !== false && s.reps > 0).length;
        muscleGroupVolumes7d[ex.muscleGroup] =
          (muscleGroupVolumes7d[ex.muscleGroup] || 0) + workingSetsCount;
      }
    }

    // Extract best 1RM for each exercise in this session & rebuild historical PRs from scratch
    for (const ex of session.exercises) {
      const catalogMatch = findCatalogExercise(ex.exerciseId || ex.exerciseName);
      const canonicalId = catalogMatch?.exerciseId || ex.exerciseId || ex.exerciseName;
      let sessionBest1RM = 0;
      let bestWeight = 0;
      let bestReps = 0;

      for (const s of ex.sets) {
        if (s.isWarmup || s.confirmed === false || (s.weightKg || 0) <= 0 || (s.reps || 0) <= 0) continue;
        const est = calculateEpley1RM(s.weightKg, s.reps);
        if (est > sessionBest1RM) {
          sessionBest1RM = est;
          bestWeight = s.weightKg;
          bestReps = s.reps;
        }
      }

      if (sessionBest1RM > 0) {
        if (!exercise1RMHistory[ex.exerciseName]) {
          exercise1RMHistory[ex.exerciseName] = [];
        }
        exercise1RMHistory[ex.exerciseName].push({
          date: sessionTime,
          max1RM: sessionBest1RM,
        });

        const currentBest = recomputedHistoricalPRs[ex.exerciseName]?.oneRepMaxKg || 0;
        if (sessionBest1RM > currentBest) {
          const prRecord: ExercisePRRecord = {
            exerciseId: canonicalId,
            exerciseName: ex.exerciseName,
            oneRepMaxKg: sessionBest1RM,
            weightKg: bestWeight,
            reps: bestReps,
            achievedAt: session.date,
            sessionId: session.id,
          };
          recomputedHistoricalPRs[ex.exerciseName] = prRecord;
          allPRMilestones.push({
            exerciseId: canonicalId,
            exerciseName: ex.exerciseName,
            oneRepMaxKg: sessionBest1RM,
            achievedAt: session.date,
            timestamp: sessionTime,
          });
        }
      }
    }
  }

  const historySpanDays =
    sessionsCount28d > 0
      ? Math.max(1, Math.round((referenceNow - earliestSessionIn28d) / ONE_DAY_MS))
      : 0;

  // Cold-start protection: require at least 4 sessions spanning >= 10 days across >= 3 distinct days
  const isCalibrated =
    sessionsCount28d >= 4 && historySpanDays >= 10 && distinctDays28d.size >= 3 && rollingVolume28dKg > 0;

  // When calibrated, divide 28-day tonnage by 4 to get chronic 4-week rolling weekly average
  const chronicAverageWeeklyTonnage = isCalibrated ? rollingVolume28dKg / 4 : 0;

  const acwr = calculateACWR(rollingVolume7dKg, chronicAverageWeeklyTonnage, {
    isCalibrated,
    sessionsCount28d,
    historySpanDays,
  });

  const plateauDetected = checkPlateau(recentTonnages);

  const exerciseTrends: Record<
    string,
    { last1RM: number; previous1RM?: number; trend: 'UP' | 'STABLE' | 'DOWN'; plateauCount?: number }
  > = {};

  for (const [exerciseName, history] of Object.entries(exercise1RMHistory)) {
    if (history.length >= 2) {
      const last = history[history.length - 1].max1RM;
      const prev = history[history.length - 2].max1RM;
      const trend = last > prev ? 'UP' : last < prev ? 'DOWN' : 'STABLE';
      let plateauCount = 0;
      for (let i = history.length - 1; i >= 1; i--) {
        if (history[i].max1RM <= history[i - 1].max1RM) plateauCount++;
        else break;
      }
      exerciseTrends[exerciseName] = { last1RM: last, previous1RM: prev, trend, plateauCount };
    } else if (history.length === 1) {
      exerciseTrends[exerciseName] = { last1RM: history[0].max1RM, trend: 'STABLE', plateauCount: 0 };
    }
  }

  const recomputedRecentPRs = allPRMilestones
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map((p) => ({
      exerciseId: p.exerciseId,
      exerciseName: p.exerciseName,
      oneRepMaxKg: p.oneRepMaxKg,
      achievedAt: p.achievedAt,
    }));

  return {
    rollingVolume7dKg,
    rollingVolume28dKg,
    acwr,
    plateauDetected,
    muscleGroupVolumes7d,
    exerciseTrends,
    recomputedHistoricalPRs,
    recomputedRecentPRs,
  };
}

/**
 * Helper to inspect most recent performance for a specific canonical exerciseId / exerciseName
 */
function getLastExercisePerformance(
  exerciseId: string,
  exerciseName: string,
  workoutHistory: WorkoutSessionRecord[]
): {
  lastWeightKg: number;
  avgReps: number;
  avgRpe: number;
  setsCompleted: number;
} | null {
  const sorted = [...(workoutHistory || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  for (const session of sorted) {
    for (const ex of session.exercises) {
      const cat = findCatalogExercise(ex.exerciseId || ex.exerciseName);
      const matches =
        ex.exerciseId === exerciseId ||
        cat?.exerciseId === exerciseId ||
        ex.exerciseName.toLowerCase() === exerciseName.toLowerCase();
      if (!matches) continue;

      const workingSets = ex.sets.filter((s) => !s.isWarmup && s.confirmed !== false && s.reps > 0);
      if (workingSets.length === 0) continue;

      const maxWeight = Math.max(...workingSets.map((s) => s.weightKg || 0));
      const avgReps = workingSets.reduce((acc, s) => acc + s.reps, 0) / workingSets.length;
      const avgRpe =
        workingSets.reduce((acc, s) => acc + (s.rpe ?? 8), 0) / workingSets.length;

      return {
        lastWeightKg: maxWeight,
        avgReps,
        avgRpe,
        setsCompleted: workingSets.length,
      };
    }
  }
  return null;
}

/**
 * Next-Session Planner
 * Synthesizes member history, schedule availability, equipment, duration, limitations,
 * plateau state, and readiness into an actionable, constraint-verified next training session plan.
 */
export function planNextSession(
  profile: HunterProfile,
  readiness: ReadinessMetrics,
  training: TrainingProgressState,
  referenceDate: Date = new Date()
): NextSessionPlan {
  const acwrIsCalibrated =
    readiness.acwrIsCalibrated ?? training.acwr?.isCalibrated ?? false;
  const isAcwrSpike = acwrIsCalibrated && readiness.acwrRatio > 1.4;
  const isDeload = readiness.deloadRecommended || readiness.score < 45 || isAcwrSpike;
  const adjustmentNotes: string[] = [];

  // 1. Schedule & Availability Evaluation
  const dayOfWeek = referenceDate.getDay(); // 0=Sun .. 6=Sat
  const preferredDays =
    profile.preferredTrainingDays && profile.preferredTrainingDays.length > 0
      ? profile.preferredTrainingDays
      : [1, 3, 5];
  const targetWeeklySessions =
    profile.daysAvailablePerWeek || preferredDays.length || 3;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const nowMs = referenceDate.getTime();
  const recent7dSessions = (training.workoutHistory || []).filter((w) => {
    const t = new Date(w.date).getTime();
    return !isNaN(t) && t >= nowMs - 7 * ONE_DAY_MS && t <= nowMs + 5 * 60 * 1000 && w.totalSets > 0;
  });

  let scheduleStatus: NextSessionPlan['scheduleStatus'] = 'TRAINING_DAY';
  if (recent7dSessions.length >= targetWeeklySessions) {
    scheduleStatus = 'WEEKLY_TARGET_MET';
    adjustmentNotes.push(
      `Weekly training frequency target met (${recent7dSessions.length}/${targetWeeklySessions} sessions in last 7 days).`
    );
  } else if (!preferredDays.includes(dayOfWeek)) {
    // Check if user missed an earlier preferred day this week
    const missedPreferredDay = recent7dSessions.length < targetWeeklySessions;
    scheduleStatus = missedPreferredDay ? 'MISSED_SESSION_MAKEUP' : 'REST_DAY_OVERRIDE';
    adjustmentNotes.push(
      missedPreferredDay
        ? `Makeup session scheduled (${recent7dSessions.length}/${targetWeeklySessions} weekly sessions completed so far).`
        : `Scheduled rest day on your preferred calendar; optional session plan prepared.`
    );
  }

  // 2. Focus Selection
  let focus: NextSessionPlan['focus'] = 'HYPERSTROPHY';
  if (isDeload) {
    focus = 'ACTIVE_DELOAD';
    adjustmentNotes.push(
      isAcwrSpike
        ? `Calibrated ACWR workload spike (${readiness.acwrRatio} > 1.4). Volume reduced 40% and effort capped at RPE 5-6.`
        : `Low recovery readiness (${readiness.score}/100). Volume reduced 40% for active recovery.`
    );
  } else if (profile.fitnessGoal === 'STRENGTH') {
    focus = 'STRENGTH';
  } else if (profile.fitnessGoal === 'FAT_LOSS') {
    focus = 'METABOLIC_CONDITIONING';
  } else if (profile.fitnessGoal === 'ENDURANCE') {
    focus = 'ENDURANCE';
  } else {
    focus = 'HYPERSTROPHY';
  }

  // 3. Plateau Response
  const isPlateauActive = Boolean(training.plateauDetected) && !isDeload;
  if (isPlateauActive) {
    adjustmentNotes.push(
      'Plateau detected across recent sessions: shifting rep targets and accessory stimulus to break adaptation stall.'
    );
  }

  // 4. Duration & Volume Budget
  const duration = profile.preferredSessionDurationMinutes || 60;
  let targetTotalSets = 16;
  if (duration <= 45) targetTotalSets = 12;
  else if (duration >= 75) targetTotalSets = 20;

  if (profile.experienceLevel === 'BEGINNER') {
    targetTotalSets = Math.round(targetTotalSets * 0.8);
  } else if (profile.experienceLevel === 'ADVANCED') {
    targetTotalSets = Math.round(targetTotalSets * 1.15);
  }

  if (isDeload) {
    targetTotalSets = Math.max(6, Math.round(targetTotalSets * 0.6));
  } else if (isPlateauActive) {
    targetTotalSets = targetTotalSets + 2; // Add 2 stimulus sets to break volume plateau
  }

  // 5. Balance muscle groups based on recent 7d distribution
  const volumes = training.muscleGroupVolumes || {};
  const chestSets = volumes['CHEST'] || 0;
  const backSets = volumes['BACK'] || 0;
  const legSets = volumes['LEGS'] || 0;

  let sessionName = '';
  let candidatePool: Array<{
    exerciseId: string;
    targetReps: [number, number];
    rpe: number;
    rest: number;
    intensityPct: number;
  }> = [];

  if (isDeload) {
    sessionName = 'Light Recovery & Mobility Session';
    candidatePool = [
      { exerciseId: 'goblet_squat', targetReps: [8, 10], rpe: 5.5, rest: 90, intensityPct: 0.5 },
      { exerciseId: 'chest_supported_row', targetReps: [10, 12], rpe: 6, rest: 90, intensityPct: 0.5 },
      { exerciseId: 'dumbbell_neutral_incline_press', targetReps: [10, 12], rpe: 6, rest: 90, intensityPct: 0.5 },
      { exerciseId: 'cable_face_pull', targetReps: [15, 20], rpe: 6, rest: 60, intensityPct: 0.45 },
    ];
  } else if (legSets <= chestSets && legSets <= backSets) {
    sessionName = focus === 'STRENGTH' ? 'Lower Body Strength' : 'Legs & Glutes Workout';
    candidatePool = [
      {
        exerciseId: 'barbell_back_squat',
        targetReps: focus === 'STRENGTH' ? [4, 6] : [8, 10],
        rpe: focus === 'STRENGTH' ? 8.5 : 8,
        rest: focus === 'STRENGTH' ? 180 : 120,
        intensityPct: focus === 'STRENGTH' ? 0.82 : 0.72,
      },
      {
        exerciseId: 'romanian_deadlift',
        targetReps: [8, 10],
        rpe: 8,
        rest: 120,
        intensityPct: 0.7,
      },
      {
        exerciseId: 'leg_press',
        targetReps: [10, 12],
        rpe: 8.5,
        rest: 90,
        intensityPct: 0.68,
      },
      {
        exerciseId: 'lying_hamstring_curl',
        targetReps: [12, 15],
        rpe: 8.5,
        rest: 60,
        intensityPct: 0.65,
      },
      {
        exerciseId: 'hanging_leg_raise',
        targetReps: [12, 15],
        rpe: 8,
        rest: 60,
        intensityPct: 0,
      },
    ];
  } else if (backSets <= chestSets) {
    sessionName = focus === 'STRENGTH' ? 'Back & Deadlift Strength' : 'Back & Biceps Workout';
    candidatePool = [
      {
        exerciseId: 'conventional_deadlift',
        targetReps: focus === 'STRENGTH' ? [3, 5] : [6, 8],
        rpe: focus === 'STRENGTH' ? 8.5 : 8,
        rest: 180,
        intensityPct: focus === 'STRENGTH' ? 0.85 : 0.75,
      },
      {
        exerciseId: 'chest_supported_row',
        targetReps: [8, 10],
        rpe: 8,
        rest: 120,
        intensityPct: 0.72,
      },
      {
        exerciseId: 'lat_pulldown',
        targetReps: [10, 12],
        rpe: 8,
        rest: 90,
        intensityPct: 0.7,
      },
      {
        exerciseId: 'incline_db_bicep_curl',
        targetReps: [10, 12],
        rpe: 8.5,
        rest: 60,
        intensityPct: 0.65,
      },
    ];
  } else {
    sessionName = focus === 'STRENGTH' ? 'Upper Body Strength' : 'Chest, Shoulders & Triceps';
    candidatePool = [
      {
        exerciseId: 'barbell_incline_bench',
        targetReps: focus === 'STRENGTH' ? [5, 6] : [8, 10],
        rpe: focus === 'STRENGTH' ? 8.5 : 8,
        rest: focus === 'STRENGTH' ? 180 : 120,
        intensityPct: focus === 'STRENGTH' ? 0.82 : 0.72,
      },
      {
        exerciseId: 'dumbbell_flat_bench',
        targetReps: [8, 10],
        rpe: 8,
        rest: 90,
        intensityPct: 0.7,
      },
      {
        exerciseId: 'cable_lateral_raise',
        targetReps: [12, 15],
        rpe: 8.5,
        rest: 60,
        intensityPct: 0.6,
      },
      {
        exerciseId: 'tricep_rope_pushdown',
        targetReps: [10, 12],
        rpe: 8,
        rest: 60,
        intensityPct: 0.65,
      },
    ];
  }

  // 6. Resolve constraints (Equipment + Injury Limitations) & Per-Exercise Progression
  const plannedExercises: PlannedExercise[] = [];
  const poolCount = candidatePool.length;
  const baseSetsPerExercise = Math.max(2, Math.floor(targetTotalSets / poolCount));
  let remainderSets = Math.max(0, targetTotalSets - baseSetsPerExercise * poolCount);

  const expMultiplier =
    profile.experienceLevel === 'ADVANCED'
      ? 1.25
      : profile.experienceLevel === 'INTERMEDIATE'
      ? 1.0
      : 0.7;
  const bodyWeightBaseline = Math.max(45, profile.currentWeightKg || 72);
  const alreadyChosenIds = new Set<string>();
  let unknownLimitationsCollected: string[] = [];

  for (const c of candidatePool) {
    const resolved = resolveSafeExercise(
      c.exerciseId,
      profile.availableEquipment || 'FULL_GYM',
      profile.activeLimitations || [],
      alreadyChosenIds
    );
    const catalogEx = resolved.exercise;
    alreadyChosenIds.add(catalogEx.exerciseId);

    if (resolved.unknownLimitations.length > 0) {
      unknownLimitationsCollected = resolved.unknownLimitations;
    }

    if (resolved.wasSubstituted && resolved.substitutionReason) {
      adjustmentNotes.push(resolved.substitutionReason);
    }

    const exerciseSets = baseSetsPerExercise + (remainderSets > 0 ? 1 : 0);
    if (remainderSets > 0) remainderSets--;

    let effectiveRepRange: [number, number] = [...c.targetReps];
    let effectiveRest = c.rest;

    if (!isDeload) {
      if (focus === 'ENDURANCE') {
        effectiveRepRange = [Math.max(12, c.targetReps[0] + 4), Math.max(15, c.targetReps[1] + 5)];
        effectiveRest = Math.min(c.rest, 60);
      } else if (focus === 'METABOLIC_CONDITIONING') {
        effectiveRepRange = [Math.max(10, c.targetReps[0] + 2), Math.max(12, c.targetReps[1] + 2)];
        effectiveRest = Math.min(c.rest, 75);
      } else if (isPlateauActive) {
        // Shift rep range by +2 reps to provide novel hypertrophy/strength stimulus
        effectiveRepRange = [c.targetReps[0] + 2, c.targetReps[1] + 2];
      }
    }

    // Strict PR & Performance lookup ONLY for the resolved exercise (never borrow original exercise's PR!)
    const historicalPr =
      training.historicalPRs?.[catalogEx.exerciseName] ||
      Object.values(training.historicalPRs || {}).find((p) => p.exerciseId === catalogEx.exerciseId);
    const lastPerf = getLastExercisePerformance(
      catalogEx.exerciseId,
      catalogEx.exerciseName,
      training.workoutHistory || []
    );

    let suggestedWeightKg: number | undefined = undefined;
    let isCalibrationEstimate = false;
    let progressionAction: PlannedExercise['progressionAction'] = 'CALIBRATE';
    let progressionReason = '';

    if (catalogEx.isBodyweight) {
      // Bodyweight movements NEVER receive invented external kilograms
      suggestedWeightKg = undefined;
      isCalibrationEstimate = false;
      progressionAction = 'PROGRESS_REPS';
      progressionReason = 'Bodyweight movement — progress via controlled reps and tempo.';
    } else if (isDeload) {
      const baseWeight =
        lastPerf?.lastWeightKg ||
        (historicalPr ? historicalPr.oneRepMaxKg * 0.7 : bodyWeightBaseline * catalogEx.defaultStarterLoadRatio * expMultiplier);
      suggestedWeightKg = Math.max(5, Math.round((baseWeight * 0.65) / 2.5) * 2.5);
      progressionAction = 'DELOAD';
      progressionReason = 'Deload load (~65% normal working weight) to facilitate recovery.';
    } else if (lastPerf && lastPerf.lastWeightKg > 0) {
      if (lastPerf.avgReps >= effectiveRepRange[1] && lastPerf.avgRpe <= 8.5) {
        suggestedWeightKg = Number((lastPerf.lastWeightKg + 2.5).toFixed(1));
        progressionAction = 'PROGRESS_LOAD';
        progressionReason = `Hit ${Math.round(lastPerf.avgReps)} reps @ RPE ${lastPerf.avgRpe.toFixed(1)} last session -> +2.5 kg progression.`;
      } else if (lastPerf.avgReps < effectiveRepRange[0] || lastPerf.avgRpe >= 9.5) {
        suggestedWeightKg = Math.max(5, Math.round((lastPerf.lastWeightKg * 0.95) / 2.5) * 2.5);
        progressionAction = 'REGRESS';
        progressionReason = `Last session reached RPE ${lastPerf.avgRpe.toFixed(1)} / ${Math.round(lastPerf.avgReps)} reps -> -5% load adjustment for clean execution.`;
      } else {
        suggestedWeightKg = lastPerf.lastWeightKg;
        progressionAction = isPlateauActive ? 'PROGRESS_REPS' : 'HOLD';
        progressionReason = `Hold ${lastPerf.lastWeightKg} kg and aim for top of ${effectiveRepRange[0]}-${effectiveRepRange[1]} rep range.`;
      }
    } else if (historicalPr && historicalPr.oneRepMaxKg > 0 && c.intensityPct > 0) {
      suggestedWeightKg = Math.max(5, Math.round((historicalPr.oneRepMaxKg * c.intensityPct) / 2.5) * 2.5);
      progressionAction = 'HOLD';
      progressionReason = `Derived from recorded ${catalogEx.exerciseName} 1RM (${historicalPr.oneRepMaxKg} kg).`;
    } else {
      // Uncalibrated starter estimate (explicitly marked as calibration estimate, not confirmed ability)
      const rawStarter = bodyWeightBaseline * (catalogEx.defaultStarterLoadRatio || 0.3) * expMultiplier;
      suggestedWeightKg = Math.max(5, Math.round(rawStarter / 2.5) * 2.5);
      isCalibrationEstimate = true;
      progressionAction = 'CALIBRATE';
      progressionReason = 'Initial starter estimate — adjust load during your first set to calibrate.';
    }

    plannedExercises.push({
      exerciseId: catalogEx.exerciseId,
      exerciseName: catalogEx.exerciseName,
      muscleGroup: catalogEx.muscleGroup,
      targetSets: exerciseSets,
      targetRepRange: effectiveRepRange,
      suggestedWeightKg,
      isBodyweight: catalogEx.isBodyweight,
      isCalibrationEstimate,
      progressionAction,
      progressionReason,
      rpeTarget: c.rpe,
      restSeconds: effectiveRest,
      substitutionReason: resolved.substitutionReason,
    });
  }

  if (unknownLimitationsCollected.length > 0) {
    adjustmentNotes.push(
      `Unrecognized limitation tag(s): [${unknownLimitationsCollected.join(', ')}]. Please verify exercise comfort with a professional.`
    );
  }

  const actualPlannedSets = plannedExercises.reduce((acc, ex) => acc + ex.targetSets, 0);

  // Target tonnage sums only external-load exercises (bodyweight exercises contribute 0 external tonnage)
  const targetTonnageKg = plannedExercises.reduce((acc, ex) => {
    if (ex.isBodyweight || !ex.suggestedWeightKg) return acc;
    const minReps = ex.targetRepRange[0];
    return acc + Math.round(ex.targetSets * minReps * ex.suggestedWeightKg);
  }, 0);

  const rationale = isDeload
    ? `Light Recovery Active: Readiness is ${readiness.score}/100${
        isAcwrSpike ? ` and calibrated workload ratio is ${readiness.acwrRatio}` : ''
      }. Volume is reduced by 40% with lighter effort.`
    : `Tailored for your ${profile.fitnessGoal.toLowerCase().replace('_', ' ')} goal (${duration} min session, ${scheduleStatus.replace(/_/g, ' ').toLowerCase()}). Readiness is ${readiness.score}/100. Planned ${actualPlannedSets} working sets.`;

  return {
    planId: `plan-${getLocalDateKeyFromTimestamp(nowMs)}-${focus.toLowerCase()}`,
    version: 1,
    dateKey: getLocalDateKeyFromTimestamp(nowMs),
    sessionName,
    focus,
    plannedDurationMinutes: duration,
    targetTonnageKg,
    rationale,
    scheduleStatus,
    exercises: plannedExercises,
    adjustmentNotes,
    unknownLimitations: unknownLimitationsCollected.length > 0 ? unknownLimitationsCollected : undefined,
    updatedAt: referenceDate.toISOString(),
  };
}
