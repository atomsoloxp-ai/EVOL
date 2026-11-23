import { WorkoutSessionRecord, ExercisePRRecord } from '../../types/events';
import { RPGCharacterState, TrainingProgressState } from '../../types/member-state';
import { DungeonGate, RewardGrantRecord } from '../../types/rpg';
import { analyzeWorkoutProgress, recalculateHistoricalMetrics } from './training-engine';
import { applyProgressionUpdate, calculateWorkoutXp, getStatAllocations } from './rpg-engine';
import { getLocalDateString } from './streak-engine';

const zeroStats = () => ({strength:0,endurance:0,discipline:0,recovery:0});
const keys = ['strength','endurance','discipline','recovery'] as const;
const active = (g: RewardGrantRecord) => !g.revokedAt;

/** Reconcile tracked workout grants chronologically, preserving unrelated/legacy balances. */
export function reconcileWorkoutHistory(
  previous: {rpg:RPGCharacterState; training:TrainingProgressState; dungeonGate:DungeonGate},
  history: WorkoutSessionRecord[]
) {
  const now = new Date().toISOString();
  const oldLedger = previous.rpg.grantLedger || {};
  const ledger: Record<string,RewardGrantRecord> = structuredClone(oldLedger);
  const oldSessions = new Map(previous.training.workoutHistory.map(w=>[w.id,w]));
  const ids = new Set(history.map(w=>w.id));
  for (const g of Object.values(ledger)) {
    if (g.cause === 'WORKOUT' && !ids.has(g.sourceId)) g.revokedAt = now;
  }
  const prs: Record<string,ExercisePRRecord> = {};
  const sessions = [...history].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id)).map(w=>{
    const metrics = analyzeWorkoutProgress(w.exercises,prs,w.date);
    const newPrs = metrics.newPRsDetected.map(p=>({...p,sessionId:w.id}));
    for (const p of newPrs) { prs[p.exerciseName]=p; if(p.exerciseId) prs[p.exerciseId]=p; }
    const g = ledger[`workout-xp-${w.id}`];
    // Existing recorded multipliers are fixed at acceptance; later streak changes cannot alter them.
    if (g && !g.revokedAt) {
      const old = oldSessions.get(w.id) || w;
      const base = calculateWorkoutXp(old.totalTonnageKg,old.totalSets,old.prsEarned.length,0).totalXpEarned;
      const streak = g.rewardStreakDays ?? Math.max(0,Math.min(20,Math.round((g.personalXp / Math.max(1,base)-1)*20)));
      const xp = calculateWorkoutXp(metrics.totalSessionTonnageKg,metrics.setsCount,newPrs.length,streak);
      const rewarded = g.personalXp > 0;
      ledger[g.grantId] = {...g,rewardStreakDays:streak,dateKey:getLocalDateString(new Date(w.date)),timestamp:w.date,
        personalXp:rewarded ? xp.totalXpEarned : 0,gymXp:rewarded ? xp.totalXpEarned : 0,
        statPoints:rewarded ? xp.statPointsEarned : zeroStats(),bossDamage:Math.round(metrics.totalSessionTonnageKg)};
    }
    return {...w,totalTonnageKg:metrics.totalSessionTonnageKg,totalSets:metrics.setsCount,
      fatigueStrainPoints:metrics.fatigueStrainPoints,prsEarned:newPrs};
  });

  // Gate damage belongs to a particular challenge, never whichever challenge is currently open.
  const gate = previous.dungeonGate;
  const gateIds = new Set([gate.id,...Object.values(ledger).filter(g=>g.gateId).map(g=>g.gateId!)]);
  const achievements = new Set(previous.rpg.personalProgress.achievementsUnlocked);
  let updatedGate = {...gate};
  for (const gateId of gateIds) {
    const grants = Object.values(ledger).filter(g=>g.cause==='WORKOUT' && (g.gateId || gate.id)===gateId);
    const sample = grants.find(g=>g.gateMaxHp!==undefined);
    const maxHp = gateId===gate.id ? gate.bossMaxHp : sample?.gateMaxHp;
    if (maxHp===undefined) continue;
    const damage = grants.filter(active).reduce((sum,g)=>sum+(g.bossDamage||0),0);
    const cleared = damage >= maxHp;
    const rewardId = `gate-clear-${gateId}`;
    const reward = ledger[rewardId];
    const title = gateId===gate.id ? gate.rewards.title : sample?.gateTitle;
    if (!cleared && reward) { reward.revokedAt=now; if(title) achievements.delete(title); }
    if (cleared) {
      const xp = gateId===gate.id ? gate.rewards.xp : sample?.gateRewardXp || 0;
      const ordered = grants.filter(active).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
      const completing = ordered[ordered.length-1];
      if(completing) ledger[rewardId] = {...reward,grantId:rewardId,cause:'GATE_CLEAR',sourceId:gateId,
        timestamp:completing.timestamp,dateKey:completing.dateKey,personalXp:xp,gymXp:xp,
        gymId:reward && !reward.revokedAt ? reward.gymId || completing.gymId : completing.gymId,workoutCountDelta:0,statPoints:zeroStats(),revokedAt:undefined};
      if(title) achievements.add(title);
    }
    if(gateId===gate.id) updatedGate={...gate,bossCurrentHp:Math.max(0,maxHp-damage),cleared,rewardGranted:cleared};
  }

  let xpDelta=0;
  const statDelta=zeroStats();
  const gymDeltas:Record<string,number>={};
  const dayDeltas:Record<string,number>={};
  for(const sign of [-1,1]) for(const g of Object.values(sign===-1?oldLedger:ledger).filter(active)) {
    xpDelta+=sign*g.personalXp;
    for(const k of keys) statDelta[k]+=sign*g.statPoints[k];
    const gym=g.gymId || previous.rpg.gymContext.localGymId;
    gymDeltas[gym]=(gymDeltas[gym]||0)+sign*g.gymXp;
    dayDeltas[g.dateKey]=(dayDeltas[g.dateKey]||0)+sign*g.personalXp;
  }
  const calendar=structuredClone(previous.rpg.activityCalendar||{});
  for(const day of new Set([...Object.keys(calendar),...sessions.map(w=>getLocalDateString(new Date(w.date)))])) {
    const entry=calendar[day];
    if(!entry) continue;
    entry.totalXpEarnedToday=Math.max(0,entry.totalXpEarnedToday+(dayDeltas[day]||0));
    entry.workoutsCount=sessions.filter(w=>getLocalDateString(new Date(w.date))===day).length;
    entry.workoutXpAwardedCount=Object.values(ledger).filter(g=>active(g)&&g.cause==='WORKOUT'&&g.dateKey===day&&g.personalXp>0).length;
  }
  const currentGym=previous.rpg.gymContext.localGymId;
  const archives=(previous.rpg.gymContext.archivedFacilities||[]).map(a=>({...a,localGymXp:Math.max(0,a.localGymXp+(gymDeltas[a.gymId]||0))}));
  const rpg=applyProgressionUpdate({...previous.rpg,statAllocations:getStatAllocations(previous.rpg),activityCalendar:calendar,grantLedger:ledger,
    gymContext:{...previous.rpg.gymContext,archivedFacilities:archives},
    personalProgress:{...previous.rpg.personalProgress,achievementsUnlocked:[...achievements]}},
    xpDelta,statDelta,gymDeltas[currentGym]||0,{cause:'CORRECTION',workoutCountDelta:history.length-previous.training.workoutHistory.length}).updatedState;
  const hist=recalculateHistoricalMetrics(sessions);
  const training:TrainingProgressState={...previous.training,workoutHistory:sessions.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)),
    weeklyTonnageKg:hist.rollingVolume7dKg,rollingVolume7dKg:hist.rollingVolume7dKg,rollingVolume28dKg:hist.rollingVolume28dKg,
    acwr:hist.acwr,plateauDetected:hist.plateauDetected,historicalPRs:hist.recomputedHistoricalPRs,
    recentPRs:hist.recomputedRecentPRs,muscleGroupVolumes:hist.muscleGroupVolumes7d,exerciseTrends:hist.exerciseTrends};
  return {rpg,training,dungeonGate:updatedGate};
}
