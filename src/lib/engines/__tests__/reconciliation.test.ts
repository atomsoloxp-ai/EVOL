import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {useEvolStore as store} from '../../storage/persistent-store';
import {isValidPersistedState} from '../../storage/validation';
import {computeDatedResidualStrain} from '../recovery-engine';
import {WorkoutExercise,WorkoutSessionRecord,RecoveryLogRecord} from '../../../types/events';

const exercises=(weight=20):WorkoutExercise[]=>[{exerciseId:'barbell_incline_bench',exerciseName:'Barbell Incline Bench Press',muscleGroup:'CHEST',sets:[{weightKg:weight,reps:10,rpe:7}]}];
const log=(id:string,weight=20)=>store.getState().logWorkout({id,name:'Bench',durationMinutes:20,exercises:exercises(weight)});
const snap=()=>structuredClone(store.getState().rpg);
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-23T12:00:00Z'));store.getState().resetToNewUser();});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('accepted records and correction regressions',()=>{
  it('rejects nested-invalid imports atomically and round-trips a valid populated snapshot',()=>{
    log('one');
    const before=snap();
    const invalid=[{profile:{id:'bad'},rpg:{xp:42,stats:null}},
      {profile:{id:'bad'},training:{workoutHistory:[{date:new Date().toISOString(),totalSets:1,totalTonnageKg:10,exercises:null}]}},
      {profile:{id:'bad'},nutrition:{recentLogs:[null]}},
      {profile:{id:'bad'},quests:[{id:'q',requirements:null}]},
      {profile:{id:'bad'},rpg:{activityCalendar:{today:null}}}];
    for(const fixture of invalid) {
      expect(isValidPersistedState(fixture)).toBe(false);
      expect(store.getState().importStateJson(JSON.stringify(fixture))).toBe(false);
      expect(store.getState().rpg).toEqual(before);
    }
    const raw=store.getState().exportStateJson();
    expect(isValidPersistedState(JSON.parse(raw))).toBe(true);
    expect(store.getState().importStateJson(raw)).toBe(true);
    expect(store.getState().rpg.xp).toBe(before.xp);
    expect(()=>store.getState().simulateCheckIn()).not.toThrow();
  });

  it('boots safely with a backed-up invalid nested localStorage record',async()=>{
    const raw=JSON.stringify({profile:{id:'broken'},training:{workoutHistory:[{date:new Date().toISOString(),totalSets:1,totalTonnageKg:10,exercises:null}]}});
    const data=new Map([['evol_progression_store_v3',raw]]);
    vi.stubGlobal('window',{});
    vi.stubGlobal('localStorage',{getItem:(key:string)=>data.get(key)||null,setItem:(key:string,value:string)=>data.set(key,value)});
    vi.resetModules();
    const fresh=await import('../../storage/persistent-store');
    expect(fresh.useEvolStore.getState().training.workoutHistory).toEqual([]);
    expect(fresh.useEvolStore.getState().storageWarning).toContain('invalid schema');
    expect(data.get('evol_corrupted_backup')).toBe(raw);
    expect(data.get('evol_progression_store_v3')).toBe(raw);
  });

  it('renaming any past PR session preserves XP, stats and calendar after later PRs',()=>{
    log('early',20);vi.advanceTimersByTime(1000);log('later',40);
    const before=snap();
    store.getState().editWorkout('early',{name:'Only renamed'});
    expect(store.getState().rpg).toEqual(before);
    expect(store.getState().rpg.xp).toBe(409);
    const record=store.getState().training.workoutHistory.find(w=>w.id==='early')!;
    expect(record.name).toBe('Only renamed');
    expect(record.prsEarned).toHaveLength(1);
  });

  it('reconciles gate reward and permits exactly one legitimate re-clear after correction',()=>{
    log('clear',250);
    expect(store.getState().dungeonGate.cleared).toBe(true);
    store.getState().editWorkout('clear',{exercises:exercises(20)});
    expect(store.getState().rpg.xp).toBe(197);
    expect(store.getState().dungeonGate.cleared).toBe(false);
    expect(store.getState().rpg.personalProgress.achievementsUnlocked).not.toContain('First Challenge Complete');
    expect(store.getState().rpg.grantLedger!['gate-clear-gate-e-01'].revokedAt).toBeDefined();
    store.getState().editWorkout('clear',{exercises:exercises(250)});
    const xp=store.getState().rpg.xp;
    expect(store.getState().rpg.grantLedger!['gate-clear-gate-e-01'].revokedAt).toBeUndefined();
    store.getState().editWorkout('clear',{name:'Renamed after re-clear'});
    expect(store.getState().rpg.xp).toBe(xp);
    store.getState().deleteWorkout('clear');
    expect(store.getState().rpg.xp).toBe(0);
    expect(store.getState().dungeonGate.bossCurrentHp).toBe(2000);
  });

  it('never applies old gate damage to a newly reset gate',()=>{
    log('old',250);vi.advanceTimersByTime(1000);store.getState().resetGateBoss();
    const gate=structuredClone(store.getState().dungeonGate);
    store.getState().deleteWorkout('old');
    expect(store.getState().dungeonGate).toEqual({...gate,cleared:false,rewardGranted:false});
    expect(store.getState().rpg.xp).toBe(0);
  });

  it('revokes spent level-up allocations and cannot farm stats across repeated cycles',()=>{
    for(let i=0;i<5;i++)store.getState().allocateStat('strength');
    for(let cycle=0;cycle<3;cycle++) {
      log('farm-'+cycle,250);
      while(store.getState().rpg.unallocatedStatPoints>0)store.getState().allocateStat('strength');
      store.getState().deleteWorkout('farm-'+cycle);
      expect(store.getState().rpg.xp).toBe(0);
      expect(store.getState().rpg.stats.strength).toBe(15);
      expect(store.getState().rpg.unallocatedStatPoints).toBe(0);
      expect(store.getState().rpg.statAllocations).toHaveLength(5);
    }
  });

  it('routes old workout and gate correction deltas to the originating gym',()=>{
    log('gym-a',250);
    store.getState().switchGymFacility('B','Gym B');store.getState().simulateCheckIn();
    expect(store.getState().rpg.gymContext.localGymXp).toBe(75);
    store.getState().editWorkout('gym-a',{exercises:exercises(20)});
    expect(store.getState().rpg.gymContext.localGymXp).toBe(75);
    expect(store.getState().rpg.gymContext.archivedFacilities![0].localGymXp).toBe(197);
    store.getState().deleteWorkout('gym-a');
    expect(store.getState().rpg.gymContext.localGymXp).toBe(75);
    expect(store.getState().rpg.gymContext.archivedFacilities![0].localGymXp).toBe(0);
    store.getState().switchGymFacility('B','Same gym');
    expect(store.getState().rpg.gymContext.localGymXp).toBe(75);
  });

  it('applies sleep only to preceding days and remains independent of recovery input ordering',()=>{
    const at=(day:number,hour:number)=>new Date(2026,10,day,hour).toISOString();
    const workout={id:'w',date:at(23,18),totalSets:1,fatigueStrainPoints:80} as WorkoutSessionRecord;
    const recovery=(day:number):RecoveryLogRecord=>({id:'r'+day,dateKey:'2026-11-'+day,date:at(day,8),source:'MANUAL_SELF_REPORTED',sleepHours:8,subjectiveReadiness:10,proteinGrams:150,computedScore:100,strainAtLog:0,status:'COMPLETED'});
    const sameDay=Date.parse(at(23,20));
    expect(computeDatedResidualStrain([workout],[recovery(23)],sameDay)).toBe(computeDatedResidualStrain([workout],[],sameDay));
    const nextDay=Date.parse(at(24,12));
    const baseline=computeDatedResidualStrain([workout],[],nextDay);
    expect(computeDatedResidualStrain([workout],[recovery(24),recovery(23)],nextDay)).toBe(Math.max(0,baseline-45));
    expect(computeDatedResidualStrain([workout],[recovery(23),recovery(24),recovery(24)],nextDay)).toBe(Math.max(0,baseline-45));
    expect(computeDatedResidualStrain([workout],[recovery(25)],nextDay)).toBe(baseline);
  });

  it('rejects future, invalid and nonfinite input before fitness or progression changes',()=>{
    const before=snap();
    for(const date of ['not-a-date',new Date(Date.now()+864000000).toISOString()])store.getState().logWorkout({name:'Invalid',date,durationMinutes:20,exercises:exercises()});
    for(const weight of [NaN,Infinity,-1])store.getState().logWorkout({name:'Invalid',durationMinutes:20,exercises:exercises(weight)});
    expect(store.getState().rpg).toEqual(before);
    expect(store.getState().training.workoutHistory).toEqual([]);
    log('good');
    const accepted=structuredClone(store.getState().training.workoutHistory);
    store.getState().editWorkout('good',{exercises:exercises(Infinity)});
    expect(store.getState().training.workoutHistory).toEqual(accepted);
  });

  it('upserts higher external versions, ignores stale deliveries and retries rejected events',()=>{
    log('versioned');
    const initial=structuredClone(store.getState().training.workoutHistory[0]);
    const event=(version:number,eventId:string,date=initial.date)=>({type:'WORKOUT_COMPLETED' as const,eventId,timestamp:new Date().toISOString(),memberId:store.getState().profile.id,gymId:initial.gymId!,workout:{...initial,date,version,name:'Version '+version,exercises:exercises(version*20)}});
    const invalid=event(2,'retry',new Date(Date.now()+86400000).toISOString());
    store.getState().processActivity(invalid);
    expect(store.getState().processedEventIds).not.toContain('retry');
    store.getState().processActivity(event(2,'retry'));
    expect(store.getState().training.workoutHistory[0].version).toBe(2);
    const xp=store.getState().rpg.xp;
    store.getState().processActivity(event(2,'retry'));
    store.getState().processActivity(event(1,'late-v1'));
    expect(store.getState().training.workoutHistory).toHaveLength(1);
    expect(store.getState().training.workoutHistory[0].name).toBe('Version 2');
    expect(store.getState().rpg.xp).toBe(xp);
  });
});
