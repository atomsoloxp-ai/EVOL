// Validate untrusted storage and activity at the boundary, before running engines.
type Check = (value: any) => boolean;
const record: Check = v => !!v && typeof v === 'object' && !Array.isArray(v);
const str: Check = v => typeof v === 'string';
const num: Check = v => typeof v === 'number' && Number.isFinite(v);
const nonnegative: Check = v => num(v) && v >= 0;
const bool: Check = v => typeof v === 'boolean';
const list = (check: Check): Check => v => Array.isArray(v) && v.every(check);
const dictionary = (check: Check): Check => v => record(v) && Object.values(v).every(check);
const optionalShape = (fields: Record<string, Check>): Check => v => record(v) && Object.entries(fields).every(([key, check]) => v[key] === undefined || check(v[key]));
const required = (fields: Record<string, Check>): Check => v => record(v) && Object.entries(fields).every(([key, check]) => check(v[key]));
const oneOf = (...values: unknown[]): Check => v => values.includes(v);
const date: Check = v => str(v) && Number.isFinite(Date.parse(v));
const day: Check = v => str(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && date(v);
const fullStats = required({strength:nonnegative,endurance:nonnegative,discipline:nonnegative,recovery:nonnegative});
const stats = optionalShape({ strength: nonnegative, endurance: nonnegative, discipline: nonnegative, recovery: nonnegative });
const set = (v: any) => required({ weightKg: nonnegative, reps: v => nonnegative(v) && Number.isInteger(v) })(v) && optionalShape({ rpe: v => num(v) && v >= 1 && v <= 10, confirmed: bool, isWarmup: bool })(v);
const exercise: Check = v => required({ exerciseId: str, exerciseName: str, muscleGroup: oneOf('CHEST','BACK','LEGS','SHOULDERS','ARMS','CORE','CARDIO'), sets: list(set) })(v) && optionalShape({notes:str})(v);
const pr = required({ exerciseName: str, oneRepMaxKg: nonnegative, achievedAt: str });
const workout: Check = v => required({ id: str, name: str, date, durationMinutes: v => num(v) && v > 0, source: oneOf('MANUAL_SELF_REPORTED','ATOM_OS_VERIFIED','SYSTEM_SIMULATION'), exercises: list(exercise), totalTonnageKg: nonnegative, totalSets: nonnegative, fatigueStrainPoints: nonnegative, prsEarned: list(pr), status: oneOf('COMPLETED','CORRECTED','DRAFT') })(v) && Date.parse(v.date) <= Date.now() && optionalShape({notes:str,measuredDurationSeconds:nonnegative,durationEditedReason:str,assignedQuestId:str,version: v => Number.isInteger(v) && v > 0, memberId: str, gymId: str})(v);
const recovery: Check = v => required({ id: str, date, sleepHours: nonnegative, subjectiveReadiness: v => num(v) && v >= 1 && v <= 10, proteinGrams: nonnegative })(v) && optionalShape({dateKey:day,hrvMs:nonnegative,computedScore:nonnegative,strainAtLog:nonnegative,notes:str})(v);
const calendar = required({ date: day, checkedIn: bool, recoveryXpAwarded: bool, workoutsCount: nonnegative, workoutXpAwardedCount: nonnegative, questsClaimedIds: list(str), totalXpEarnedToday: nonnegative, streakCountAtDay: nonnegative });
const grant: Check = v => required({ grantId: str, sourceId: str, cause: oneOf('WORKOUT','CHECK_IN','QUEST_CLAIM','RECOVERY_LOG','GATE_CLEAR','STREAK_MILESTONE'), timestamp: date, dateKey: day, personalXp: nonnegative, gymXp: nonnegative, workoutCountDelta: nonnegative, statPoints: fullStats })(v) && optionalShape({gymId:str,gateId:str,gateMaxHp:nonnegative,gateRewardXp:nonnegative,gateTitle:str,rewardStreakDays:nonnegative,bossDamage:nonnegative,revokedAt:date,notes:str})(v);
const plannedExercise: Check = v => required({ exerciseName: str, muscleGroup: str, targetSets: nonnegative, targetRepRange: v => Array.isArray(v) && v.length === 2 && v.every(nonnegative), rpeTarget: nonnegative, restSeconds: nonnegative })(v) && optionalShape({exerciseId:str,suggestedWeightKg:nonnegative,isBodyweight:bool,isCalibrationEstimate:bool,substitutionReason:str,progressionAction:str,progressionReason:str})(v);
const plan: Check = v => required({ sessionName: str, focus: str, plannedDurationMinutes: nonnegative, targetTonnageKg: nonnegative, rationale: str, exercises: list(plannedExercise), adjustmentNotes: list(str), updatedAt: date })(v) && optionalShape({planId:str,version:nonnegative,dateKey:day,scheduleStatus:str,unknownLimitations:list(str)})(v);
const quest: Check = v => required({ id: str, dateAssigned: day, title: str, category: oneOf('MAIN_QUEST','SIDE_QUEST','PENALTY_QUEST','DUNGEON_GATE'), status: oneOf('IN_PROGRESS','OBJECTIVES_MET','CLAIMED','EXPIRED'), requirements: list(required({description: str, targetCount: nonnegative, currentCount: nonnegative, unit: str})), rewards: v => required({xp: nonnegative})(v) && optionalShape({statPoints:stats,itemReward:str,badge:str})(v) })(v) && optionalShape({subTitle:str,isDeloadOrRecovery:bool,requiredForDailyClear:bool,deadlineHoursRemaining:nonnegative,expiresAt:date,claimedAt:date,penaltyWarning:str,injuryFilteredWarning:str,assignedSessionName:str,prescriptionVersion:nonnegative})(v);
const gate = required({id:str, name:str, bossName:str, bossMaxHp:nonnegative, bossCurrentHp:nonnegative, cleared:bool, rewards:required({xp:nonnegative,title:str,item:str})});

export function isValidPersistedState(v: unknown): boolean {
  return record(v) && Boolean((v as any).profile || (v as any).rpg || (v as any).training) && optionalShape({
    currentDayKey: day,
    profile: p => required({id:str})(p) && optionalShape({name:str, hunterTitle:str, avatarId:str, avatarUrl:str, gender:oneOf('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY'),fitnessGoal:oneOf('MUSCLE_GAIN','STRENGTH','FAT_LOSS','ENDURANCE'),experienceLevel:oneOf('BEGINNER','INTERMEDIATE','ADVANCED'), availableEquipment:oneOf('FULL_GYM','HOME_GYM','BARBELL_DUMBBELL','DUMBBELL_ONLY','BODYWEIGHT_CABLES'),ageYears:nonnegative,currentWeightKg:nonnegative,heightCm:nonnegative,activityMultiplier:nonnegative,targetWeightKg:nonnegative,bodyFatPct:nonnegative,muscleMassKg:nonnegative,targetProteinGrams:nonnegative,preferredSessionDurationMinutes:nonnegative,daysAvailablePerWeek:nonnegative,preferredTrainingDays:list(x=>Number.isInteger(x)&&x>=0&&x<=6),activeLimitations:list(str),measurementHistory:list(required({id:str,date,weightKg:nonnegative})),onboardingCompleted:bool,gymId:str,gymName:str,squadName:str})(p),
    rpg: optionalShape({xp:nonnegative,level:nonnegative,currentLevelBaseXp:nonnegative,nextLevelXp:nonnegative,hunterRank:str,unallocatedStatPoints:nonnegative,stats,statAllocations:list(oneOf('strength','endurance','discipline','recovery')),streakDays:nonnegative,trainingStreakDays:nonnegative,lastActiveDate:str,lastStreakDate:str,lastCheckInDate:str,longestStreak:nonnegative,streakFreezeActive:bool,activityCalendar:dictionary(calendar),grantLedger:dictionary(grant),personalProgress:optionalShape({totalXp:nonnegative,lifetimeWorkouts:nonnegative,achievementsUnlocked:list(str),claimedRewardsHistory:list(required({questId:str,claimedAt:date,xpEarned:nonnegative}))}),gymContext:optionalShape({localGymId:str,localGymName:str,localGymXp:nonnegative,facilityRank:v=>v===null||nonnegative(v),squadRank:v=>v===null||nonnegative(v),squadName:str,isDemoScenario:bool,archivedFacilities:list(required({gymId:str,gymName:str,localGymXp:nonnegative,archivedAt:date}))})}),
    training:optionalShape({volumeTrend:oneOf('UP','STABLE','DOWN'),weeklyTonnageKg:nonnegative,rollingVolume7dKg:nonnegative,rollingVolume28dKg:nonnegative,plateauDetected:bool,acwr:optionalShape({ratio:nonnegative,status:oneOf('CALIBRATING','OPTIMAL','UNDERTRAINING','OVERTRAINING_RISK'),isCalibrated:bool,sessionsCount28d:nonnegative,historySpanDays:nonnegative,recommendation:str}),workoutHistory:list(workout),historicalPRs:dictionary(pr),recentPRs:list(pr),muscleGroupVolumes:dictionary(nonnegative),exerciseTrends:dictionary(required({last1RM:nonnegative,trend:oneOf('UP','STABLE','DOWN')}))}),
    nutrition:optionalShape({sleepHoursLastNight:nonnegative,recoveryScore:nonnegative,recoveryDeficit:bool,todayProteinGrams:nonnegative,todayHydrationMl:nonnegative,targetProteinGrams:nonnegative,targetSleepHours:nonnegative,proteinAdherencePct:nonnegative,recentLogs:list(recovery),dailyNutritionLogs:dictionary(required({dateKey:day,proteinGrams:nonnegative,hydrationMl:nonnegative,updatedAt:date}))}),
    readiness:optionalShape({status:oneOf('OPTIMAL','MODERATE','FATIGUED','CRITICAL_RECOVERY'),isCalibrated:bool,recoveryDeficit:bool,deloadRecommended:bool,acwrStatus:oneOf('CALIBRATING','OPTIMAL','UNDERTRAINING','OVERTRAINING_RISK'),acwrIsCalibrated:bool,readinessExplanation:str,lastAssessmentTimestamp:str,score:nonnegative,fatigueIndex:nonnegative,acuteFatigueStrain:nonnegative,sleepHoursLastNight:nonnegative,hrvMs:nonnegative,acwrRatio:nonnegative}),
    quests:list(quest), dungeonGate:gate, assignedSessionPlan:v=>v===null||plan(v),
    activeWorkoutTimer:v=>v===null||required({questId:str,elapsedMs:nonnegative,isRunning:bool,isPaused:bool})(v)&&optionalShape({startedAt:nonnegative,pausedAt:nonnegative})(v),
    processedEventIds:list(str),recentWorkoutHistory:list(required({id:str,name:str,date:str,tonnageKg:nonnegative,sets:nonnegative,prsEarned:nonnegative})),
  })(v);
}

export function validateWorkoutInput(v: any, now = Date.now()): string | null {
  if (!record(v) || !str(v.name) || !num(v.durationMinutes) || v.durationMinutes < 1 || v.durationMinutes > 1440) return 'Enter a finite workout duration between 1 and 1440 minutes.';
  if (v.date !== undefined && (!date(v.date) || Date.parse(v.date) > now)) return 'Workout occurrence time must be valid and cannot be in the future.';
  if (v.version !== undefined && (!Number.isInteger(v.version) || v.version < 1)) return 'Workout version must be a positive integer.';
  if (!Array.isArray(v.exercises) || !v.exercises.every(exercise)) return 'Workout sets require valid exercises, finite nonnegative weights, whole repetitions and RPE between 1 and 10.';
  if (v.id !== undefined && (!str(v.id) || !v.id.trim())) return 'Workout ID must be a nonempty string.';
  if (!optionalShape({notes:str,memberId:str,gymId:str,measuredDurationSeconds:nonnegative,durationEditedReason:str})(v)) return 'Workout metadata has invalid values.';
  if (v.source !== undefined && !oneOf('MANUAL_SELF_REPORTED','ATOM_OS_VERIFIED','SYSTEM_SIMULATION')(v.source)) return 'Unknown activity source.';
  return null;
}
