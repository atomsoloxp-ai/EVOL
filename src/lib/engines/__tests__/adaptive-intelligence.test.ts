import { describe, it, expect, beforeEach } from 'vitest';
import { useEvolStore, CLEAN_NEW_PROFILE, CLEAN_NEW_READINESS, CLEAN_NEW_TRAINING } from '../../storage/persistent-store';
import { planNextSession, recalculateHistoricalMetrics } from '../training-engine';
import { findCatalogExercise, isExerciseCompatible } from '../body-intelligence';
import { applyProgressionUpdate } from '../rpg-engine';
import { eventBus } from '../../events/event-bus';

describe('EVOL Adaptive Intelligence Audit Regression Suite', () => {
  beforeEach(() => {
    useEvolStore.getState().resetToNewUser();
  });

  it('Finding 1: Finishing workout timer does not invent completed sets, PRs, or XP until confirmed', () => {
    const store = useEvolStore.getState();
    const mainQuest = store.quests.find((q) => q.category === 'MAIN_QUEST')!;
    expect(mainQuest).toBeDefined();

    store.startWorkoutTimer(mainQuest.id);
    const review = useEvolStore.getState().finishWorkoutTimerForReview(mainQuest.id);

    expect(review).not.toBeNull();
    // Immediately after finishing timer, 0 workouts, 0 PRs, and 0 XP must be recorded
    const afterFinish = useEvolStore.getState();
    expect(afterFinish.training.workoutHistory.length).toBe(0);
    expect(afterFinish.rpg.xp).toBe(0);
    expect(afterFinish.rpg.personalProgress.lifetimeWorkouts).toBe(0);
    expect(Object.keys(afterFinish.training.historicalPRs).length).toBe(0);

    // Attempting to submit review with 0 confirmed sets logs nothing
    afterFinish.submitTimerWorkoutReview({
      name: review!.sessionName,
      durationMinutes: 5,
      exercises: review!.exercises, // all sets have confirmed: false
    });
    expect(useEvolStore.getState().training.workoutHistory.length).toBe(0);
    expect(useEvolStore.getState().rpg.xp).toBe(0);

    // Confirming a partial session (only 1 set of the first exercise) records strictly that 1 set
    const partialExercises = review!.exercises.map((ex, eIdx) => ({
      ...ex,
      sets: ex.sets.map((s, sIdx) => ({
        ...s,
        weightKg: 40,
        reps: 8,
        confirmed: eIdx === 0 && sIdx === 0,
      })),
    }));

    useEvolStore.getState().submitTimerWorkoutReview({
      name: 'Partial Confirmed Session',
      durationMinutes: 15,
      exercises: partialExercises,
    });

    const afterPartial = useEvolStore.getState();
    expect(afterPartial.training.workoutHistory.length).toBe(1);
    expect(afterPartial.training.workoutHistory[0].totalSets).toBe(1);
    expect(afterPartial.training.workoutHistory[0].totalTonnageKg).toBe(320);
  });

  it('Finding 2: First modest workout (200 kg) stays in CALIBRATING ACWR and does not trigger deload/recovery mode', () => {
    const store = useEvolStore.getState();
    store.logWorkout({
      name: 'First small workout',
      durationMinutes: 20,
      exercises: [
        {
          exerciseId: 'barbell_incline_bench',
          exerciseName: 'Barbell Bench Press',
          muscleGroup: 'CHEST',
          sets: [{ weightKg: 20, reps: 10, rpe: 7.5 }],
        },
      ],
    });

    const updated = useEvolStore.getState();
    expect(updated.training.acwr.status).toBe('CALIBRATING');
    expect(updated.training.acwr.isCalibrated).toBe(false);
    expect(updated.training.acwr.ratio).toBe(1.0); // Never 4.0 on cold start!
    expect(updated.readiness.deloadRecommended).toBe(false);

    const synthesized = updated.getSynthesizedState();
    expect(synthesized.immediatePriorities).not.toContain('DELOAD_REQUIRED');
    expect(synthesized.nextSessionPlan.focus).not.toBe('ACTIVE_DELOAD');
    expect(synthesized.nextSessionPlan.sessionName).not.toBe('Light Recovery & Mobility Session');
  });

  it('Finding 3: Repeated identical recovery saves are idempotent and quick protein does not decay workout strain', () => {
    const store = useEvolStore.getState();
    // Log a heavy workout to generate significant strain
    store.logWorkout({
      name: 'Heavy Session',
      durationMinutes: 60,
      exercises: [
        {
          exerciseId: 'barbell_back_squat',
          exerciseName: 'Barbell Back Squat',
          muscleGroup: 'LEGS',
          sets: [
            { weightKg: 100, reps: 10, rpe: 9 },
            { weightKg: 100, reps: 10, rpe: 9 },
            { weightKg: 100, reps: 10, rpe: 9 },
            { weightKg: 100, reps: 10, rpe: 9 },
          ],
        },
      ],
    });

    const strainBeforeRecovery = useEvolStore.getState().readiness.acuteFatigueStrain;
    expect(strainBeforeRecovery).toBeGreaterThan(20);

    // Quick protein logging must not change workout fatigue strain or fabricate sleep
    useEvolStore.getState().logQuickProtein(50);
    expect(useEvolStore.getState().readiness.acuteFatigueStrain).toBe(strainBeforeRecovery);
    expect(useEvolStore.getState().nutrition.todayProteinGrams).toBe(50);

    // Save recovery check-in 3 times with identical inputs
    const recInput = {
      sleepHours: 7.5,
      subjectiveReadiness: 8,
      hrvMs: 65,
      proteinGrams: 120,
    };

    useEvolStore.getState().logRecovery(recInput);
    const firstScore = useEvolStore.getState().readiness.score;
    const firstStrain = useEvolStore.getState().readiness.acuteFatigueStrain;
    const xpAfterFirstRecovery = useEvolStore.getState().rpg.xp;

    useEvolStore.getState().logRecovery(recInput);
    const secondScore = useEvolStore.getState().readiness.score;
    const secondStrain = useEvolStore.getState().readiness.acuteFatigueStrain;

    useEvolStore.getState().logRecovery(recInput);
    const thirdScore = useEvolStore.getState().readiness.score;
    const thirdStrain = useEvolStore.getState().readiness.acuteFatigueStrain;

    expect(secondScore).toBe(firstScore);
    expect(thirdScore).toBe(firstScore);
    expect(secondStrain).toBe(firstStrain);
    expect(thirdStrain).toBe(firstStrain);
    // Recovery XP (+75) must only be granted once per calendar day
    expect(useEvolStore.getState().rpg.xp).toBe(xpAfterFirstRecovery);
  });

  it('Finding 4: Renaming a workout has zero metric impact; editing down or deleting updates PRs, XP, fatigue, and tonnage', () => {
    const store = useEvolStore.getState();
    store.logWorkout({
      name: 'Initial Bench Session',
      durationMinutes: 30,
      exercises: [
        {
          exerciseId: 'barbell_incline_bench',
          exerciseName: 'Barbell Bench Press',
          muscleGroup: 'CHEST',
          sets: [{ weightKg: 80, reps: 5, rpe: 8 }],
        },
      ],
    });

    const afterCreate = useEvolStore.getState();
    const sessionId = afterCreate.training.workoutHistory[0].id;
    const readinessBeforeRename = afterCreate.readiness.score;
    const strainBeforeRename = afterCreate.readiness.acuteFatigueStrain;
    const xpBeforeRename = afterCreate.rpg.xp;

    // 1. Name-only edit must have zero metric impact
    afterCreate.editWorkout(sessionId, { name: 'Renamed Bench Session' });
    const afterRename = useEvolStore.getState();
    expect(afterRename.readiness.score).toBe(readinessBeforeRename);
    expect(afterRename.readiness.acuteFatigueStrain).toBe(strainBeforeRename);
    expect(afterRename.rpg.xp).toBe(xpBeforeRename);

    // 2. Editing a former PR weight down must lower the historical PR (not keep old max as permanent truth)
    afterRename.editWorkout(sessionId, {
      exercises: [
        {
          exerciseId: 'barbell_incline_bench',
          exerciseName: 'Barbell Bench Press',
          muscleGroup: 'CHEST',
          sets: [{ weightKg: 40, reps: 5, rpe: 7 }],
        },
      ],
    });
    const afterWeightDown = useEvolStore.getState();
    expect(afterWeightDown.training.historicalPRs['Barbell Bench Press'].oneRepMaxKg).toBe(47);

    // 3. Deleting the workout removes history, PRs, XP, lifetimeWorkouts, weeklyTonnageKg, and fatigue strain
    afterWeightDown.deleteWorkout(sessionId);
    const afterDelete = useEvolStore.getState();
    expect(afterDelete.training.workoutHistory.length).toBe(0);
    expect(Object.keys(afterDelete.training.historicalPRs)).toHaveLength(0);
    expect(afterDelete.training.weeklyTonnageKg).toBe(0);
    expect(afterDelete.rpg.xp).toBe(0);
    expect(afterDelete.rpg.personalProgress.lifetimeWorkouts).toBe(0);
    expect(afterDelete.readiness.score).toBe(100);
    expect(afterDelete.readiness.acuteFatigueStrain).toBe(0);
  });

  it('Finding 5: Completing the assigned workout meets that assignment without mutating today’s quest into a recovery quest', () => {
    const store = useEvolStore.getState();
    const initialMainQuest = store.quests.find((q) => q.category === 'MAIN_QUEST')!;
    const assignedTitle = initialMainQuest.title;
    const assignedPlan = store.assignedSessionPlan!;

    // Complete all prescribed exercises and sets from today's assigned plan
    store.logWorkout({
      name: assignedPlan.sessionName,
      durationMinutes: assignedPlan.plannedDurationMinutes,
      exercises: assignedPlan.exercises.map((pe) => ({
        exerciseId: pe.exerciseId,
        exerciseName: pe.exerciseName,
        muscleGroup: pe.muscleGroup,
        sets: Array.from({ length: pe.targetSets }, () => ({
          weightKg: pe.isBodyweight ? 0 : pe.suggestedWeightKg || 30,
          reps: pe.targetRepRange[0],
          rpe: pe.rpeTarget,
        })),
      })),
    });

    const afterWorkout = useEvolStore.getState();
    const updatedMainQuest = afterWorkout.quests.find((q) => q.category === 'MAIN_QUEST')!;

    expect(updatedMainQuest.id).toBe(initialMainQuest.id);
    expect(updatedMainQuest.title).toBe(assignedTitle);
    expect(updatedMainQuest.isDeloadOrRecovery).toBe(false);
    expect(updatedMainQuest.status).toBe('OBJECTIVES_MET');
  });

  it('Finding 6: Correcting an unclaimed quest below target reverts OBJECTIVES_MET to IN_PROGRESS and blocks claiming', () => {
    const store = useEvolStore.getState();
    // Log 200g protein -> exceeds 150g target -> OBJECTIVES_MET
    store.logRecovery({
      sleepHours: 7.5,
      subjectiveReadiness: 8,
      proteinGrams: 200,
    });

    const proteinQuestId = useEvolStore
      .getState()
      .quests.find((q) => q.id.includes('quest-side-protein'))!.id;
    expect(
      useEvolStore.getState().quests.find((q) => q.id === proteinQuestId)!.status
    ).toBe('OBJECTIVES_MET');

    const xpBeforeCorrection = useEvolStore.getState().rpg.xp;

    // Correct protein intake down to 0g
    useEvolStore.getState().logRecovery({
      sleepHours: 7.5,
      subjectiveReadiness: 8,
      proteinGrams: 0,
    });

    const correctedQuest = useEvolStore
      .getState()
      .quests.find((q) => q.id === proteinQuestId)!;
    expect(correctedQuest.requirements[0].currentCount).toBe(0);
    expect(correctedQuest.status).toBe('IN_PROGRESS');

    // Attempt to claim after correction must fail and grant 0 XP
    useEvolStore.getState().claimQuest(proteinQuestId);
    expect(
      useEvolStore.getState().quests.find((q) => q.id === proteinQuestId)!.status
    ).toBe('IN_PROGRESS');
    expect(useEvolStore.getState().rpg.xp).toBe(xpBeforeCorrection);
  });

  it('Finding 7: Separates check-in XP from lifetimeWorkouts, preserves explicit 0 gym XP, and grants gate clear rewards', () => {
    const store = useEvolStore.getState();
    store.simulateCheckIn();

    const afterCheckIn = useEvolStore.getState();
    expect(afterCheckIn.rpg.xp).toBe(50);
    expect(afterCheckIn.rpg.personalProgress.lifetimeWorkouts).toBe(0);

    // Explicit 0 gymXpBonus must not fall back to personal XP
    const prog = applyProgressionUpdate(afterCheckIn.rpg, 100, { recovery: 2 }, 0, {
      cause: 'RECOVERY_LOG',
      workoutCountDelta: 0,
    });
    expect(prog.updatedState.gymContext.localGymXp).toBe(afterCheckIn.rpg.gymContext.localGymXp);

    // Clearing the 2,000 kg Dungeon Gate grants both Workout XP and the +200 Gate Clear XP
    const xpBeforeBossKill = useEvolStore.getState().rpg.xp;
    useEvolStore.getState().logWorkout({
      name: 'Gate Breaker Session',
      durationMinutes: 45,
      exercises: [
        {
          exerciseId: 'barbell_back_squat',
          exerciseName: 'Barbell Back Squat',
          muscleGroup: 'LEGS',
          sets: [
            { weightKg: 100, reps: 10, rpe: 8 },
            { weightKg: 100, reps: 10, rpe: 8 },
          ],
        },
      ],
    });

    const afterBossKill = useEvolStore.getState();
    expect(afterBossKill.dungeonGate.cleared).toBe(true);
    expect(afterBossKill.dungeonGate.rewardGranted).toBe(true);
    expect(afterBossKill.rpg.personalProgress.lifetimeWorkouts).toBe(1);
    // Workout XP + 200 Gate Clear XP
    const gateGrant = afterBossKill.rpg.grantLedger?.[`gate-clear-${afterBossKill.dungeonGate.id}`];
    expect(gateGrant).toBeDefined();
    expect(gateGrant?.personalXp).toBe(200);
    expect(afterBossKill.rpg.xp).toBeGreaterThan(xpBeforeBossKill + 200);
  });

  it('Finding 8: Enforces real equipment and limitation constraints without prescribing machines or borrowing PRs', () => {
    const machineNames = ['Leg Press', 'Lying Hamstring Curl', 'Lat Pulldown', 'Cable Lateral Raise', 'Tricep Rope Pushdown'];

    for (const equip of ['DUMBBELL_ONLY', 'HOME_GYM', 'BARBELL_DUMBBELL'] as const) {
      const plan = planNextSession(
        { ...CLEAN_NEW_PROFILE, availableEquipment: equip },
        CLEAN_NEW_READINESS,
        CLEAN_NEW_TRAINING
      );
      for (const ex of plan.exercises) {
        expect(machineNames).not.toContain(ex.exerciseName);
        const cat = findCatalogExercise(ex.exerciseId)!;
        expect(cat).toBeDefined();
        const check = isExerciseCompatible(cat, equip, []);
        expect(check.compatible).toBe(true);
        if (cat.isBodyweight) {
          expect(ex.suggestedWeightKg).toBeUndefined();
        }
      }
    }

    // Lower-back limitation excludes Barbell Back Squat, Romanian Deadlift, and Conventional Deadlift
    // and never borrows Barbell Back Squat's 200kg PR for the substitute exercise
    const backPlan = planNextSession(
      {
        ...CLEAN_NEW_PROFILE,
        availableEquipment: 'FULL_GYM',
        activeLimitations: ['LOWER_BACK_DISC_HERNIATION'],
      },
      CLEAN_NEW_READINESS,
      {
        ...CLEAN_NEW_TRAINING,
        historicalPRs: {
          'Barbell Back Squat': {
            exerciseId: 'barbell_back_squat',
            exerciseName: 'Barbell Back Squat',
            oneRepMaxKg: 200,
            weightKg: 170,
            reps: 5,
            achievedAt: new Date().toISOString(),
          },
        },
      }
    );

    const backExNames = backPlan.exercises.map((e) => e.exerciseName);
    expect(backExNames).not.toContain('Barbell Back Squat');
    expect(backExNames).not.toContain('Romanian Deadlift');
    expect(backExNames).not.toContain('Conventional Deadlift');

    const firstSub = backPlan.exercises[0];
    // Substitute must not inherit 72% of Barbell Back Squat's 200kg 1RM (144kg)
    expect(firstSub.suggestedWeightKg).not.toBe(144);
  });

  it('Finding 11 & 13: Verified workout ingestion does not recurse, deduplicates IDs, filters memberId, and onboarding syncs protein target', () => {
    const store = useEvolStore.getState();
    store.completeOnboarding({
      name: 'Audit Athlete',
      currentWeightKg: 72,
      heightCm: 175,
      ageYears: 24,
      gender: 'MALE',
      fitnessGoal: 'MUSCLE_GAIN',
    });

    const afterOnboarding = useEvolStore.getState();
    const expectedProtein = afterOnboarding.profile.targetProteinGrams;
    expect(afterOnboarding.nutrition.targetProteinGrams).toBe(expectedProtein);
    const proteinQuest = afterOnboarding.quests.find((q) => q.id.includes('quest-side-protein'))!;
    expect(proteinQuest.requirements[0].targetCount).toBe(expectedProtein);

    // Verified event emission must process exactly once without infinite recursion
    let emissionCount = 0;
    const unsubscribe = eventBus.subscribe(() => {
      emissionCount++;
    });

    const verifiedDate = '2026-11-20T10:00:00.000Z';
    eventBus.emit({
      eventId: 'ext-evt-1',
      type: 'WORKOUT_COMPLETED',
      timestamp: verifiedDate,
      gymId: 'facility-local',
      memberId: afterOnboarding.profile.id,
      workout: {
        id: 'verified-session-101',
        source: 'ATOM_OS_VERIFIED',
        name: 'Verified Import Session',
        date: verifiedDate,
        durationMinutes: 40,
        exercises: [
          {
            exerciseId: 'chest_supported_row',
            exerciseName: 'Chest-Supported Row',
            muscleGroup: 'BACK',
            sets: [{ weightKg: 50, reps: 10, rpe: 8 }],
          },
        ],
        totalTonnageKg: 500,
        totalSets: 1,
        fatigueStrainPoints: 10,
        prsEarned: [],
        status: 'COMPLETED',
      },
    });

    unsubscribe();

    const afterVerified = useEvolStore.getState();
    expect(afterVerified.training.workoutHistory.length).toBe(1);
    expect(afterVerified.training.workoutHistory[0].id).toBe('verified-session-101');
    expect(afterVerified.training.workoutHistory[0].date).toBe(verifiedDate);
    // 1 inbound emission + 1 post-commit outbound notification = 2 total bus emissions (no recursion!)
    expect(emissionCount).toBe(2);

    // Duplicate delivery of the same verified session is ignored
    afterVerified.processActivity({
      eventId: 'ext-evt-1',
      type: 'WORKOUT_COMPLETED',
      timestamp: verifiedDate,
      gymId: 'facility-local',
      memberId: afterOnboarding.profile.id,
      workout: afterVerified.training.workoutHistory[0],
    });
    expect(useEvolStore.getState().training.workoutHistory.length).toBe(1);

    // Event for a different memberId is rejected
    afterVerified.processActivity({
      eventId: 'ext-evt-other-member',
      type: 'WORKOUT_COMPLETED',
      timestamp: verifiedDate,
      gymId: 'facility-local',
      memberId: 'different-member-999',
      workout: {
        ...afterVerified.training.workoutHistory[0],
        id: 'other-member-session',
      },
    });
    expect(useEvolStore.getState().training.workoutHistory.length).toBe(1);
  });

  it('Finding 9, 10, 12, 15: Date rollover resets daily nutrition, storage import validates schema, plateau adjusts plan, and facility switch preserves personal progress', () => {
    const store = useEvolStore.getState();
    store.logQuickProtein(140);
    expect(useEvolStore.getState().nutrition.todayProteinGrams).toBe(140);

    // Simulate midnight rollover to tomorrow
    const tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000);
    useEvolStore.getState().refreshDailyStateIfNeeded(tomorrow);
    expect(useEvolStore.getState().nutrition.todayProteinGrams).toBe(0);

    // Corrupted JSON import is rejected safely with a visible storage warning
    const ok = useEvolStore.getState().importStateJson('{corrupted-json');
    expect(ok).toBe(false);
    expect(useEvolStore.getState().storageWarning).toContain('malformed JSON');

    // Facility switch preserves personal XP/Level while archiving previous facility XP
    useEvolStore.getState().simulateCheckIn();
    const personalXpBeforeSwitch = useEvolStore.getState().rpg.xp;
    const oldFacilityXp = useEvolStore.getState().rpg.gymContext.localGymXp;
    expect(oldFacilityXp).toBeGreaterThan(0);

    useEvolStore.getState().switchGymFacility('facility-beta', 'Beta Iron Gym', 'Beta Squad');
    const afterSwitch = useEvolStore.getState();
    expect(afterSwitch.rpg.xp).toBe(personalXpBeforeSwitch);
    expect(afterSwitch.rpg.gymContext.localGymId).toBe('facility-beta');
    expect(afterSwitch.rpg.gymContext.localGymXp).toBe(0);
    expect(afterSwitch.rpg.gymContext.facilityRank).toBeNull();
    expect(afterSwitch.rpg.gymContext.archivedFacilities?.[0].localGymXp).toBe(oldFacilityXp);

    // Plateau response shifts rep targets and adds stimulus sets
    const normalPlan = planNextSession(
      CLEAN_NEW_PROFILE,
      CLEAN_NEW_READINESS,
      { ...CLEAN_NEW_TRAINING, plateauDetected: false }
    );
    const plateauPlan = planNextSession(
      CLEAN_NEW_PROFILE,
      CLEAN_NEW_READINESS,
      { ...CLEAN_NEW_TRAINING, plateauDetected: true }
    );
    const normalTotalSets = normalPlan.exercises.reduce((a, e) => a + e.targetSets, 0);
    const plateauTotalSets = plateauPlan.exercises.reduce((a, e) => a + e.targetSets, 0);
    expect(plateauTotalSets).toBeGreaterThan(normalTotalSets);
    expect(plateauPlan.adjustmentNotes.some((n) => n.toLowerCase().includes('plateau'))).toBe(true);
  });
});
