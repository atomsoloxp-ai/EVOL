// Module 3: Nutrition & Recovery Engine (EVOL.md Section 4 & 5)

import {
  ReadinessStatus,
  ReadinessMetrics,
  NutritionRecoveryState,
  ACWRStatus,
} from '../../types/member-state';
import { RecoveryLogRecord, WorkoutSessionRecord, DailyNutritionRecord } from '../../types/events';
import { getLocalDateString } from './streak-engine';

export interface RecoveryInput {
  sleepHours: number;
  targetSleepHours: number;
  subjectiveReadiness: number; // 1 - 10
  hrvMs?: number; // optional
  todayProteinGrams: number;
  targetProteinGrams: number;
  recentStrainIndex: number; // 0 - 100
  acuteFatigueStrain?: number;
  acwrRatio?: number;
  acwrStatus?: ACWRStatus;
  acwrIsCalibrated?: boolean;
}

/**
 * Computes raw workout strain at a given reference time from dated workout records
 * and dated recovery observations (at most 1 recovery decay credit per calendar dateKey).
 * This ensures repeated recovery saves on the same day or workout renames are 100% idempotent!
 */
export function computeDatedResidualStrain(
  workoutHistory: WorkoutSessionRecord[],
  recoveryLogs: RecoveryLogRecord[],
  referenceNow: number = Date.now()
): number {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = referenceNow - 7 * ONE_DAY_MS;

  // A daily sleep check-in describes the night BEFORE its date, not recovery
  // from exercise performed later that day. Use the day boundary as its cutoff.
  const recoveryByDateKey = new Map<string, RecoveryLogRecord>();
  for (const log of recoveryLogs || []) {
    const key = log.dateKey || (log.date ? getLocalDateString(new Date(log.date)) : '');
    if (key && Date.parse(log.date) <= referenceNow && !recoveryByDateKey.has(key)) {
      recoveryByDateKey.set(key, log);
    }
  }

  // Sum time-decayed strain from workouts within the last 7 days
  const validWorkouts = (workoutHistory || [])
    .filter((w) => {
      const t = new Date(w.date).getTime();
      return !isNaN(t) && t >= sevenDaysAgo && t <= referenceNow + 5 * 60 * 1000 && w.totalSets > 0;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (validWorkouts.length === 0) {
    return 0;
  }

  const events: Array<{time:number; workout?:WorkoutSessionRecord; recovery?:RecoveryLogRecord}> =
    validWorkouts.map(workout=>({time:Date.parse(workout.date),workout}));
  for(const [key,recovery] of recoveryByDateKey) {
    const [y,m,d]=key.split('-').map(Number);
    const time=new Date(y,m-1,d).getTime();
    if(time<=referenceNow) events.push({time,recovery});
  }
  events.sort((a,b)=>a.time-b.time || (a.recovery ? -1 : 1));
  let runningStrain = 0;
  for(const event of events) {
    if(event.workout) {
      const daysAgo=Math.max(0,(referenceNow-event.time)/ONE_DAY_MS);
      const factor=Math.max(0.15,1-daysAgo*0.14);
      runningStrain=Math.min(100,Math.round(runningStrain*0.65+Math.round(event.workout.fatigueStrainPoints*factor)));
    } else if(event.recovery) {
      const recLog=event.recovery;
      const sleepRatio = Math.min(1.0, (recLog.sleepHours || 0) / 8);
      const subjRatio = Math.min(1.0, Math.max(0.1, (recLog.subjectiveReadiness || 7) / 10));
      const decayAmount = Math.round((sleepRatio * 0.6 + subjRatio * 0.4) * 45);
      runningStrain = Math.max(0, runningStrain - decayAmount);
    }
  }

  return Math.min(100, Math.max(0, runningStrain));
}

/**
 * Calculates weighted Recovery Score (0–100%):
 * Combines Sleep (40%), HRV (30% when provided, else redistributed to Sleep & Subjective),
 * Subjective Feeling (30%), offset by residual acute fatigue.
 */
export function calculateRecoveryScore(
  input: RecoveryInput & { precomputedResidualStrain?: number }
): {
  score: number;
  readinessStatus: ReadinessStatus;
  recoveryDeficit: boolean;
  deloadOverride: boolean;
  reason: string;
  residualStrain: number;
} {
  const sleepRatio = Math.min(1.0, Math.max(0, input.sleepHours) / Math.max(6, input.targetSleepHours || 8));
  const sleepScore = Math.round(sleepRatio * 100);
  const subjectiveScore = Math.min(100, Math.max(10, (input.subjectiveReadiness || 7) * 10));

  const hasMeasuredHrv = typeof input.hrvMs === 'number' && input.hrvMs > 0;
  const hrvScore = hasMeasuredHrv
    ? Math.min(100, Math.round(((input.hrvMs as number) / 65) * 100))
    : Math.round(0.55 * sleepScore + 0.45 * subjectiveScore);

  let residualStrain: number;
  if (typeof input.precomputedResidualStrain === 'number') {
    residualStrain = input.precomputedResidualStrain;
  } else {
    const currentAcute = input.acuteFatigueStrain ?? input.recentStrainIndex ?? 0;
    const decayAmount = Math.round((sleepRatio * 0.6 + (subjectiveScore / 100) * 0.4) * 45);
    residualStrain = Math.max(0, currentAcute - decayAmount);
  }

  const fatiguePenalty = Math.round((residualStrain / 100) * 20);

  const compositeScore = Math.max(
    15,
    Math.min(100, Math.round(0.4 * sleepScore + 0.3 * hrvScore + 0.3 * subjectiveScore - fatiguePenalty))
  );

  let readinessStatus: ReadinessStatus = 'OPTIMAL';
  let recoveryDeficit = false;
  let deloadOverride = false;
  let reason = 'Well rested and ready for a full workout.';

  // Only trigger ACWR spike override when ACWR is calibrated by sufficient multi-week history
  const isCalibratedHighACWR =
    input.acwrIsCalibrated !== false &&
    input.acwrStatus !== 'CALIBRATING' &&
    typeof input.acwrRatio === 'number' &&
    input.acwrRatio > 1.4;

  if (compositeScore < 45 || isCalibratedHighACWR) {
    readinessStatus = 'CRITICAL_RECOVERY';
    recoveryDeficit = true;
    deloadOverride = true;
    reason = isCalibratedHighACWR
      ? `Calibrated training volume spiked (ACWR ${input.acwrRatio} > 1.4). A light recovery day is recommended.`
      : 'High fatigue and low recovery score detected. A light recovery day is recommended.';
  } else if (compositeScore < 70) {
    readinessStatus = 'FATIGUED';
    recoveryDeficit = true;
    if (residualStrain > 65) {
      deloadOverride = true;
      reason = 'High residual workout fatigue. Consider lighter weights or fewer sets today.';
    } else {
      reason = 'Moderate fatigue. A normal or slightly lighter workout is recommended.';
    }
  } else if (compositeScore < 85) {
    readinessStatus = 'MODERATE';
    reason = 'Good energy levels. Ready for your regular workout.';
  }

  const proteinRatio = input.todayProteinGrams / Math.max(1, input.targetProteinGrams || 150);
  if (proteinRatio < 0.6 && residualStrain > 50) {
    recoveryDeficit = true;
  }

  return {
    score: compositeScore,
    readinessStatus,
    recoveryDeficit,
    deloadOverride,
    reason,
    residualStrain,
  };
}

/**
 * Derives complete ReadinessMetrics deterministically from accepted workout history
 * and dated recovery logs (used on workout add/edit/delete and recovery updates).
 */
export function deriveReadinessFromHistory(
  workoutHistory: WorkoutSessionRecord[],
  recoveryLogs: RecoveryLogRecord[],
  nutrition: { todayProteinGrams: number; targetProteinGrams: number; targetSleepHours: number },
  acwrInfo?: { ratio: number; status: ACWRStatus; isCalibrated?: boolean },
  referenceNow: number = Date.now()
): ReadinessMetrics {
  const todayKey = getLocalDateString(new Date(referenceNow));
  const todayRecovery = (recoveryLogs || []).find(
    (r) => (r.dateKey || getLocalDateString(new Date(r.date))) === todayKey
  );
  const latestRecovery = todayRecovery || (recoveryLogs || [])[0];

  const residualStrain = computeDatedResidualStrain(workoutHistory, recoveryLogs, referenceNow);
  const acwrRatio = acwrInfo?.ratio ?? 1.0;
  const acwrStatus: ACWRStatus = acwrInfo?.status ?? 'CALIBRATING';
  const acwrIsCalibrated = acwrInfo?.isCalibrated ?? false;

  if (latestRecovery) {
    const calc = calculateRecoveryScore({
      sleepHours: latestRecovery.sleepHours,
      targetSleepHours: nutrition.targetSleepHours || 8,
      subjectiveReadiness: latestRecovery.subjectiveReadiness,
      hrvMs: latestRecovery.hrvMs,
      todayProteinGrams: nutrition.todayProteinGrams,
      targetProteinGrams: nutrition.targetProteinGrams || 150,
      recentStrainIndex: residualStrain,
      acuteFatigueStrain: residualStrain,
      acwrRatio,
      acwrStatus,
      acwrIsCalibrated,
      precomputedResidualStrain: residualStrain,
    });

    return {
      score: calc.score,
      status: calc.readinessStatus,
      isCalibrated: Boolean(todayRecovery),
      fatigueIndex: residualStrain,
      acuteFatigueStrain: residualStrain,
      sleepHoursLastNight: todayRecovery ? todayRecovery.sleepHours : latestRecovery.sleepHours,
      hrvMs: latestRecovery.hrvMs,
      recoveryDeficit: calc.recoveryDeficit,
      deloadRecommended: calc.deloadOverride,
      acwrRatio,
      acwrStatus,
      acwrIsCalibrated,
      readinessExplanation: calc.reason,
      lastAssessmentTimestamp: new Date(referenceNow).toISOString(),
    };
  }

  // No recovery observation logged yet: compute baseline readiness purely from residual workout strain
  const strainImpact = Math.round(residualStrain * 0.35);
  const score = Math.max(25, 100 - strainImpact);
  const isCalibratedHighACWR = acwrIsCalibrated && acwrRatio > 1.4;

  let status: ReadinessStatus = 'OPTIMAL';
  let deloadRecommended = false;

  if (score < 45 || residualStrain > 80 || isCalibratedHighACWR) {
    status = 'CRITICAL_RECOVERY';
    deloadRecommended = true;
  } else if (score < 70 || residualStrain > 60) {
    status = 'FATIGUED';
    if (residualStrain > 75) deloadRecommended = true;
  } else if (score < 85) {
    status = 'MODERATE';
  }

  const readinessExplanation =
    residualStrain > 0
      ? `Estimated from recent workout strain (${residualStrain}/100). Log sleep and recovery to calibrate today's readiness.`
      : 'Baseline readiness estimate (no sleep/HRV check-in logged today).';

  return {
    score,
    status,
    isCalibrated: false,
    fatigueIndex: residualStrain,
    acuteFatigueStrain: residualStrain,
    sleepHoursLastNight: 0,
    hrvMs: undefined,
    recoveryDeficit: status === 'FATIGUED' || status === 'CRITICAL_RECOVERY',
    deloadRecommended,
    acwrRatio,
    acwrStatus,
    acwrIsCalibrated,
    readinessExplanation,
    lastAssessmentTimestamp: new Date(referenceNow).toISOString(),
  };
}

/**
 * Legacy helper maintained for compatibility; delegates to calibrated ACWR rules.
 */
export function applyWorkoutStrainToReadiness(
  currentReadiness: ReadinessMetrics,
  workoutStrainPoints: number,
  acwrInfo?: { ratio: number; status: ACWRStatus; isCalibrated?: boolean }
): ReadinessMetrics {
  const previousStrain = currentReadiness.acuteFatigueStrain ?? currentReadiness.fatigueIndex ?? 0;
  const newAcuteStrain = Math.min(100, Math.round(previousStrain * 0.6 + workoutStrainPoints));
  const strainImpact = Math.round(workoutStrainPoints * 0.35);
  const newScore = Math.max(25, currentReadiness.score - strainImpact);

  let status: ReadinessStatus = 'OPTIMAL';
  let deloadRecommended = false;

  const acwrRatio = acwrInfo?.ratio ?? currentReadiness.acwrRatio ?? 1.0;
  const acwrStatus = acwrInfo?.status ?? currentReadiness.acwrStatus ?? 'CALIBRATING';
  const acwrIsCalibrated =
    acwrInfo?.isCalibrated ?? currentReadiness.acwrIsCalibrated ?? acwrStatus !== 'CALIBRATING';
  const isCalibratedHighACWR = acwrIsCalibrated && acwrRatio > 1.4;

  if (newScore < 45 || newAcuteStrain > 80 || isCalibratedHighACWR) {
    status = 'CRITICAL_RECOVERY';
    deloadRecommended = true;
  } else if (newScore < 70 || newAcuteStrain > 60) {
    status = 'FATIGUED';
    if (newAcuteStrain > 75) deloadRecommended = true;
  } else if (newScore < 85) {
    status = 'MODERATE';
  }

  const readinessExplanation = deloadRecommended
    ? `Your workout added +${workoutStrainPoints} fatigue points (Total fatigue: ${newAcuteStrain}/100). A light recovery day is recommended next.`
    : `Your workout added +${workoutStrainPoints} fatigue points. Readiness is now ${newScore}/100. Good sleep and protein will help you recharge.`;

  return {
    score: newScore,
    status,
    isCalibrated: currentReadiness.isCalibrated,
    fatigueIndex: newAcuteStrain,
    acuteFatigueStrain: newAcuteStrain,
    sleepHoursLastNight: currentReadiness.sleepHoursLastNight,
    hrvMs: currentReadiness.hrvMs,
    recoveryDeficit: status === 'FATIGUED' || status === 'CRITICAL_RECOVERY',
    deloadRecommended,
    acwrRatio,
    acwrStatus,
    acwrIsCalibrated,
    readinessExplanation,
    lastAssessmentTimestamp: new Date().toISOString(),
  };
}

/**
 * Builds full nutrition and recovery state snapshot after recovery data entry.
 * Replaces existing observation for the same calendar dateKey (idempotent!)
 * rather than stacking duplicate physiological recovery intervals.
 */
export function buildNutritionRecoverySnapshot(
  input: RecoveryInput,
  existingLogs: RecoveryLogRecord[] = [],
  workoutHistory: WorkoutSessionRecord[] = [],
  existingDailyNutrition: Record<string, DailyNutritionRecord> = {},
  referenceDate: Date = new Date()
): {
  metrics: ReadinessMetrics;
  nutrition: NutritionRecoveryState;
  newRecord: RecoveryLogRecord;
} {
  const todayKey = getLocalDateString(referenceDate);
  const existingToday = existingLogs.find(
    (r) => (r.dateKey || getLocalDateString(new Date(r.date))) === todayKey
  );

  // Build candidate record for todayKey (replacing any previous record from todayKey)
  const draftRecord: RecoveryLogRecord = {
    id: existingToday ? existingToday.id : `rec-${todayKey}-${referenceDate.getTime()}`,
    dateKey: todayKey,
    source: 'MANUAL_SELF_REPORTED',
    date: referenceDate.toISOString(),
    sleepHours: input.sleepHours,
    hrvMs: input.hrvMs,
    subjectiveReadiness: input.subjectiveReadiness,
    proteinGrams: input.todayProteinGrams,
    computedScore: 100,
    strainAtLog: 0,
    status: existingToday ? 'CORRECTED' : 'COMPLETED',
  };

  // Deduplicate by dateKey so today has exactly one canonical recovery observation
  const otherDayLogs = existingLogs.filter(
    (r) => (r.dateKey || getLocalDateString(new Date(r.date))) !== todayKey
  );
  const candidateLogs = [draftRecord, ...otherDayLogs].slice(0, 30);

  // Deterministically compute residual strain from dated workouts + deduplicated dated recovery logs
  const precomputedResidualStrain =
    workoutHistory.length > 0
      ? computeDatedResidualStrain(workoutHistory, candidateLogs, referenceDate.getTime())
      : (() => {
          // Fallback if caller didn't pass workoutHistory: use strainAtLog before today's first save
          const baseStrainBeforeToday = existingToday
            ? existingToday.strainAtLog +
              Math.round(
                (Math.min(1.0, existingToday.sleepHours / Math.max(6, input.targetSleepHours || 8)) * 0.6 +
                  (Math.min(100, Math.max(10, existingToday.subjectiveReadiness * 10)) / 100) * 0.4) *
                  45
              )
            : input.acuteFatigueStrain ?? input.recentStrainIndex ?? 0;
          const sleepRatio = Math.min(1.0, input.sleepHours / Math.max(6, input.targetSleepHours || 8));
          const subjRatio = Math.min(1.0, Math.max(0.1, input.subjectiveReadiness / 10));
          const decayAmount = Math.round((sleepRatio * 0.6 + subjRatio * 0.4) * 45);
          return Math.max(0, Math.min(100, baseStrainBeforeToday - decayAmount));
        })();

  const result = calculateRecoveryScore({
    ...input,
    precomputedResidualStrain,
  });

  const newRecord: RecoveryLogRecord = {
    ...draftRecord,
    computedScore: result.score,
    strainAtLog: result.residualStrain,
  };

  const updatedLogs = [newRecord, ...otherDayLogs].slice(0, 30);

  const proteinAdherencePct = Math.min(
    100,
    Math.round((Math.max(0, input.todayProteinGrams) / Math.max(1, input.targetProteinGrams || 150)) * 100)
  );

  const prevHydration = existingDailyNutrition[todayKey]?.hydrationMl || 0;
  const updatedDailyNutrition: Record<string, DailyNutritionRecord> = {
    ...existingDailyNutrition,
    [todayKey]: {
      dateKey: todayKey,
      proteinGrams: Math.max(0, input.todayProteinGrams),
      hydrationMl: prevHydration,
      updatedAt: referenceDate.toISOString(),
    },
  };

  const acwrIsCalibrated = input.acwrIsCalibrated ?? input.acwrStatus !== 'CALIBRATING';

  const metrics: ReadinessMetrics = {
    score: result.score,
    status: result.readinessStatus,
    isCalibrated: true,
    fatigueIndex: result.residualStrain,
    acuteFatigueStrain: result.residualStrain,
    sleepHoursLastNight: input.sleepHours,
    hrvMs: input.hrvMs,
    recoveryDeficit: result.recoveryDeficit,
    deloadRecommended: result.deloadOverride,
    acwrRatio: input.acwrRatio ?? 1.0,
    acwrStatus: input.acwrStatus ?? 'CALIBRATING',
    acwrIsCalibrated,
    readinessExplanation: result.reason,
    lastAssessmentTimestamp: referenceDate.toISOString(),
  };

  const nutrition: NutritionRecoveryState = {
    proteinAdherencePct,
    todayProteinGrams: Math.max(0, input.todayProteinGrams),
    targetProteinGrams: input.targetProteinGrams,
    todayHydrationMl: prevHydration,
    sleepHoursLastNight: input.sleepHours,
    targetSleepHours: input.targetSleepHours,
    recoveryScore: result.score,
    recoveryDeficit: result.recoveryDeficit,
    recentLogs: updatedLogs,
    dailyNutritionLogs: updatedDailyNutrition,
  };

  return {
    metrics,
    nutrition,
    newRecord,
  };
}
