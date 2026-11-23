import React from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import { calculateEnergyExpenditure } from '../lib/engines/body-intelligence';
import { FitnessGoal } from '../types/member-state';
import {
  Scale,
  HeartPulse,
  ShieldAlert,
  Sparkles,
  User,
  Dumbbell,
  TrendingUp,
  Activity,
  Layers,
  AlertCircle,
} from 'lucide-react';

export const BiometricsPanel: React.FC = () => {
  const { profile, training, readiness, updateProfile } = useEvolStore();

  const bmrCalc = calculateEnergyExpenditure(
    profile.currentWeightKg,
    profile.heightCm,
    profile.ageYears || 24,
    profile.gender || 'MALE',
    profile.activityMultiplier || 1.55,
    profile.fitnessGoal
  );

  const toggleLimitation = (limitation: string) => {
    let updatedLimitations = [...profile.activeLimitations];
    if (updatedLimitations.includes(limitation)) {
      updatedLimitations = updatedLimitations.filter((l) => l !== limitation);
    } else {
      updatedLimitations.push(limitation);
    }
    updateProfile({ activeLimitations: updatedLimitations });
  };

  const setGoal = (goal: FitnessGoal) => {
    updateProfile({ fitnessGoal: goal });
  };

  const limitationsList = [
    { id: 'LEFT_SHOULDER_IMPINGEMENT', label: 'Left Shoulder' },
    { id: 'RIGHT_SHOULDER_IMPINGEMENT', label: 'Right Shoulder' },
    { id: 'LOWER_BACK_DISC_HERNIATION', label: 'Lower Back' },
    { id: 'PATELLAR_TENDINOPATHY', label: 'Knee' },
    { id: 'WRIST_STRAIN', label: 'Wrist' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 16px' }}>
      {/* Biometrics Engine Summary */}
      <div className="system-card">
        <h2 className="cinzel-title" style={{ fontSize: '1.05rem', color: '#fff', margin: 0 }}>
          Daily Targets
        </h2>

        {/* Compact 4-column Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '10px', textAlign: 'center' }}>
          <div style={{ background: 'rgba(0, 229, 255, 0.05)', borderRadius: '8px', padding: '8px 4px' }}>
            <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>BMR</div>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: '0.95rem', color: '#fff', fontWeight: 800 }}>
              {bmrCalc.bmr}
            </div>
          </div>

          <div style={{ background: 'rgba(0, 229, 255, 0.05)', borderRadius: '8px', padding: '8px 4px' }}>
            <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>TDEE</div>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: '0.95rem', color: 'var(--neon-cyan)', fontWeight: 800 }}>
              {bmrCalc.tdee}
            </div>
          </div>

          <div style={{ background: 'rgba(168, 85, 247, 0.05)', borderRadius: '8px', padding: '8px 4px' }}>
            <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>CALORIES</div>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: '0.95rem', color: 'var(--shadow-purple)', fontWeight: 800 }}>
              {bmrCalc.targetCalories}
            </div>
          </div>

          <div style={{ background: 'rgba(52, 211, 153, 0.05)', borderRadius: '8px', padding: '8px 4px' }}>
            <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>PROTEIN</div>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: '0.95rem', color: '#34d399', fontWeight: 800 }}>
              {bmrCalc.proteinGramsTarget}g
            </div>
          </div>
        </div>

        {/* Weight & Height inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Current Weight (kg)</label>
            <input
              type="number"
              value={profile.currentWeightKg}
              onChange={(e) => updateProfile({ currentWeightKg: Number(e.target.value) })}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '6px 8px',
                color: '#fff',
                marginTop: '3px',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Height (cm)</label>
            <input
              type="number"
              value={profile.heightCm}
              onChange={(e) => updateProfile({ heightCm: Number(e.target.value) })}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '6px 8px',
                color: '#fff',
                marginTop: '3px',
              }}
            />
          </div>
        </div>

        {/* Fitness Goal Selection */}
        <div style={{ marginTop: '14px' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            Primary Fitness Goal
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {([
              { id: 'FAT_LOSS' as FitnessGoal, label: 'Lose Fat' },
              { id: 'MUSCLE_GAIN' as FitnessGoal, label: 'Build Muscle' },
              { id: 'STRENGTH' as FitnessGoal, label: 'Get Stronger' },
              { id: 'ENDURANCE' as FitnessGoal, label: 'Endurance' },
            ]).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGoal(g.id)}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  border: profile.fitnessGoal === g.id ? '1px solid var(--neon-cyan)' : '1px solid rgba(255,255,255,0.06)',
                  background: profile.fitnessGoal === g.id ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                  color: profile.fitnessGoal === g.id ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-system)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Training Load & Volume Monitor */}
      <div className="system-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 className="cinzel-title" style={{ fontSize: '1.05rem', color: '#fff', margin: 0 }}>
            Weekly Volume
          </h2>
          <span
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: training.acwr?.status === 'OVERTRAINING_RISK' ? '#f87171' : 'var(--neon-cyan)',
            }}
          >
            Balance: {training.acwr?.ratio ?? 1.0}x
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ padding: '8px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>7-DAY VOLUME</span>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: '1.05rem', color: 'var(--neon-cyan)', fontWeight: 800 }}>
              {(training.rollingVolume7dKg || training.weeklyTonnageKg || 0).toLocaleString()} kg
            </div>
          </div>

          <div style={{ padding: '8px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>28-DAY VOLUME</span>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: '1.05rem', color: '#38bdf8', fontWeight: 800 }}>
              {(training.rollingVolume28dKg || 0).toLocaleString()} kg
            </div>
          </div>
        </div>

        {/* Exercise Trends */}
        {training.exerciseTrends && Object.keys(training.exerciseTrends).length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              ESTIMATED MAX LIFT TRENDS
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Object.entries(training.exerciseTrends).map(([name, data]) => (
                <div
                  key={name}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.74rem',
                  }}
                >
                  <span style={{ color: '#fff' }}>{name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-code)', color: 'var(--neon-cyan)', fontWeight: 700 }}>
                      1RM: {data.last1RM} kg
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: data.trend === 'UP' ? '#34d399' : data.trend === 'DOWN' ? '#f87171' : '#fbbf24',
                      }}
                    >
                      {data.trend === 'UP' ? '▲ UP' : data.trend === 'DOWN' ? '▼ DOWN' : '— STABLE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Injury & Joint Protection */}
      <div className="system-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <ShieldAlert size={15} color="#f87171" />
          <span className="system-title" style={{ fontSize: '0.78rem' }}>
            JOINT PROTECTION
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {limitationsList.map((item) => {
            const isChecked = profile.activeLimitations.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => toggleLimitation(item.id)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: isChecked ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.06)',
                  background: isChecked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isChecked ? '#fca5a5' : '#fff' }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isChecked ? '#ef4444' : 'var(--text-muted)' }}>
                  {isChecked ? '✓' : '+'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
