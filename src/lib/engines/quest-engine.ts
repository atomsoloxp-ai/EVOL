// Module 6: Quest & Coaching Engine (EVOL.md Section 4 & 5)

import { CurrentMemberState } from '../../types/member-state';
import { SystemQuest, SystemCoachMessage, QuestStatus, QuestRequirement } from '../../types/rpg';
import { getLocalDateString } from './streak-engine';

/**
 * Gets the standardized daily key (YYYY-MM-DD) in the user's local timezone.
 */
export function getDailyDateKey(date: Date = new Date()): string {
  return getLocalDateString(date);
}

/**
 * Returns the end-of-day ISO timestamp and remaining hours for a given local date key.
 */
export function getDayDeadlineInfo(todayKey: string, referenceNow: Date = new Date()): {
  expiresAt: string;
  deadlineHoursRemaining: number;
} {
  const [y, m, d] = todayKey.split('-').map(Number);
  const endOfDay = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
  const diffMs = Math.max(0, endOfDay.getTime() - referenceNow.getTime());
  const deadlineHoursRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
  return {
    expiresAt: endOfDay.toISOString(),
    deadlineHoursRemaining,
  };
}

/**
 * Calculates current day's logged physical activity totals using a single canonical local date policy.
 * Avoids matching both UTC prefix and local date so an instant near UTC midnight never counts toward two days.
 */
export function getTodayActivityTotals(state: CurrentMemberState, todayKey: string) {
  let todaySets = 0;
  let todayTonnage = 0;
  let todayDurationMinutes = 0;

  for (const session of state.trainingProgress.workoutHistory || []) {
    if (!session.date) continue;
    const sessionLocalKey = getLocalDateString(new Date(session.date));
    if (sessionLocalKey === todayKey) {
      todaySets += session.totalSets;
      todayTonnage += session.totalTonnageKg;
      todayDurationMinutes += session.durationMinutes || 0;
    }
  }

  const todayRecoveryLog = (state.nutritionRecovery.recentLogs || []).find((log) => {
    const logLocalKey = log.dateKey || (log.date ? getLocalDateString(new Date(log.date)) : '');
    return logLocalKey === todayKey;
  });

  const todayNutritionRecord = state.nutritionRecovery.dailyNutritionLogs?.[todayKey];
  const todayProteinGrams =
    todayNutritionRecord !== undefined
      ? todayNutritionRecord.proteinGrams
      : todayRecoveryLog
      ? todayRecoveryLog.proteinGrams
      : state.nutritionRecovery.todayProteinGrams;
  const todayHydrationMl =
    todayNutritionRecord !== undefined
      ? todayNutritionRecord.hydrationMl
      : state.nutritionRecovery.todayHydrationMl || 0;

  return {
    todaySets,
    todayTonnage,
    todayDurationMinutes,
    todayRecoveryLog,
    todayProteinGrams,
    todayHydrationMl,
  };
}

/**
 * Updates requirement progress strictly by semantic metricType (never transferring counts across incompatible types).
 */
function updateRequirementsByMetricType(
  requirements: QuestRequirement[],
  totals: {
    todaySets: number;
    todayTonnage: number;
    todayDurationMinutes: number;
    todayProteinGrams: number;
    todayHydrationMl: number;
    todaySleepHours: number;
  }
): QuestRequirement[] {
  return requirements.map((req) => {
    const metric = req.metricType;
    let currentCount = req.currentCount;

    if (metric === 'WORKING_SETS' || req.unit === 'sets') {
      currentCount = totals.todaySets;
    } else if (metric === 'TONNAGE_KG' || req.unit === 'kg') {
      currentCount = totals.todayTonnage;
    } else if (metric === 'DURATION_MINUTES' || req.unit === 'min') {
      currentCount = totals.todayDurationMinutes;
    } else if (metric === 'PROTEIN_GRAMS' || req.unit === 'g') {
      currentCount = totals.todayProteinGrams;
    } else if (metric === 'HYDRATION_ML' || req.unit === 'ml') {
      currentCount = totals.todayHydrationMl;
    } else if (metric === 'SLEEP_HOURS' || req.unit === 'h') {
      currentCount = totals.todaySleepHours;
    }

    return {
      ...req,
      currentCount: Math.max(0, currentCount),
    };
  });
}

