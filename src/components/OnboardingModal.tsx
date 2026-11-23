import React, { useState } from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import { sound } from '../lib/audio/sound-fx';
import {
  Sparkles,
  Zap,
  Shield,
  HeartPulse,
  User,
  Scale,
  Calendar,
  Clock,
  Dumbbell,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  FitnessGoal,
  ExperienceLevel,
  Gender,
  AvailableEquipment,
} from '../types/member-state';

export const OnboardingModal: React.FC = () => {
  const { profile, completeOnboarding } = useEvolStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [name, setName] = useState('');
  const [hunterTitle, setHunterTitle] = useState('Getting Stronger Every Day');
  const [avatarId, setAvatarId] = useState<'monarch' | 'assassin' | 'knight'>('monarch');
  const [gender, setGender] = useState<Gender>('MALE');
  const [ageYears, setAgeYears] = useState(24);
  const [heightCm, setHeightCm] = useState(175);
  const [currentWeightKg, setCurrentWeightKg] = useState(72);
  const [targetWeightKg, setTargetWeightKg] = useState(75);
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>('MUSCLE_GAIN');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('BEGINNER');
  const [availableEquipment, setAvailableEquipment] = useState<AvailableEquipment>('FULL_GYM');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [activeLimitations, setActiveLimitations] = useState<string[]>([]);

  // If already completed onboarding, do not display
  if (profile.onboardingCompleted) {
    return null;
  }

  const toggleInjury = (id: string) => {
    setActiveLimitations((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleComplete = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playLevelUp();

    let avatarUrl = '/assets/avatar-monarch.jpg';
    if (avatarId === 'assassin') avatarUrl = '/assets/avatar-assassin.jpg';
    if (avatarId === 'knight') avatarUrl = '/assets/avatar-knight.jpg';

    completeOnboarding({
      name: name.trim() || 'Member',
      hunterTitle: hunterTitle.trim() || 'Getting Stronger Every Day',
      avatarId,
      avatarUrl,
      gender,
      ageYears: Number(ageYears) || 24,
      heightCm: Number(heightCm) || 175,
      currentWeightKg: Number(currentWeightKg) || 72,
      targetWeightKg: Number(targetWeightKg) || 75,
      fitnessGoal,
      experienceLevel,
      availableEquipment,
      preferredSessionDurationMinutes: Number(durationMinutes) || 60,
      activeLimitations,
      onboardingCompleted: true,
      measurementHistory: [
        {
          id: `m-${Date.now()}`,
          date: new Date().toISOString(),
          weightKg: Number(currentWeightKg) || 72,
          notes: 'Starting Weight',
        },
      ],
    });
  };

  const injuryOptions = [
    { id: 'LEFT_SHOULDER_IMPINGEMENT', label: 'Shoulder' },
    { id: 'LOWER_BACK_DISC_HERNIATION', label: 'Lower Back' },
    { id: 'PATELLAR_TENDINOPATHY', label: 'Knee' },
    { id: 'WRIST_STRAIN', label: 'Wrist' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 7, 12, 0.94)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        className="system-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'linear-gradient(145deg, rgba(13, 17, 28, 0.98), rgba(8, 10, 18, 0.98))',
          border: '2px solid var(--neon-cyan)',
          boxShadow: '0 0 40px rgba(0, 229, 255, 0.35)',
          padding: '24px 20px',
          position: 'relative',
        }}
      >
        <div className="hud-corner-tl" />
        <div className="hud-corner-tr" />
        <div className="hud-corner-bl" />
        <div className="hud-corner-br" />

        {/* System Header Banner */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0, 229, 255, 0.1)',
              border: '1px solid var(--border-cyan)',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '0.68rem',
              color: 'var(--neon-cyan)',
              fontFamily: 'var(--font-system)',
              fontWeight: 800,
              letterSpacing: '0.12em',
              marginBottom: '8px',
            }}
          >
            <Sparkles size={12} />
            GETTING STARTED
          </div>
          <h1
            className="cinzel-title"
            style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff', margin: 0 }}
          >
            Setup Profile
          </h1>

          {/* Stepper Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
            <div
              style={{
                width: '32px',
                height: '4px',
                borderRadius: '2px',
                background: step >= 1 ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.1)',
                boxShadow: step >= 1 ? '0 0 8px var(--neon-cyan)' : 'none',
              }}
            />
            <div
              style={{
                width: '32px',
                height: '4px',
                borderRadius: '2px',
                background: step >= 2 ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.1)',
                boxShadow: step >= 2 ? '0 0 8px var(--neon-cyan)' : 'none',
              }}
            />
            <div
              style={{
                width: '32px',
                height: '4px',
                borderRadius: '2px',
                background: step >= 3 ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.1)',
                boxShadow: step >= 3 ? '0 0 8px var(--neon-cyan)' : 'none',
              }}
            />
          </div>
        </div>

        {/* STEP 1: Profile Identity & Style */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                YOUR NAME
              </label>
              <input
                type="text"
                className="input-system"
                placeholder="Enter your name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                PERSONAL TAGLINE
              </label>
              <input
                type="text"
                className="input-system"
                placeholder="e.g. Getting Stronger Every Day, Consistency First..."
                value={hunterTitle}
                onChange={(e) => setHunterTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                CHOOSE YOUR PROFILE AVATAR
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {[
                  { id: 'monarch' as const, name: 'Power', color: 'var(--neon-cyan)', url: '/assets/avatar-monarch.jpg' },
                  { id: 'assassin' as const, name: 'Agile', color: '#a855f7', url: '/assets/avatar-assassin.jpg' },
                  { id: 'knight' as const, name: 'Balanced', color: '#38bdf8', url: '/assets/avatar-knight.jpg' },
                ].map((a) => (
                  <div
                    key={a.id}
                    onClick={() => {
                      setAvatarId(a.id);
                      sound.playClick();
                    }}
                    style={{
                      border: avatarId === a.id ? `2px solid ${a.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '8px',
                      background: avatarId === a.id ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: avatarId === a.id ? `0 0 14px ${a.color}55` : 'none',
                    }}
                  >
                    <img
                      src={a.url}
                      alt={a.name}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '6px',
                        objectFit: 'cover',
                        margin: '0 auto 6px',
                        display: 'block',
                      }}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#fff', fontWeight: 700 }}>
                      {a.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="button"
                className="btn-system"
                onClick={() => {
                  sound.playClick();
                  setStep(2);
                }}
                style={{ padding: '8px 18px' }}
              >
                <span>Continue: Biometrics &rarr;</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Physical Biometrics */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                  GENDER
                </label>
                <select
                  className="input-system"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                  AGE (YEARS)
                </label>
                <input
                  type="number"
                  className="input-system"
                  value={ageYears}
                  onChange={(e) => setAgeYears(Number(e.target.value))}
                  min={14}
                  max={99}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                  HEIGHT (CM)
                </label>
                <input
                  type="number"
                  className="input-system"
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  min={120}
                  max={240}
                />
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                  CURRENT WT (KG)
                </label>
                <input
                  type="number"
                  step="0.5"
                  className="input-system"
                  value={currentWeightKg}
                  onChange={(e) => setCurrentWeightKg(Number(e.target.value))}
                  min={35}
                  max={250}
                />
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                  TARGET WT (KG)
                </label>
                <input
                  type="number"
                  step="0.5"
                  className="input-system"
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(Number(e.target.value))}
                  min={35}
                  max={250}
                />
              </div>
            </div>

            <div>
              <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                PRIMARY FITNESS GOAL
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { id: 'MUSCLE_GAIN' as const, label: 'Build Muscle' },
                  { id: 'STRENGTH' as const, label: 'Get Stronger' },
                  { id: 'FAT_LOSS' as const, label: 'Lose Fat & Tone Up' },
                  { id: 'ENDURANCE' as const, label: 'Improve Stamina' },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setFitnessGoal(g.id);
                      sound.playClick();
                    }}
                    style={{
                      background: fitnessGoal === g.id ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: fitnessGoal === g.id ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: fitnessGoal === g.id ? 'var(--neon-cyan)' : '#fff',
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-system)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                }}
              >
                &larr; Back
              </button>
              <button
                type="button"
                className="btn-system"
                onClick={() => {
                  sound.playClick();
                  setStep(3);
                }}
                style={{ padding: '8px 18px' }}
              >
                <span>Continue: Training Setup &rarr;</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Equipment, Experience & Limitations */}
        {step === 3 && (
          <form onSubmit={handleComplete} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                  EXPERIENCE LEVEL
                </label>
                <select
                  className="input-system"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                >
                  <option value="BEGINNER">Beginner (&lt;1 yr)</option>
                  <option value="INTERMEDIATE">Intermediate (1-3 yrs)</option>
                  <option value="ADVANCED">Advanced (3+ yrs)</option>
                </select>
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                  SESSION DURATION
                </label>
                <select
                  className="input-system"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                >
                  <option value={45}>45 Minutes (Express)</option>
                  <option value={60}>60 Minutes (Standard)</option>
                  <option value={75}>75 Minutes (Extended)</option>
                  <option value={90}>90 Minutes (Long Session)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                AVAILABLE EQUIPMENT
              </label>
              <select
                className="input-system"
                value={availableEquipment}
                onChange={(e) => setAvailableEquipment(e.target.value as AvailableEquipment)}
              >
                <option value="FULL_GYM">Full Commercial Gym (Barbells, Cables, Machines)</option>
                <option value="BARBELL_DUMBBELL">Barbell + Dumbbell Home Gym</option>
                <option value="DUMBBELL_ONLY">Dumbbells & Bench Only</option>
                <option value="BODYWEIGHT_CABLES">Cables & Bodyweight</option>
              </select>
            </div>

            <div>
              <label className="stat-label" style={{ display: 'block', marginBottom: '6px' }}>
                INJURIES TO PROTECT (OPTIONAL)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {injuryOptions.map((opt) => {
                  const isChecked = activeLimitations.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => toggleInjury(opt.id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: isChecked ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: isChecked ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                      }}
                    >
                      <span style={{ color: isChecked ? '#fca5a5' : '#fff', fontWeight: 600 }}>
                        {opt.label}
                      </span>
                      <span style={{ color: isChecked ? '#ef4444' : 'var(--text-muted)', fontWeight: 800 }}>
                        {isChecked ? '✓' : '+'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                }}
              >
                &larr; Back
              </button>
              <button
                type="submit"
                className="btn-system"
                style={{
                  padding: '10px 22px',
                  background: 'var(--neon-cyan)',
                  color: '#000',
                  fontWeight: 900,
                  fontSize: '0.8rem',
                }}
              >
                <Zap size={15} />
                <span>Complete Setup</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
