import React, { useState } from 'react';
import { useEvolStore } from '../lib/storage/persistent-store';
import { calculateEnergyExpenditure } from '../lib/engines/body-intelligence';
import { FitnessGoal, ExperienceLevel, Gender, AvailableEquipment } from '../types/member-state';
import { CalendarWidget } from './CalendarWidget';
import { sound } from '../lib/audio/sound-fx';
import {
  Settings,
  Calendar,
  User,
  Dumbbell,
  ShieldAlert,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Check,
  Database,
} from 'lucide-react';

export type SettingsSubTab = 'CALENDAR' | 'PROFILE' | 'TRAINING' | 'SYSTEM';

interface SettingsViewProps {
  initialSection?: SettingsSubTab;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ initialSection = 'PROFILE' }) => {
  const {
    profile,
    updateProfile,
    switchAvatar,
    resetToNewUser,
    loadDemoSimulation,
    triggerEmergencyDeloadTest,
  } = useEvolStore();

  const [section, setSection] = useState<SettingsSubTab>(initialSection);
  const [muted, setMuted] = useState(sound.isMuted());
  const [savedBanner, setSavedBanner] = useState(false);

  // Profile & Biometrics form state
  const [name, setName] = useState(profile.name);
  const [hunterTitle, setHunterTitle] = useState(profile.hunterTitle);
  const [gender, setGender] = useState<Gender>(profile.gender || 'MALE');
  const [ageYears, setAgeYears] = useState(profile.ageYears || 24);
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>(profile.fitnessGoal);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(profile.experienceLevel);
  const [availableEquipment, setAvailableEquipment] = useState<AvailableEquipment>(
    profile.availableEquipment || 'FULL_GYM'
  );
  const [sessionDuration, setSessionDuration] = useState(profile.preferredSessionDurationMinutes || 60);
  const [currentWeight, setCurrentWeight] = useState(profile.currentWeightKg);
  const [heightCm, setHeightCm] = useState(profile.heightCm);
  const [targetWeight, setTargetWeight] = useState(profile.targetWeightKg);
  const [gymName, setGymName] = useState(profile.gymName || 'Local Gym');

  const bmrPreview = calculateEnergyExpenditure(
    currentWeight,
    heightCm,
    ageYears,
    gender,
    profile.activityMultiplier || 1.55,
    fitnessGoal
  );

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playLevelUp();
    updateProfile({
      name: name.trim() || 'Member',
      hunterTitle: hunterTitle.trim() || 'Getting Stronger Every Day',
      gender,
      ageYears,
      fitnessGoal,
      experienceLevel,
      availableEquipment,
      preferredSessionDurationMinutes: sessionDuration,
      currentWeightKg: currentWeight,
      heightCm,
      targetWeightKg: targetWeight,
      gymName: gymName.trim() || 'Local Gym',
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const toggleLimitation = (limitation: string) => {
    sound.playClick();
    let updatedLimitations = [...profile.activeLimitations];
    if (updatedLimitations.includes(limitation)) {
      updatedLimitations = updatedLimitations.filter((l) => l !== limitation);
    } else {
      updatedLimitations.push(limitation);
    }
    updateProfile({ activeLimitations: updatedLimitations });
  };

  const toggleAudio = () => {
    const nextMuted = !muted;
    sound.setMuted(nextMuted);
    setMuted(nextMuted);
    if (!nextMuted) sound.playClick();
  };

  const limitationsList = [
    { id: 'LEFT_SHOULDER_IMPINGEMENT', label: 'Left Shoulder Impingement' },
    { id: 'RIGHT_SHOULDER_IMPINGEMENT', label: 'Right Shoulder Impingement' },
    { id: 'LOWER_BACK_DISC_HERNIATION', label: 'Lower Back / Disc Protection' },
    { id: 'PATELLAR_TENDINOPATHY', label: 'Knee / Patellar Tendon' },
    { id: 'WRIST_STRAIN', label: 'Wrist Strain Protection' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 16px' }}>
      {/* Settings Header & Sub-Navigation Bar (Including Calendar Option) */}
      <div className="system-card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={17} color="var(--neon-cyan)" />
            <h2 className="cinzel-title" style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>
              Settings & Calendar
            </h2>
          </div>
          {savedBanner && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.68rem',
                color: '#34d399',
                background: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.4)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontWeight: 700,
              }}
            >
              <Check size={12} /> Saved
            </span>
          )}
        </div>

        {/* 4 Sub-tabs: Profile | Calendar | Training | System */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {[
            { id: 'PROFILE' as const, label: 'Profile', icon: User },
            { id: 'CALENDAR' as const, label: 'Calendar', icon: Calendar },
            { id: 'TRAINING' as const, label: 'Training', icon: Dumbbell },
            { id: 'SYSTEM' as const, label: 'System', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  sound.playClick();
                  setSection(tab.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  padding: '7px 6px',
                  borderRadius: '8px',
                  border: active ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.07)',
                  background: active ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.02)',
                  color: active ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-system)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Icon size={12} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: CALENDAR OPTION INSIDE SETTINGS */}
      {section === 'CALENDAR' && <CalendarWidget />}

      {/* SECTION 2: PROFILE & BIOMETRICS SETTINGS */}
      {section === 'PROFILE' && (
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="system-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span className="system-title" style={{ fontSize: '0.76rem' }}>
              IDENTITY & AVATAR CLASS
            </span>

            {/* Avatar Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { id: 'monarch' as const, label: 'Power', url: '/assets/avatar-monarch.jpg' },
                { id: 'assassin' as const, label: 'Agile', url: '/assets/avatar-assassin.jpg' },
                { id: 'knight' as const, label: 'Balanced', url: '/assets/avatar-knight.jpg' },
              ].map((av) => {
                const isSelected = profile.avatarId === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => switchAvatar(av.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.08)',
                      background: isSelected ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255, 255, 255, 0.02)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <img
                      src={av.url}
                      alt={av.label}
                      style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }}
                    />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{av.label}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Your Name
                </label>
                <input
                  type="text"
                  className="input-system"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Personal Tagline
                </label>
                <input
                  type="text"
                  className="input-system"
                  value={hunterTitle}
                  onChange={(e) => setHunterTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Gender
                </label>
                <select
                  className="input-system"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other / Non-Binary</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Age (Years)
                </label>
                <input
                  type="number"
                  min={14}
                  max={100}
                  className="input-system"
                  value={ageYears}
                  onChange={(e) => setAgeYears(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Current Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="input-system"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Target Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="input-system"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Height (cm)
                </label>
                <input
                  type="number"
                  className="input-system"
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Home Gym / Facility
                </label>
                <input
                  type="text"
                  className="input-system"
                  value={gymName}
                  onChange={(e) => setGymName(e.target.value)}
                />
              </div>
            </div>

            {/* Live Caloric & Protein Preview */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                padding: '8px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.05)',
                border: '1px solid rgba(56, 189, 248, 0.15)',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>EST. TDEE</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>{bmrPreview.tdee} kcal</div>
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>GOAL CALORIES</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--neon-cyan)' }}>
                  {bmrPreview.targetCalories} kcal
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>PROTEIN TARGET</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#34d399' }}>
                  {bmrPreview.proteinGramsTarget}g / day
                </div>
              </div>
            </div>

            <button type="submit" className="btn-system" style={{ width: '100%' }}>
              <Check size={15} />
              <span>Save Profile & Biometrics</span>
            </button>
          </div>
        </form>
      )}

      {/* SECTION 3: TRAINING & JOINT PROTECTION SETTINGS */}
      {section === 'TRAINING' && (
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="system-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span className="system-title" style={{ fontSize: '0.76rem' }}>
              WORKOUT ENGINE & EQUIPMENT SETUP
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Primary Goal
                </label>
                <select
                  className="input-system"
                  value={fitnessGoal}
                  onChange={(e) => setFitnessGoal(e.target.value as FitnessGoal)}
                >
                  <option value="MUSCLE_GAIN">Build Muscle (Hypertrophy)</option>
                  <option value="STRENGTH">Get Stronger (Max 1RM)</option>
                  <option value="FAT_LOSS">Lose Fat (Conditioning)</option>
                  <option value="ENDURANCE">Endurance & Stamina</option>
                </select>
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Experience Level
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
                <label className="stat-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Available Equipment
                </label>
                <select
                  className="input-system"
                  value={availableEquipment}
                  onChange={(e) => setAvailableEquipment(e.target.value as AvailableEquipment)}
                >
                  <option value="FULL_GYM">Full Commercial Gym</option>
                  <option value="BARBELL_DUMBBELL">Barbell & Dumbbells</option>
                  <option value="DUMBBELL_ONLY">Dumbbells Only</option>
                  <option value="BODYWEIGHT_CABLES">Bodyweight & Cables</option>
                </select>
              </div>

              <div>
                <label className="stat-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Session Duration
                </label>
                <select
                  className="input-system"
                  value={sessionDuration}
                  onChange={(e) => setSessionDuration(Number(e.target.value))}
                >
                  <option value={45}>45 Minutes (Express)</option>
                  <option value={60}>60 Minutes (Standard)</option>
                  <option value={75}>75 Minutes (Extended)</option>
                  <option value={90}>90 Minutes (Heavy)</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn-system" style={{ width: '100%' }}>
              <Check size={15} />
              <span>Save Training Preferences</span>
            </button>
          </div>

          {/* Joint & Injury Contraindication Filters */}
          <div className="system-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={15} color="#f87171" />
              <span className="system-title" style={{ fontSize: '0.76rem' }}>
                JOINT & INJURY PROTECTION FILTERS
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
              Active limitations automatically exclude risky exercises from your generated daily workout plans.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {limitationsList.map((item) => {
                const isChecked = profile.activeLimitations.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleLimitation(item.id)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: isChecked ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.07)',
                      background: isChecked ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: isChecked ? '#fca5a5' : '#fff',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ color: isChecked ? '#ef4444' : 'var(--text-muted)', fontWeight: 800 }}>
                      {isChecked ? 'PROTECTED ✓' : '+ Enable'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      )}

      {/* SECTION 4: SYSTEM, AUDIO & DATA MANAGEMENT */}
      {section === 'SYSTEM' && (
        <div className="system-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span className="system-title" style={{ fontSize: '0.76rem' }}>
            AUDIO, SIMULATION & DATA CONTROLS
          </span>

          {/* Sound Toggle */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {muted ? <VolumeX size={16} color="var(--text-muted)" /> : <Volume2 size={16} color="var(--neon-cyan)" />}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>System Audio & SFX</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Level-up fanfare, quest chimes & button feedback
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleAudio}
              className="btn-system-outline"
              style={{ padding: '6px 12px', fontSize: '0.72rem' }}
            >
              {muted ? 'Unmute' : 'Mute'}
            </button>
          </div>

          {/* Emergency Deload Mode Simulation */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>Test Adaptive Recovery Override</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Simulate high ACWR fatigue spike (&gt;1.4) to test Light Recovery quests
              </div>
            </div>
            <button
              type="button"
              onClick={triggerEmergencyDeloadTest}
              className="btn-system-outline"
              style={{ padding: '6px 12px', fontSize: '0.72rem' }}
            >
              Simulate
            </button>
          </div>

          {/* Demo Dataset & Reset to Level 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Load sample Level 18 profile with 4 weeks of workouts?')) {
                  loadDemoSimulation();
                }
              }}
              className="btn-system-outline"
              style={{ padding: '10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Sparkles size={14} />
              <span>Load Demo Mode</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all data to a fresh Level 1 profile?')) {
                  resetToNewUser();
                }
              }}
              className="btn-danger-outline"
              style={{
                padding: '10px',
                fontSize: '0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontWeight: 700,
              }}
            >
              <RotateCcw size={14} />
              <span>Reset (Lv 1)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
