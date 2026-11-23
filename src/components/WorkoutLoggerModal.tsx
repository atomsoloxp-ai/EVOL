import React, { useState, useEffect } from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import { WorkoutExercise, WorkoutSet } from '../types/events';
import {
  Dumbbell,
  Plus,
  Trash2,
  Zap,
  History,
  Flame,
  AlertCircle,
  Edit2,
  Check,
  Save,
  RotateCcw,
} from 'lucide-react';
import { sound } from '../lib/audio/sound-fx';

export const WorkoutLoggerModal: React.FC = () => {
  const {
    logWorkout,
    training,
    profile,
    editWorkout,
    deleteWorkout,
    readiness,
    getSynthesizedState,
  } = useEvolStore();

  const [workoutName, setWorkoutName] = useState('Workout #1');
  const [durationMinutes, setDurationMinutes] = useState(profile.preferredSessionDurationMinutes || 60);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([
    {
      exerciseId: 'ex-1',
      exerciseName: profile.availableEquipment === 'DUMBBELL_ONLY' ? 'Dumbbell Flat Bench Press' : 'Barbell Bench Press',
      muscleGroup: 'CHEST',
      sets: [
        { weightKg: 30, reps: 10, rpe: 7.5, isWarmup: false },
        { weightKg: 35, reps: 10, rpe: 8, isWarmup: false },
      ],
    },
  ]);

  const draftStorageKey = `evol_workout_draft_${profile.id || 'default'}`;

  // Load member-scoped draft from localStorage if available
  useEffect(() => {
    try {
      const draft = localStorage.getItem(draftStorageKey) || localStorage.getItem('evol_workout_draft');
      if (draft && !editingSessionId) {
        const parsed = JSON.parse(draft);
        if (parsed.exercises && parsed.exercises.length > 0) {
          setWorkoutName(parsed.name || workoutName);
          setDurationMinutes(parsed.durationMinutes || 55);
          setExercises(parsed.exercises);
        }
      }
    } catch (e) {
      // ignore
    }
  }, [draftStorageKey]);

  const saveDraft = (currentExs: WorkoutExercise[], name: string, dur: number) => {
    try {
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({ name, durationMinutes: dur, exercises: currentExs })
      );
    } catch (e) {
      // ignore
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftStorageKey);
      localStorage.removeItem('evol_workout_draft');
    } catch (e) {
      // ignore
    }
  };

  const addSet = (exIndex: number) => {
    const updated = [...exercises];
    const lastSet = updated[exIndex].sets[updated[exIndex].sets.length - 1] || {
      weightKg: 60,
      reps: 10,
      rpe: 8,
      isWarmup: false,
    };
    updated[exIndex].sets.push({ ...lastSet, isWarmup: false });
    setExercises(updated);
    saveDraft(updated, workoutName, durationMinutes);
  };

  const removeSet = (exIndex: number, setIndex: number) => {
    const updated = [...exercises];
    if (updated[exIndex].sets.length > 1) {
      updated[exIndex].sets.splice(setIndex, 1);
      setExercises(updated);
      saveDraft(updated, workoutName, durationMinutes);
    }
  };

  const updateSet = (
    exIndex: number,
    setIndex: number,
    field: keyof WorkoutSet,
    val: any
  ) => {
    const updated = [...exercises];
    updated[exIndex].sets[setIndex] = {
      ...updated[exIndex].sets[setIndex],
      [field]: val,
    };
    setExercises(updated);
    saveDraft(updated, workoutName, durationMinutes);
  };

  const addExercise = () => {
    const updated = [
      ...exercises,
      {
        exerciseId: `ex-${Date.now()}`,
        exerciseName: 'Dumbbell Lateral Raise',
        muscleGroup: 'SHOULDERS' as const,
        sets: [{ weightKg: 16, reps: 12, rpe: 8, isWarmup: false }],
      },
    ];
    setExercises(updated);
    saveDraft(updated, workoutName, durationMinutes);
  };

  const removeExercise = (exIndex: number) => {
    if (exercises.length <= 1) return;
    const updated = exercises.filter((_, i) => i !== exIndex);
    setExercises(updated);
    saveDraft(updated, workoutName, durationMinutes);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSessionId) {
      editWorkout(editingSessionId, {
        name: workoutName,
        durationMinutes,
        exercises,
      });
      setEditingSessionId(null);
    } else {
      logWorkout({
        name: workoutName,
        durationMinutes,
        exercises,
        source: 'MANUAL_SELF_REPORTED',
      });
      clearDraft();
    }
  };

  const handleStartEdit = (session: (typeof training.workoutHistory)[0]) => {
    setEditingSessionId(session.id);
    setWorkoutName(session.name);
    setDurationMinutes(session.durationMinutes);
    // Form edits must not mutate the accepted historical record before Save.
    setExercises(structuredClone(session.exercises));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setWorkoutName('Strength Workout');
    setDurationMinutes(55);
    clearDraft();
  };

  // Quick Presets
  const applyPreset = (preset: 'SYSTEM_PLAN' | 'PUSH' | 'LEGS' | 'PULL' | 'DELOAD') => {
    sound.playClick();
    if (preset === 'SYSTEM_PLAN') {
      const stateSnapshot = getSynthesizedState();
      const plan = stateSnapshot.assignedSessionPlan || stateSnapshot.nextSessionPlan;
      const name = plan?.sessionName || "Today's Workout Plan";
      const dur = plan?.plannedDurationMinutes || profile.preferredSessionDurationMinutes || 60;
      const exs: WorkoutExercise[] = (plan?.exercises || []).map((pe, idx) => ({
        exerciseId: pe.exerciseId || `plan-ex-${idx}-${Date.now()}`,
        exerciseName: pe.exerciseName,
        muscleGroup: pe.muscleGroup,
        sets: Array.from({ length: pe.targetSets }, () => ({
          weightKg: pe.isBodyweight ? 0 : pe.suggestedWeightKg || (profile.experienceLevel === 'BEGINNER' ? 20 : 40),
          reps: pe.targetRepRange[0],
          rpe: pe.rpeTarget,
          isWarmup: false,
        })),
      }));
      setWorkoutName(name);
      setDurationMinutes(dur);
      setExercises(exs.length ? exs : exercises);
      saveDraft(exs.length ? exs : exercises, name, dur);
    } else if (preset === 'PUSH') {
      const name = 'Push: Chest & Shoulders';
      const exs: WorkoutExercise[] = [
        {
          exerciseId: 'p-1',
          exerciseName: profile.availableEquipment === 'DUMBBELL_ONLY' ? 'Dumbbell Incline Bench Press' : 'Barbell Incline Bench Press',
          muscleGroup: 'CHEST',
          sets: [
            { weightKg: 36, reps: 10, rpe: 8 },
            { weightKg: 40, reps: 8, rpe: 8.5 },
            { weightKg: 42, reps: 6, rpe: 9 },
          ],
        },
        {
          exerciseId: 'p-2',
          exerciseName: 'Cable Lateral Raise',
          muscleGroup: 'SHOULDERS',
          sets: [{ weightKg: 12, reps: 15, rpe: 8 }, { weightKg: 14, reps: 12, rpe: 8.5 }],
        },
      ];
      setWorkoutName(name);
      setExercises(exs);
      saveDraft(exs, name, durationMinutes);
    } else if (preset === 'LEGS') {
      const name = 'Legs & Glutes';
      const exs: WorkoutExercise[] = [
        {
          exerciseId: 'l-1',
          exerciseName: 'Barbell Back Squat',
          muscleGroup: 'LEGS',
          sets: [{ weightKg: 60, reps: 8, rpe: 8 }, { weightKg: 70, reps: 8, rpe: 8.5 }],
        },
        {
          exerciseId: 'l-2',
          exerciseName: 'Romanian Deadlift',
          muscleGroup: 'LEGS',
          sets: [{ weightKg: 60, reps: 8, rpe: 8 }, { weightKg: 70, reps: 8, rpe: 8.5 }],
        },
      ];
      setWorkoutName(name);
      setExercises(exs);
      saveDraft(exs, name, durationMinutes);
    } else if (preset === 'PULL') {
      const name = 'Pull: Back & Biceps';
      const exs: WorkoutExercise[] = [
        {
          exerciseId: 'b-1',
          exerciseName: 'Chest-Supported Row',
          muscleGroup: 'BACK',
          sets: [{ weightKg: 40, reps: 10, rpe: 8 }, { weightKg: 45, reps: 8, rpe: 8.5 }],
        },
        {
          exerciseId: 'b-2',
          exerciseName: 'Incline DB Bicep Curl',
          muscleGroup: 'ARMS',
          sets: [{ weightKg: 12, reps: 10, rpe: 8 }, { weightKg: 14, reps: 8, rpe: 8.5 }],
        },
      ];
      setWorkoutName(name);
      setExercises(exs);
      saveDraft(exs, name, durationMinutes);
    } else {
      const name = 'Light Recovery Session';
      const exs: WorkoutExercise[] = [
        {
          exerciseId: 'd-1',
          exerciseName: 'Goblet Squat (Tempo Focus)',
          muscleGroup: 'LEGS',
          sets: [{ weightKg: 16, reps: 10, rpe: 5.5 }, { weightKg: 16, reps: 10, rpe: 5.5 }],
        },
        {
          exerciseId: 'd-2',
          exerciseName: 'Cable Face Pull',
          muscleGroup: 'SHOULDERS',
          sets: [{ weightKg: 12, reps: 15, rpe: 6 }, { weightKg: 12, reps: 15, rpe: 6 }],
        },
      ];
      setWorkoutName(name);
      setExercises(exs);
      saveDraft(exs, name, durationMinutes);
    }
  };

  // Live preview metrics
  let currentPreviewTonnage = 0;
  let totalSetsCount = 0;
  let previewStrainPoints = 0;

  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!s.isWarmup) {
        currentPreviewTonnage += (s.weightKg || 0) * (s.reps || 0);
        totalSetsCount++;
        const rpe = s.rpe || 7.5;
        previewStrainPoints += (s.weightKg * s.reps) / 1200 + rpe * 0.5;
      }
    }
  }

  const calculatedFatigueStrain = Math.min(
    100,
    Math.round(totalSetsCount * 1.8 + previewStrainPoints + currentPreviewTonnage / 1500)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 16px' }}>
      {/* Workout Form Header */}
      <div className="system-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="cinzel-title" style={{ fontSize: '1.15rem', color: '#fff', margin: 0 }}>
            {editingSessionId ? 'Edit Workout' : 'Log Workout'}
          </h2>

          <div
            style={{
              background: 'rgba(0, 229, 255, 0.1)',
              border: '1px solid var(--neon-cyan)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontFamily: 'var(--font-code)',
              fontSize: '0.75rem',
              color: 'var(--neon-cyan)',
            }}
          >
            {currentPreviewTonnage.toLocaleString()} kg • +{calculatedFatigueStrain} strain
          </div>
        </div>

        {/* Quick Presets row */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={() => applyPreset('SYSTEM_PLAN')}
            className="btn-system"
            style={{ flex: 1.4, padding: '5px', fontSize: '0.65rem', background: 'rgba(0, 229, 255, 0.15)', border: '1px solid var(--neon-cyan)', color: 'var(--neon-cyan)' }}
            title="Load today's recommended exercises"
          >
            ⚡ Today&apos;s Plan
          </button>
          <button
            type="button"
            onClick={() => applyPreset('PUSH')}
            className="btn-system-outline"
            style={{ flex: 1, padding: '5px', fontSize: '0.65rem' }}
          >
            Push
          </button>
          <button
            type="button"
            onClick={() => applyPreset('LEGS')}
            className="btn-system-outline"
            style={{ flex: 1, padding: '5px', fontSize: '0.65rem' }}
          >
            Legs
          </button>
          <button
            type="button"
            onClick={() => applyPreset('PULL')}
            className="btn-system-outline"
            style={{ flex: 1, padding: '5px', fontSize: '0.65rem' }}
          >
            Pull
          </button>
          <button
            type="button"
            onClick={() => applyPreset('DELOAD')}
            className="btn-system-outline"
            style={{ flex: 1, padding: '5px', fontSize: '0.65rem', borderColor: '#38bdf8' }}
          >
            Light
          </button>
        </div>

        {/* Workout Input Fields */}
        <form onSubmit={handleSubmit} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Session Name</label>
              <input
                type="text"
                value={workoutName}
                onChange={(e) => {
                  setWorkoutName(e.target.value);
                  saveDraft(exercises, e.target.value, durationMinutes);
                }}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: '#fff',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.85rem',
                  marginTop: '4px',
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Duration (min)</label>
              <input
                type="number"
                min="10"
                max="240"
                value={durationMinutes}
                onChange={(e) => {
                  const d = Number(e.target.value);
                  setDurationMinutes(d);
                  saveDraft(exercises, workoutName, d);
                }}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: '#fff',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.85rem',
                  marginTop: '4px',
                }}
              />
            </div>
          </div>

          {/* Exercises list with full set RPE and Warmup details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {exercises.map((ex, exIdx) => (
              <div
                key={ex.exerciseId || exIdx}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '8px',
                  padding: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={ex.exerciseName}
                    onChange={(e) => {
                      const updated = [...exercises];
                      updated[exIdx].exerciseName = e.target.value;
                      setExercises(updated);
                      saveDraft(updated, workoutName, durationMinutes);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--neon-cyan)',
                      fontFamily: 'var(--font-system)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      width: '65%',
                    }}
                  />

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => addSet(exIdx)}
                      style={{
                        background: 'rgba(0, 229, 255, 0.1)',
                        border: '1px solid var(--neon-cyan)',
                        color: 'var(--neon-cyan)',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '0.65rem',
                        cursor: 'pointer',
                      }}
                    >
                      + Set
                    </button>
                    {exercises.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeExercise(exIdx)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          padding: '2px',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sets rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {ex.sets.map((set, setIdx) => (
                    <div
                      key={setIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.74rem',
                        background: set.isWarmup ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                        padding: '3px 4px',
                        borderRadius: '4px',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', width: '42px', fontSize: '0.68rem' }}>
                        Set {setIdx + 1}
                      </span>

                      {/* Weight */}
                      <input
                        type="number"
                        step="0.5"
                        value={set.weightKg}
                        onChange={(e) => updateSet(exIdx, setIdx, 'weightKg', Number(e.target.value))}
                        style={{
                          width: '54px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          padding: '4px',
                          color: '#fff',
                          textAlign: 'center',
                        }}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.68rem' }}>kg ×</span>

                      {/* Reps */}
                      <input
                        type="number"
                        value={set.reps}
                        onChange={(e) => updateSet(exIdx, setIdx, 'reps', Number(e.target.value))}
                        style={{
                          width: '44px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          padding: '4px',
                          color: '#fff',
                          textAlign: 'center',
                        }}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.68rem' }}>reps</span>

                      {/* RPE */}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginLeft: '4px' }}>RPE:</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        value={set.rpe ?? 8}
                        onChange={(e) => updateSet(exIdx, setIdx, 'rpe', Number(e.target.value))}
                        style={{
                          width: '42px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          padding: '4px',
                          color: '#fbbf24',
                          textAlign: 'center',
                          fontWeight: 700,
                        }}
                      />

                      {/* Warmup Toggle */}
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.62rem',
                          color: set.isWarmup ? '#fbbf24' : 'var(--text-muted)',
                          marginLeft: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={set.isWarmup || false}
                          onChange={(e) => updateSet(exIdx, setIdx, 'isWarmup', e.target.checked)}
                        />
                        Warmup
                      </label>

                      {ex.sets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSet(exIdx, setIdx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            marginLeft: 'auto',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={addExercise}
              className="btn-system-outline"
              style={{ flex: 1, padding: '8px' }}
            >
              <Plus size={14} />
              <span>Add Exercise</span>
            </button>

            {editingSessionId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="btn-system-outline"
                style={{ flex: 0.8, padding: '8px', borderColor: '#f87171', color: '#f87171' }}
              >
                <RotateCcw size={14} />
                <span>Cancel</span>
              </button>
            )}

            <button type="submit" className="btn-system" style={{ flex: 1.4, padding: '8px' }}>
              <Zap size={14} />
              <span>{editingSessionId ? 'Save Changes' : 'Save Workout'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Workout History with Full Sets, Effort, and Edit Capability */}
      <div className="system-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <History size={15} color="var(--neon-cyan)" />
            <span className="system-title" style={{ fontSize: '0.8rem' }}>
              WORKOUT HISTORY ({training.workoutHistory.length})
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {training.workoutHistory.map((w) => (
            <div
              key={w.id}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{w.name}</strong>
                    <span
                      style={{
                        fontSize: '0.6rem',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background:
                          w.source === 'ATOM_OS_VERIFIED'
                            ? 'rgba(52, 211, 153, 0.15)'
                            : 'rgba(0, 229, 255, 0.1)',
                        color: w.source === 'ATOM_OS_VERIFIED' ? '#34d399' : 'var(--neon-cyan)',
                        fontFamily: 'var(--font-code)',
                      }}
                    >
                      {w.source === 'ATOM_OS_VERIFIED' ? 'VERIFIED' : 'LOGGED'}
                    </span>
                    {w.status === 'CORRECTED' && (
                      <span
                        style={{
                          fontSize: '0.6rem',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          background: 'rgba(251, 191, 36, 0.15)',
                          color: '#fbbf24',
                        }}
                      >
                        CORRECTED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {new Date(w.date).toLocaleDateString()} • {w.durationMinutes} mins • {w.totalSets} working sets • Strain: +{w.fatigueStrainPoints} pts
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-code)', color: 'var(--neon-cyan)', fontWeight: 700, fontSize: '0.85rem' }}>
                      {w.totalTonnageKg.toLocaleString()} KG
                    </div>
                    {w.prsEarned && w.prsEarned.length > 0 && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--gold-s-rank)', fontWeight: 600 }}>
                        +{w.prsEarned.length} PR Achieved!
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleStartEdit(w)}
                    title="Edit/Correct this session"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-secondary)',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Edit2 size={12} />
                  </button>

                  <button
                    onClick={() => deleteWorkout(w.id)}
                    title="Delete record"
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#f87171',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Set details breakdown */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginTop: '4px',
                  paddingTop: '6px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                }}
              >
                {w.exercises.map((ex, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--text-secondary)',
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '3px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    <strong style={{ color: '#fff' }}>{ex.exerciseName}:</strong>{' '}
                    {ex.sets.map((s) => `${s.weightKg}k×${s.reps}${s.rpe ? `@RPE${s.rpe}` : ''}`).join(', ')}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
