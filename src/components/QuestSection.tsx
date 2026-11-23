import React, { useState, useEffect } from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import { WorkoutExercise } from '../types/events';
import {
  Clock,
  Sparkles,
  CheckCircle,
  Flame,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Square,
  Zap,
  Droplets,
  Beef,
  Moon,
  ShieldAlert,
  CheckSquare,
  X,
} from 'lucide-react';

export const QuestSection: React.FC = () => {
  const {
    quests,
    setPendingHonestyCheck,
    getSynthesizedState,
    activeWorkoutTimer,
    pendingTimerReview,
    startWorkoutTimer,
    pauseWorkoutTimer,
    resumeWorkoutTimer,
    finishWorkoutTimerForReview,
    cancelTimerReview,
    submitTimerWorkoutReview,
    logQuickHydration,
    logQuickProtein,
    logQuickSleep,
    openApologyModal,
  } = useEvolStore();

  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  const [, setTimerTick] = useState(0);

  // Local state for the Timer Workout Confirmation Review Modal
  const [reviewName, setReviewName] = useState('');
  const [reviewDuration, setReviewDuration] = useState(1);
  const [reviewDurationReason, setReviewDurationReason] = useState('');
  const [reviewExercises, setReviewExercises] = useState<WorkoutExercise[]>([]);

  useEffect(() => {
    if (pendingTimerReview) {
      setReviewName(pendingTimerReview.sessionName);
      setReviewDuration(Math.max(1, pendingTimerReview.measuredDurationMinutes));
      setReviewDurationReason('');
      setReviewExercises(pendingTimerReview.exercises);
    }
  }, [pendingTimerReview]);

  // Live 1-second interval tick when timer is actively running
  useEffect(() => {
    if (!activeWorkoutTimer || !activeWorkoutTimer.isRunning) return;
    const interval = setInterval(() => {
      setTimerTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeWorkoutTimer?.isRunning]);

  const context = getSynthesizedState();
  const assignedPlan = context.assignedSessionPlan || context.nextSessionPlan;
  const nextPlan = context.nextSessionPlan;

  const penaltyQuest = quests.find((q) => q.category === 'PENALTY_QUEST' && q.status !== 'CLAIMED');
  const mainQuests = quests.filter((q) => q.category === 'MAIN_QUEST');
  const sideQuests = quests.filter((q) => q.category === 'SIDE_QUEST');

  const totalQuests = quests.filter((q) => q.category !== 'PENALTY_QUEST');
  const completedCount = totalQuests.filter((q) => q.status === 'CLAIMED').length;

  // Calculate live elapsed seconds for the active workout timer
  const elapsedSeconds = (() => {
    if (!activeWorkoutTimer) return 0;
    const accumulated = activeWorkoutTimer.elapsedMs || 0;
    if (activeWorkoutTimer.isPaused || !activeWorkoutTimer.startedAt) {
      return Math.floor(accumulated / 1000);
    }
    return Math.floor((accumulated + (Date.now() - activeWorkoutTimer.startedAt)) / 1000);
  })();

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Critical Fix (Finding 1): Finishing timer opens review instead of inventing completed sets/PRs/XP!
  const handleFinishTimerWorkout = (questId: string) => {
    finishWorkoutTimerForReview(questId);
  };

  const toggleReviewSetConfirmed = (exIdx: number, setIdx: number) => {
    const copy = reviewExercises.map((ex, i) =>
      i === exIdx
        ? {
            ...ex,
            sets: ex.sets.map((s, j) =>
              j === setIdx ? { ...s, confirmed: !s.confirmed } : s
            ),
          }
        : ex
    );
    setReviewExercises(copy);
  };

  const updateReviewSetValue = (
    exIdx: number,
    setIdx: number,
    field: 'weightKg' | 'reps' | 'rpe',
    val: number
  ) => {
    const copy = reviewExercises.map((ex, i) =>
      i === exIdx
        ? {
            ...ex,
            sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: val } : s)),
          }
        : ex
    );
    setReviewExercises(copy);
  };

  const toggleAllSetsConfirmed = (confirmedValue: boolean) => {
    setReviewExercises(
      reviewExercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => ({ ...s, confirmed: confirmedValue })),
      }))
    );
  };

  const confirmedSetsCount = reviewExercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.confirmed).length,
    0
  );

  const renderActionBadge = (quest: (typeof quests)[0]) => {
    if (quest.status === 'CLAIMED') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(52, 211, 153, 0.15)',
            border: '1px solid #34d399',
            borderRadius: '6px',
            padding: '4px 8px',
            color: '#34d399',
            fontFamily: 'var(--font-system)',
            fontSize: '0.68rem',
            fontWeight: 700,
          }}
        >
          <CheckCircle size={12} /> CLAIMED
        </span>
      );
    }

    if (quest.status === 'OBJECTIVES_MET') {
      return (
        <button
          type="button"
          onClick={() => setPendingHonestyCheck(quest.id)}
          className="btn-system"
          style={{
            padding: '6px 14px',
            fontSize: '0.72rem',
            animation: 'pulse 1.8s infinite',
            background: 'linear-gradient(90deg, #00e5ff, #38bdf8)',
            boxShadow: '0 0 14px rgba(0, 229, 255, 0.6)',
          }}
        >
          <Zap size={13} style={{ display: 'inline', marginRight: '4px' }} />
          Claim (+{quest.rewards.xp} XP)
        </button>
      );
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '6px',
          padding: '4px 8px',
          color: '#fbbf24',
          fontFamily: 'var(--font-system)',
          fontSize: '0.68rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        IN PROGRESS
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 16px' }}>
      {/* Sleek Daily Header */}
      <div className="system-card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="cinzel-title" style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>
              Daily Goals
            </h2>
          </div>

          <span
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: '0.72rem',
              color: completedCount === totalQuests.length ? '#34d399' : 'var(--neon-cyan)',
              background: 'rgba(56, 189, 248, 0.08)',
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              fontWeight: 700,
            }}
          >
            {completedCount} / {totalQuests.length} Done
          </span>
        </div>
      </div>

      {/* Timer Workout Review & Set Confirmation Modal (Finding 1 Fix) */}
      {pendingTimerReview && (
        <div
          className="system-card"
          style={{
            border: '2px solid var(--neon-cyan)',
            background: 'rgba(10, 15, 26, 0.98)',
            boxShadow: '0 0 28px rgba(56, 189, 248, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="system-title" style={{ fontSize: '0.72rem' }}>
                CONFIRM PERFORMED WORKOUT
              </span>
              <h3 className="cinzel-title" style={{ fontSize: '1.05rem', color: '#fff', margin: 0 }}>
                {reviewName}
              </h3>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                Timer Measured: {formatTimer(pendingTimerReview.elapsedSeconds)} ({pendingTimerReview.elapsedSeconds}s)
              </span>
            </div>
            <button
              type="button"
              onClick={cancelTimerReview}
              aria-label="Cancel Workout Review"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>

          <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0 }}>
            Check only the sets you actually performed and adjust weights/reps before saving. Unchecked sets are not logged.
          </p>

          {/* Duration & Optional Correction Reason */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Duration (min)</label>
              <input
                type="number"
                min={1}
                max={240}
                value={reviewDuration}
                onChange={(e) => setReviewDuration(Math.max(1, Number(e.target.value)))}
                className="input-system"
                style={{ padding: '6px 8px', fontSize: '0.78rem', marginTop: '2px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                Duration Correction Note (if adjusted)
              </label>
              <input
                type="text"
                placeholder="e.g. Forgot to start timer at beginning"
                value={reviewDurationReason}
                onChange={(e) => setReviewDurationReason(e.target.value)}
                className="input-system"
                style={{ padding: '6px 8px', fontSize: '0.78rem', marginTop: '2px' }}
              />
            </div>
          </div>

          {/* Quick Select / Deselect All */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--neon-cyan)', fontWeight: 700 }}>
              Confirmed Sets: {confirmedSetsCount}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => toggleAllSetsConfirmed(true)}
                className="quick-chip-btn"
              >
                Check All Sets
              </button>
              <button
                type="button"
                onClick={() => toggleAllSetsConfirmed(false)}
                className="quick-chip-btn"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Exercise Set Checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
            {reviewExercises.map((ex, exIdx) => (
              <div
                key={ex.exerciseId || exIdx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                  {ex.exerciseName}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {ex.sets.map((s, sIdx) => (
                    <div
                      key={sIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.72rem',
                        opacity: s.confirmed ? 1 : 0.6,
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          cursor: 'pointer',
                          color: s.confirmed ? '#34d399' : 'var(--text-muted)',
                          fontWeight: 700,
                          minWidth: '64px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(s.confirmed)}
                          onChange={() => toggleReviewSetConfirmed(exIdx, sIdx)}
                        />
                        Set {sIdx + 1}
                      </label>

                      <input
                        type="number"
                        step="0.5"
                        value={s.weightKg}
                        onChange={(e) => updateReviewSetValue(exIdx, sIdx, 'weightKg', Number(e.target.value))}
                        style={{
                          width: '52px',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          padding: '3px',
                          color: '#fff',
                          textAlign: 'center',
                        }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>kg ×</span>
                      <input
                        type="number"
                        value={s.reps}
                        onChange={(e) => updateReviewSetValue(exIdx, sIdx, 'reps', Number(e.target.value))}
                        style={{
                          width: '44px',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          padding: '3px',
                          color: '#fff',
                          textAlign: 'center',
                        }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>reps</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={cancelTimerReview}
              className="btn-system-outline"
              style={{ flex: 1, padding: '8px' }}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() =>
                submitTimerWorkoutReview({
                  name: reviewName,
                  durationMinutes: reviewDuration,
                  durationEditedReason: reviewDurationReason.trim() || undefined,
                  exercises: reviewExercises,
                })
              }
              className="btn-system"
              style={{ flex: 1.6, padding: '8px' }}
            >
              <CheckSquare size={14} />
              <span>Save Confirmed Sets ({confirmedSetsCount})</span>
            </button>
          </div>
        </div>
      )}

      {/* Accountability Warning Card if Active */}
      {penaltyQuest && (
        <div
          className="system-card penalty-shake"
          style={{
            background: 'linear-gradient(145deg, rgba(30, 8, 12, 0.98), rgba(15, 4, 8, 0.98))',
            border: '2px solid #ef4444',
            boxShadow: '0 0 24px rgba(239, 68, 68, 0.5)',
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} color="#ef4444" />
              <div>
                <h4 style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>
                  Accountability Check Required
                </h4>
                <p style={{ color: '#fca5a5', fontSize: '0.72rem', margin: '2px 0 0 0' }}>
                  Goal rewards are paused until you complete a quick check-in.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openApologyModal()}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
              }}
            >
              Verify Now
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Today's Assigned Workout Plan */}
      {assignedPlan && (
        <div
          className="system-card"
          style={{
            padding: '12px 14px',
            background: 'rgba(16, 20, 32, 0.95)',
            border: '1px solid rgba(0, 229, 255, 0.25)',
          }}
        >
          <div
            onClick={() => setIsBlueprintOpen(!isBlueprintOpen)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--neon-cyan)', fontWeight: 700 }}>
                📋 Today&apos;s Assigned Plan: {assignedPlan.sessionName}
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-code)',
                }}
              >
                {assignedPlan.plannedDurationMinutes} min • Target {assignedPlan.targetTonnageKg.toLocaleString()} kg
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--neon-cyan)',
                fontSize: '0.7rem',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span>{isBlueprintOpen ? 'Hide' : 'View Plan'}</span>
              {isBlueprintOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </div>

          {isBlueprintOpen && (
            <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {assignedPlan.exercises.map((ex, i) => (
                  <div
                    key={ex.exerciseId || i}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      fontSize: '0.74rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{ex.exerciseName}</span>
                      <span style={{ fontFamily: 'var(--font-code)', color: 'var(--neon-cyan)' }}>
                        {ex.targetSets} × {ex.targetRepRange[0]}-{ex.targetRepRange[1]}
                        {ex.isBodyweight
                          ? ' (Bodyweight)'
                          : ex.suggestedWeightKg
                          ? ` @${ex.suggestedWeightKg}kg${ex.isCalibrationEstimate ? ' (est.)' : ''}`
                          : ''}
                      </span>
                    </div>
                    {ex.substitutionReason && (
                      <span style={{ fontSize: '0.64rem', color: '#fbbf24' }}>{ex.substitutionReason}</span>
                    )}
                  </div>
                ))}
              </div>

              {nextPlan && nextPlan.sessionName !== assignedPlan.sessionName && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(168, 85, 247, 0.08)',
                    border: '1px solid rgba(168, 85, 247, 0.25)',
                    fontSize: '0.68rem',
                    color: '#e9d5ff',
                  }}
                >
                  <strong>Next Session Recommendation:</strong> {nextPlan.sessionName} ({nextPlan.rationale})
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Quests Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Sparkles size={14} color="var(--neon-cyan)" />
          <span className="system-title" style={{ fontSize: '0.72rem' }}>
            TODAY&apos;S WORKOUT
          </span>
        </div>

        {mainQuests.map((quest) => {
          const isTimerActiveForThis = activeWorkoutTimer?.questId === quest.id;
          const isMet = quest.status === 'OBJECTIVES_MET';
          const isClaimed = quest.status === 'CLAIMED';

          return (
            <div
              key={quest.id}
              className="system-card"
              style={{
                padding: '14px 16px',
                borderColor: isClaimed
                  ? 'rgba(52, 211, 153, 0.4)'
                  : isMet
                  ? 'rgba(56, 189, 248, 0.4)'
                  : 'var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 className="cinzel-title" style={{ fontSize: '1.05rem', color: '#fff', margin: 0 }}>
                    {quest.title}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    {quest.subTitle}
                  </p>
                </div>

                {renderActionBadge(quest)}
              </div>

              {/* Live Workout Timer Integration */}
              {!isClaimed && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(0, 229, 255, 0.2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={15} color="var(--neon-cyan)" />
                      <div
                        style={{
                          fontFamily: 'var(--font-code)',
                          fontSize: '1.15rem',
                          fontWeight: 800,
                          letterSpacing: '0.05em',
                          color: isTimerActiveForThis
                            ? activeWorkoutTimer.isPaused
                              ? '#fbbf24'
                              : 'var(--neon-cyan)'
                            : '#64748b',
                        }}
                      >
                        {isTimerActiveForThis ? formatTimer(elapsedSeconds) : '00:00'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {!isTimerActiveForThis ? (
                        <button
                          type="button"
                          onClick={() => startWorkoutTimer(quest.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: 'linear-gradient(90deg, #00e5ff, #38bdf8)',
                            color: '#000',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          <Play size={12} fill="#000" /> START
                        </button>
                      ) : activeWorkoutTimer.isRunning ? (
                        <>
                          <button
                            type="button"
                            onClick={() => pauseWorkoutTimer()}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(251, 191, 36, 0.2)',
                              color: '#fbbf24',
                              border: '1px solid rgba(251, 191, 36, 0.4)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Pause size={12} /> PAUSE
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFinishTimerWorkout(quest.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Square size={12} fill="#fff" /> FINISH &amp; REVIEW
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => resumeWorkoutTimer()}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'linear-gradient(90deg, #00e5ff, #38bdf8)',
                              color: '#000',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            <Play size={12} fill="#000" /> RESUME
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFinishTimerWorkout(quest.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Square size={12} fill="#fff" /> FINISH &amp; REVIEW
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Requirements & Progress */}
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {quest.requirements.map((req, idx) => {
                  const pct = Math.min(100, Math.round((req.currentCount / Math.max(1, req.targetCount)) * 100));
                  const reqMet = req.currentCount >= req.targetCount;
                  return (
                    <div key={req.id || idx}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.72rem',
                          marginBottom: '3px',
                        }}
                      >
                        <span style={{ color: reqMet ? '#34d399' : 'var(--text-secondary)' }}>
                          {reqMet ? '✓' : '•'} {req.description}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-code)',
                            color: reqMet ? '#34d399' : 'var(--neon-cyan)',
                            fontWeight: 700,
                          }}
                        >
                          {req.currentCount.toLocaleString()} / {req.targetCount.toLocaleString()} {req.unit}
                        </span>
                      </div>
                      <div className="glow-progress-track" style={{ height: '5px' }}>
                        <div
                          className="glow-progress-fill"
                          style={{
                            width: `${pct}%`,
                            background: reqMet
                              ? '#34d399'
                              : 'linear-gradient(90deg, var(--shadow-purple), var(--neon-cyan))',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quest Rewards */}
              <div
                style={{
                  marginTop: '8px',
                  paddingTop: '6px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.7rem',
                }}
              >
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>REWARD:</span>
                  <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>+{quest.rewards.xp} XP</span>
                  {quest.rewards.itemReward && (
                    <span style={{ color: 'var(--gold-s-rank)', fontWeight: 600 }}>
                      [{quest.rewards.itemReward}]
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                  Expires in {quest.deadlineHoursRemaining}h
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Auxiliary Recovery & Habit Quests */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Flame size={14} color="var(--shadow-purple)" />
          <span className="system-title" style={{ fontSize: '0.72rem' }}>
            DAILY HABITS
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sideQuests.map((quest) => {
            const isHydration = quest.id.includes('hydration');
            const isProtein = quest.id.includes('protein');
            const isSleep = quest.id.includes('sleep') || quest.id.includes('recovery');
            const isClaimed = quest.status === 'CLAIMED';
            const req = quest.requirements[0];
            const current = req?.currentCount || 0;
            const target = req?.targetCount || 1;
            const pct = Math.min(100, Math.round((current / target) * 100));

            return (
              <div
                key={quest.id}
                className="system-card"
                style={{
                  padding: '12px 14px',
                  background: 'rgba(15, 18, 28, 0.85)',
                  border: isClaimed
                    ? '1px solid rgba(52, 211, 153, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isHydration && <Droplets size={16} color="#38bdf8" />}
                    {isProtein && <Beef size={16} color="#fb923c" />}
                    {isSleep && <Moon size={16} color="#a78bfa" />}
                    <h4 style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 700, margin: 0 }}>
                      {quest.title}
                    </h4>
                    {req && (
                      <span
                        style={{
                          fontFamily: 'var(--font-code)',
                          fontSize: '0.72rem',
                          color: current >= target ? '#34d399' : 'var(--neon-cyan)',
                          fontWeight: 700,
                        }}
                      >
                        {current} / {target} {req.unit}
                      </span>
                    )}
                  </div>

                  {renderActionBadge(quest)}
                </div>

                {/* Minimal Progress bar */}
                {req && (
                  <div style={{ marginTop: '8px' }}>
                    <div className="glow-progress-track" style={{ height: '4px' }}>
                      <div
                        className="glow-progress-fill"
                        style={{
                          width: `${pct}%`,
                          background:
                            current >= target ? '#34d399' : 'linear-gradient(90deg, #a855f7, #00e5ff)',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Interactive Quick Logging Buttons */}
                {!isClaimed && (isHydration || isProtein || isSleep) && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {isHydration && (
                      <>
                        <button type="button" onClick={() => logQuickHydration(250)} className="quick-chip-btn">
                          +250ml
                        </button>
                        <button type="button" onClick={() => logQuickHydration(500)} className="quick-chip-btn">
                          +500ml
                        </button>
                        <button type="button" onClick={() => logQuickHydration(1000)} className="quick-chip-btn">
                          +1L
                        </button>
                      </>
                    )}

                    {isProtein && (
                      <>
                        <button type="button" onClick={() => logQuickProtein(25)} className="quick-chip-btn">
                          +25g
                        </button>
                        <button type="button" onClick={() => logQuickProtein(50)} className="quick-chip-btn">
                          +50g
                        </button>
                      </>
                    )}

                    {isSleep && (
                      <>
                        <button type="button" onClick={() => logQuickSleep(7)} className="quick-chip-btn">
                          7h Sleep
                        </button>
                        <button type="button" onClick={() => logQuickSleep(8)} className="quick-chip-btn">
                          8h Sleep
                        </button>
                        <button type="button" onClick={() => logQuickSleep(9)} className="quick-chip-btn">
                          9h Sleep
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