/**
 * Computes quest status from current requirement satisfaction.
 * Fixes Finding 6: If a quest is unclaimed and underlying data is corrected below target,
 * status MUST revert from OBJECTIVES_MET back to IN_PROGRESS!
 */
export function computeQuestStatus(
  existingStatus: QuestStatus | undefined,
  requirements: QuestRequirement[]
): QuestStatus {
  if (existingStatus === 'CLAIMED') return 'CLAIMED';
  if (existingStatus === 'EXPIRED') return 'EXPIRED';
  const allMet = requirements.length > 0 && requirements.every((r) => r.currentCount >= r.targetCount);
  return allMet ? 'OBJECTIVES_MET' : 'IN_PROGRESS';
}

/**
 * Generates or reconciles dynamic system quests tailored strictly to the CurrentMemberState.
 * Fixes Finding 5: Once today's Main Quest is assigned for `todayKey`, its prescription
 * (title, objective types, target sets/tonnage, and deload flag) is FROZEN for today so
 * completing a workout does not mutate today's Main Quest into a different quest!
 */
export function generateSystemQuests(
  state: CurrentMemberState,
  existingQuests: SystemQuest[] = [],
  options: { forceRegenerateMainPrescription?: boolean; referenceDate?: Date } = {}
): SystemQuest[] {
  const refDate = options.referenceDate || new Date();
  const todayKey = getDailyDateKey(refDate);
  const { expiresAt, deadlineHoursRemaining } = getDayDeadlineInfo(todayKey, refDate);
  const {
    todaySets,
    todayTonnage,
    todayDurationMinutes,
    todayRecoveryLog,
    todayProteinGrams,
    todayHydrationMl,
  } = getTodayActivityTotals(state, todayKey);

  // Use frozen assignedSessionPlan if available, else nextSessionPlan
  const plan = state.assignedSessionPlan || state.nextSessionPlan;
  const isDeload =
    state.immediatePriorities.includes('DELOAD_REQUIRED') || plan?.focus === 'ACTIVE_DELOAD';

  const existingMap = new Map<string, SystemQuest>();
  const retainedPenaltyQuests: SystemQuest[] = [];

  for (const q of existingQuests) {
    if (q.category === 'PENALTY_QUEST' && q.status !== 'CLAIMED') {
      retainedPenaltyQuests.push(q);
    } else if (q.dateAssigned === todayKey) {
      existingMap.set(q.id, q);
    }
  }

  const todaySleepHours = todayRecoveryLog ? todayRecoveryLog.sleepHours : 0;

  const totals = {
    todaySets,
    todayTonnage,
    todayDurationMinutes,
    todayProteinGrams,
    todayHydrationMl,
    todaySleepHours,
  };

  const quests: SystemQuest[] = [...retainedPenaltyQuests];

  // ==========================================
  // 1. MAIN QUEST (Frozen Daily Prescription)
  // ==========================================
  const mainQuestId = `quest-main-${todayKey}`;
  const existingMain = existingMap.get(mainQuestId);

  if (existingMain && !options.forceRegenerateMainPrescription) {
    // Freeze today's assigned Main Quest prescription! Only update requirement progress by metricType.
    const updatedReqs = updateRequirementsByMetricType(existingMain.requirements, totals);
    const status = computeQuestStatus(existingMain.status, updatedReqs);

    quests.push({
      ...existingMain,
      requirements: updatedReqs,
      status,
      expiresAt,
      deadlineHoursRemaining,
    });
  } else if (isDeload) {
    const plannedDeloadSets = plan?.exercises.reduce((acc, ex) => acc + ex.targetSets, 0) || 8;
    const req1Target = 15;
    const req2Target = plannedDeloadSets;

    const requirements: QuestRequirement[] = [
      {
        id: 'req-deload-duration',
        metricType: 'DURATION_MINUTES',
        description: 'Mobility & Recovery Duration',
        targetCount: req1Target,
        currentCount: todayDurationMinutes,
        unit: 'min',
      },
      {
        id: 'req-deload-sets',
        metricType: 'WORKING_SETS',
        description: 'Light Recovery Sets',
        targetCount: req2Target,
        currentCount: todaySets,
        unit: 'sets',
      },
    ];

    const status = computeQuestStatus(existingMain?.status, requirements);

    quests.push({
      id: mainQuestId,
      dateAssigned: todayKey,
      prescriptionVersion: (existingMain?.prescriptionVersion || 0) + 1,
      assignedSessionName: plan?.sessionName || 'Active Recovery & Mobility',
      title: plan?.sessionName || 'Active Recovery & Mobility',
      subTitle: `${req2Target} light sets • Recovery day`,
      category: 'MAIN_QUEST',
      isDeloadOrRecovery: true,
      requiredForDailyClear: true,
      requirements,
      rewards: {
        xp: 180,
        statPoints: { recovery: 3, discipline: 2 },
        itemReward: 'Recovery Badge',
      },
      status,
      claimedAt: existingMain?.claimedAt,
      expiresAt,
      deadlineHoursRemaining,
    });
  } else {
    const plannedSets = plan?.exercises.reduce((acc, ex) => acc + ex.targetSets, 0) || 13;
    const plannedTonnage = plan?.targetTonnageKg ?? 2500;

    const focusLabelMap: Record<string, string> = {
      HYPERSTROPHY: 'Muscle Gain',
      MUSCLE_GAIN: 'Muscle Gain',
      STRENGTH: 'Strength',
      FAT_LOSS: 'Fat Loss',
      METABOLIC_CONDITIONING: 'Conditioning',
      ENDURANCE: 'Endurance',
      ACTIVE_DELOAD: 'Recovery',
    };
    const readableFocus =
      focusLabelMap[plan?.focus || state.profileSummary.fitnessGoal] || 'Training';

    const requirements: QuestRequirement[] = [
      {
        id: 'req-main-sets',
        metricType: 'WORKING_SETS',
        description: 'Working Sets',
        targetCount: plannedSets,
        currentCount: todaySets,
        unit: 'sets',
      },
    ];

    if (plannedTonnage > 0) {
      requirements.push({
        id: 'req-main-tonnage',
        metricType: 'TONNAGE_KG',
        description: 'Total Weight',
        targetCount: plannedTonnage,
        currentCount: todayTonnage,
        unit: 'kg',
      });
    }

    const status = computeQuestStatus(existingMain?.status, requirements);

    quests.push({
      id: mainQuestId,
      dateAssigned: todayKey,
      prescriptionVersion: (existingMain?.prescriptionVersion || 0) + 1,
      assignedSessionName: plan?.sessionName || 'Daily Workout',
      title: plan?.sessionName || 'Daily Workout',
      subTitle: `${plannedSets} sets • ${readableFocus}`,
      category: 'MAIN_QUEST',
      isDeloadOrRecovery: false,
      requiredForDailyClear: true,
      requirements,
      rewards: {
        xp: 320,
        statPoints: { strength: 4, endurance: 2, discipline: 2 },
        itemReward: 'Strength Badge',
      },
      status,
      claimedAt: existingMain?.claimedAt,
      expiresAt,
      deadlineHoursRemaining,
    });
  }

  // ==========================================
  // 2. SIDE QUEST: Nutrition Target (Protein)
  // ==========================================
  const proteinQuestId = `quest-side-protein-${todayKey}`;
  const existingProtein = existingMap.get(proteinQuestId);
  const targetProtein = state.nutritionRecovery.targetProteinGrams || 150;

  const proteinReqs: QuestRequirement[] = [
    {
      id: 'req-side-protein',
      metricType: 'PROTEIN_GRAMS',
      description: 'Protein',
      targetCount: targetProtein,
      currentCount: Math.max(0, todayProteinGrams),
      unit: 'g',
    },
  ];
  const proteinStatus = computeQuestStatus(existingProtein?.status, proteinReqs);

  quests.push({
    id: proteinQuestId,
    dateAssigned: todayKey,
    title: 'Protein',
    subTitle: `Target: ${targetProtein}g`,
    category: 'SIDE_QUEST',
    isDeloadOrRecovery: false,
    requiredForDailyClear: false,
    requirements: proteinReqs,
    rewards: {
      xp: 120,
      statPoints: { discipline: 1, recovery: 2 },
      badge: 'Nutrition Pro',
    },
    status: proteinStatus,
    claimedAt: existingProtein?.claimedAt,
    expiresAt,
    deadlineHoursRemaining,
  });

  // ==========================================
  // 3. SIDE QUEST: Hydration
  // ==========================================
  const hydrationQuestId = `quest-side-hydration-${todayKey}`;
  const existingHydration = existingMap.get(hydrationQuestId);
  const hydrationTarget = 3500;
  const hydrationCurrent = Math.max(
    todayHydrationMl,
    existingHydration?.requirements[0]?.currentCount || 0
  );

  const hydrationReqs: QuestRequirement[] = [
    {
      id: 'req-side-hydration',
      metricType: 'HYDRATION_ML',
      description: 'Water',
      targetCount: hydrationTarget,
      currentCount: hydrationCurrent,
      unit: 'ml',
    },
  ];
  const hydrationStatus = computeQuestStatus(existingHydration?.status, hydrationReqs);

  quests.push({
    id: hydrationQuestId,
    dateAssigned: todayKey,
    title: 'Water',
    subTitle: 'Target: 3.5L',
    category: 'SIDE_QUEST',
    isDeloadOrRecovery: false,
    requiredForDailyClear: false,
    requirements: hydrationReqs,
    rewards: {
      xp: 90,
      statPoints: { recovery: 1 },
    },
    status: hydrationStatus,
    claimedAt: existingHydration?.claimedAt,
    expiresAt,
    deadlineHoursRemaining,
  });

  // ==========================================
  // 4. SIDE QUEST: Quality Sleep
  // ==========================================
  const sleepQuestId = `quest-side-sleep-${todayKey}`;
  const existingSleep = existingMap.get(sleepQuestId);
  const targetSleep = state.nutritionRecovery.targetSleepHours || 8;

  const sleepReqs: QuestRequirement[] = [
    {
      id: 'req-side-sleep',
      metricType: 'SLEEP_HOURS',
      description: 'Sleep',
      targetCount: targetSleep,
      currentCount: todaySleepHours,
      unit: 'h',
    },
  ];
  const sleepStatus = computeQuestStatus(existingSleep?.status, sleepReqs);

  quests.push({
    id: sleepQuestId,
    dateAssigned: todayKey,
    title: 'Sleep',
    subTitle: `Target: ${targetSleep}h`,
    category: 'SIDE_QUEST',
    isDeloadOrRecovery: true,
    requiredForDailyClear: false,
    requirements: sleepReqs,
    rewards: {
      xp: 140,
      statPoints: { recovery: 3 },
      badge: 'Well Rested',
    },
    status: sleepStatus,
    claimedAt: existingSleep?.claimedAt,
    expiresAt,
    deadlineHoursRemaining,
  });

  return quests;
}

