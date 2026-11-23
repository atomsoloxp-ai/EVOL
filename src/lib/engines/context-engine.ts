// Module 4: Member Context Engine (Central Brain) - EVOL.md Section 4 & 5

import {
  CurrentMemberState,
  HunterProfile,
  ReadinessMetrics,
  NutritionRecoveryState,
  TrainingProgressState,
  RPGCharacterState,
  ImmediatePriority,
} from '../../types/member-state';
import { NextSessionPlan } from '../../types/rpg';
import { planNextSession } from './training-engine';
import { getLocalDateString } from './streak-engine';

/**
 * Synthesizes individual subsystem telemetry into the unified CurrentMemberState JSON snapshot.
 * Recomputed after every relevant change with transparent reasons for all priorities.
 */
export function synthesizeMemberContext(
  profile: HunterProfile,
  readiness: ReadinessMetrics,
  nutrition: NutritionRecoveryState,
  training: TrainingProgressState,
  rpg: RPGCharacterState,
  assignedSessionPlan?: NextSessionPlan | null,
  referenceDate: Date = new Date()
): CurrentMemberState {
  const priorities: ImmediatePriority[] = [];
  const priorityExplanations: Record<string, string> = {};

  const now = referenceDate.getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const todayKey = getLocalDateString(referenceDate);

  // 1. Check input staleness & unmeasured baseline provenance
  const latestRecovery = nutrition.recentLogs?.[0];
  const latestWorkout = training.workoutHistory?.[0];

  const lastRecoveryTime = latestRecovery ? new Date(latestRecovery.date).getTime() : 0;
  const lastWorkoutTime = latestWorkout ? new Date(latestWorkout.date).getTime() : 0;

  const hasTodayRecovery = Boolean(
    latestRecovery &&
      (latestRecovery.dateKey === todayKey ||
        getLocalDateString(new Date(latestRecovery.date)) === todayKey)
  );
  const recoveryStale = !latestRecovery || (!hasTodayRecovery && now - lastRecoveryTime > ONE_DAY_MS);
  const workoutStale = !latestWorkout || now - lastWorkoutTime > 3 * ONE_DAY_MS;
  const unmeasuredBaseline = !latestRecovery;

  if (recoveryStale) {
    priorities.push('INPUT_STALE');
    priorityExplanations['INPUT_STALE'] = unmeasuredBaseline
      ? 'No sleep or recovery check-in logged yet. Readiness uses an uncalibrated baseline estimate.'
      : 'Recovery check-in is older than 24 hours. Log last night’s sleep and energy to calibrate today’s readiness.';
  }

  // 2. Check recovery / deload imperative (only use ACWR ratio when calibrated by multi-week history!)
  const acwrIsCalibrated =
    readiness.acwrIsCalibrated ?? training.acwr?.isCalibrated ?? false;
  const isCalibratedAcwrSpike = acwrIsCalibrated && readiness.acwrRatio > 1.4;

  const isDeload =
    readiness.score < 45 ||
    readiness.deloadRecommended ||
    readiness.fatigueIndex > 75 ||
    isCalibratedAcwrSpike;

  if (isDeload) {
    priorities.push('DELOAD_REQUIRED');
    priorityExplanations['DELOAD_REQUIRED'] = isCalibratedAcwrSpike
      ? `Calibrated ACWR rose to ${readiness.acwrRatio} (>1.4 threshold). Active recovery session recommended to manage training load.`
      : `Readiness score is low (${readiness.score}/100, Fatigue: ${readiness.fatigueIndex}/100). Lighter recovery work is recommended.`;
  }

  // 3. Goal-aware training focus when readiness is adequate
  if (!isDeload && readiness.score >= 60) {
    const confidenceNote = recoveryStale ? ' (estimated from uncalibrated baseline)' : '';
    switch (profile.fitnessGoal) {
      case 'STRENGTH':
        priorities.push('STRENGTH_PEAK');
        priorityExplanations['STRENGTH_PEAK'] =
          `Readiness is ${readiness.score}/100${confidenceNote}. Focused on compound strength progression.`;
        break;
      case 'FAT_LOSS':
        priorities.push('METABOLIC_CONDITIONING');
        priorityExplanations['METABOLIC_CONDITIONING'] =
          `Readiness is ${readiness.score}/100${confidenceNote}. Prioritizing compound density and work-to-rest intervals.`;
        break;
      case 'ENDURANCE':
        priorities.push('WORK_CAPACITY');
        priorityExplanations['WORK_CAPACITY'] =
          `Readiness is ${readiness.score}/100${confidenceNote}. Prioritizing higher-rep stamina and shorter rest periods.`;
        break;
      case 'MUSCLE_GAIN':
      default:
        priorities.push('HYPERSTROPHY');
        priorityExplanations['HYPERSTROPHY'] =
          `Readiness is ${readiness.score}/100${confidenceNote}. Focused on progressive hypertrophy volume.`;
        break;
    }
  }

  // 4. Check protein adherence
  if (nutrition.proteinAdherencePct < 75) {
    priorities.push('PROTEIN_FOCUS');
    priorityExplanations['PROTEIN_FOCUS'] =
      `Protein intake at ${nutrition.todayProteinGrams}g / ${nutrition.targetProteinGrams}g (${nutrition.proteinAdherencePct}%). Log protein meals to reach your daily target.`;
  }

  // 5. Check limitations / mobility
  if (profile.activeLimitations && profile.activeLimitations.length > 0) {
    priorities.push('MOBILITY_RESTORE');
    priorityExplanations['MOBILITY_RESTORE'] =
      `Active movement constraints configured: [${profile.activeLimitations.join(', ')}]. Exercise substitutions applied.`;
  }

  // 6. Streak preservation
  if (rpg.streakDays >= 3) {
    priorities.push('CONSISTENCY_STREAK');
    priorityExplanations['CONSISTENCY_STREAK'] =
      `Active streak: ${rpg.streakDays} consecutive days. Streak multiplier provides bonus XP.`;
  }

  // Generate adaptive next-session plan strictly grounded in member history and constraints
  const nextSessionPlan = planNextSession(profile, readiness, training, referenceDate);

  return {
    memberId: profile.id,
    timestamp: referenceDate.toISOString(),
    profileSummary: {
      fitnessGoal: profile.fitnessGoal,
      experienceLevel: profile.experienceLevel,
      availableEquipment: profile.availableEquipment,
      preferredSessionDurationMinutes: profile.preferredSessionDurationMinutes,
      preferredTrainingDays: profile.preferredTrainingDays,
      daysAvailablePerWeek: profile.daysAvailablePerWeek,
      activeLimitations: profile.activeLimitations,
    },
    readiness,
    nutritionRecovery: nutrition,
    trainingProgress: training,
    rpgState: rpg,
    immediatePriorities: priorities,
    priorityExplanations,
    inputStaleness: {
      recoveryStale,
      workoutStale,
      unmeasuredBaseline,
      lastRecoveryDate: latestRecovery?.date,
      lastWorkoutDate: latestWorkout?.date,
      message: unmeasuredBaseline
        ? 'No recovery check-in logged yet (using baseline estimate)'
        : recoveryStale
        ? 'Recovery check-in older than 24h'
        : undefined,
    },
    assignedSessionPlan: assignedSessionPlan || undefined,
    nextSessionPlan,
  };
}