/**
 * Reconciles quest requirement progress with current state without mutating today's frozen Main Quest prescription.
 */
export function reconcileQuestsWithState(
  currentQuests: SystemQuest[],
  state: CurrentMemberState,
  options: { forceRegenerateMainPrescription?: boolean; referenceDate?: Date } = {}
): SystemQuest[] {
  return generateSystemQuests(state, currentQuests, options);
}

/**
 * Generates contextual natural language AI Coach feedback strictly grounded in CurrentMemberState
 * and dynamically responsive to the member's submitted question.
 */
export function generateSystemCoachResponse(
  state: CurrentMemberState,
  persona: 'SYSTEM_ADMIN' | 'SHADOW_BERU' | 'ARCHITECT' = 'SYSTEM_ADMIN',
  userPrompt?: string
): SystemCoachMessage {
  const readiness = state.readiness;
  const plan = state.nextSessionPlan;
  const assigned = state.assignedSessionPlan || plan;
  const promptLower = (userPrompt || '').toLowerCase();

  let text = '';

  if (promptLower.includes('readiness') || promptLower.includes('fatigue') || promptLower.includes('rest')) {
    const calibrationNote = readiness.isCalibrated
      ? 'Calibrated from today’s recovery check-in.'
      : 'Uncalibrated baseline estimate (log today’s sleep & recovery to calibrate).';
    text = `Readiness: ${readiness.score}/100 • Fatigue: ${readiness.fatigueIndex}/100. ${calibrationNote} ${
      readiness.deloadRecommended ? 'A light recovery day is recommended.' : 'Ready for your planned session.'
    }`;
  } else if (promptLower.includes('plan') || promptLower.includes('next') || promptLower.includes('workout') || promptLower.includes('train')) {
    const exList = plan?.exercises
      .map(
        (e) =>
          `${e.exerciseName} (${e.targetSets}×${e.targetRepRange[0]}-${e.targetRepRange[1]}${
            e.suggestedWeightKg ? ` @${e.suggestedWeightKg}kg` : ' bodyweight'
          })`
      )
      .join(', ');
    text = `Assigned Today: ${assigned?.sessionName}. Next Recommended Plan: ${plan?.sessionName} (${plan?.targetTonnageKg?.toLocaleString()} kg target). Exercises: ${exList}.`;
  } else if (promptLower.includes('injury') || promptLower.includes('shoulder') || promptLower.includes('back') || promptLower.includes('limit')) {
    const notes = plan?.adjustmentNotes || [];
    text = notes.length
      ? `Active adjustments: ${notes.join('; ')}.`
      : 'No injury restrictions configured — standard exercise catalog active.';
  } else if (promptLower.includes('protein') || promptLower.includes('diet') || promptLower.includes('nutrition') || promptLower.includes('food')) {
    const nut = state.nutritionRecovery;
    text = `Protein: ${nut.todayProteinGrams}g / ${nut.targetProteinGrams}g (${nut.proteinAdherencePct}%). ${
      nut.proteinAdherencePct < 75 ? 'Add a high-protein meal or shake today to hit your target.' : 'On track!'
    }`;
  } else if (promptLower.includes('boss') || promptLower.includes('gate') || promptLower.includes('dungeon') || promptLower.includes('challenge')) {
    text = `Every 1 kg of external weight you lift in confirmed workouts counts toward your weekly volume challenge.`;
  } else {
    if (readiness.status === 'CRITICAL_RECOVERY' || readiness.deloadRecommended) {
      text = `Readiness is ${readiness.score}% (Fatigue: ${readiness.fatigueIndex}/100). Next recommended session is Light Recovery & Mobility.`;
    } else {
      text = `Readiness ${readiness.score}%${
        readiness.isCalibrated ? '' : ' (baseline estimate)'
      } • Assigned workout: ${assigned?.sessionName}.`;
    }
  }

  return {
    id: `coach-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    sender: 'SYSTEM',
    persona,
    content: text,
    userPrompt,
  };
}
