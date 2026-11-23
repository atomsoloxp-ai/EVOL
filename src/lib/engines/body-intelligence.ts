// Module 1: Member Profile & Body Intelligence Engine (EVOL.md Section 4)

import { FitnessGoal, Gender, AvailableEquipment } from '../../types/member-state';
import { MuscleGroup } from '../../types/events';

export interface BMRCalculation {
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinGramsTarget: number;
}

/**
 * Calculates BMR and TDEE using the Mifflin-St Jeor equation without fixed demographic assumptions.
 */
export function calculateEnergyExpenditure(
  weightKg: number,
  heightCm: number,
  ageYears: number = 26,
  gender: Gender = 'MALE',
  activityMultiplier: number = 1.45,
  goal: FitnessGoal = 'MUSCLE_GAIN'
): BMRCalculation {
  const safeWeight = Math.max(35, weightKg || 72);
  const safeHeight = Math.max(120, heightCm || 175);
  const safeAge = Math.max(14, ageYears || 24);

  const base = 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge;
  let genderOffset = 5;
  if (gender === 'FEMALE') {
    genderOffset = -161;
  } else if (gender === 'OTHER' || gender === 'PREFER_NOT_TO_SAY') {
    genderOffset = -78;
  }

  const bmr = Math.round(base + genderOffset);
  const tdee = Math.round(bmr * activityMultiplier);

  let targetCalories = tdee;
  let proteinMultiplier = 2.0;

  switch (goal) {
    case 'FAT_LOSS':
      targetCalories = Math.round(tdee - 450);
      proteinMultiplier = 2.2;
      break;
    case 'MUSCLE_GAIN':
      targetCalories = Math.round(tdee + 300);
      proteinMultiplier = 2.0;
      break;
    case 'STRENGTH':
      targetCalories = Math.round(tdee + 150);
      proteinMultiplier = 2.0;
      break;
    case 'ENDURANCE':
      targetCalories = tdee;
      proteinMultiplier = 1.7;
      break;
  }

  const proteinGramsTarget = Math.round(safeWeight * proteinMultiplier);

  return {
    bmr,
    tdee,
    targetCalories,
    proteinGramsTarget,
  };
}

export const KNOWN_LIMITATIONS = new Set<string>([
  'LEFT_SHOULDER_IMPINGEMENT',
  'RIGHT_SHOULDER_IMPINGEMENT',
  'LOWER_BACK_DISC_HERNIATION',
  'PATELLAR_TENDINOPATHY',
  'WRIST_STRAIN',
]);

export interface ExerciseCatalogItem {
  exerciseId: string;
  exerciseName: string;
  aliases: string[];
  muscleGroup: MuscleGroup;
  requiredEquipment: AvailableEquipment[];
  contraindicatedLimitations: string[];
  substituteIds: string[];
  isBodyweight: boolean;
  movementType: 'LOWER_COMPOUND' | 'UPPER_COMPOUND' | 'ISOLATION' | 'CORE_BODYWEIGHT' | 'MOBILITY';
  defaultStarterLoadRatio: number; // Ratio of bodyweight for conservative starter calibration (0 for bodyweight)
}

/**
 * Canonical Structured Exercise Catalog with explicit equipment requirements,
 * joint/limitation contraindications, and single-exercise validated substitute IDs.
 */
export const EXERCISE_CATALOG: ExerciseCatalogItem[] = [
  // ─── LEGS ─────────────────────────────────────────────────────────────────
  {
    exerciseId: 'barbell_back_squat',
    exerciseName: 'Barbell Back Squat',
    aliases: ['barbell back squat', 'heavy back squat', 'back squat'],
    muscleGroup: 'LEGS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM'],
    contraindicatedLimitations: ['LOWER_BACK_DISC_HERNIATION', 'PATELLAR_TENDINOPATHY'],
    substituteIds: ['goblet_squat', 'bulgarian_split_squat', 'glute_bridge_hamstring_walkout'],
    isBodyweight: false,
    movementType: 'LOWER_COMPOUND',
    defaultStarterLoadRatio: 0.65,
  },
  {
    exerciseId: 'goblet_squat',
    exerciseName: 'Goblet Squat (Tempo Focus)',
    aliases: ['goblet squat (tempo focus)', 'goblet squat', 'dumbbell goblet squat'],
    muscleGroup: 'LEGS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: ['PATELLAR_TENDINOPATHY'],
    substituteIds: ['glute_bridge_hamstring_walkout', 'dumbbell_rdl'],
    isBodyweight: false,
    movementType: 'LOWER_COMPOUND',
    defaultStarterLoadRatio: 0.25,
  },
  {
    exerciseId: 'bulgarian_split_squat',
    exerciseName: 'Dumbbell Bulgarian Split Squat',
    aliases: ['dumbbell bulgarian split squat', 'bulgarian split squat', 'split squat'],
    muscleGroup: 'LEGS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: ['PATELLAR_TENDINOPATHY'],
    substituteIds: ['glute_bridge_hamstring_walkout', 'dumbbell_hip_thrust'],
    isBodyweight: false,
    movementType: 'LOWER_COMPOUND',
    defaultStarterLoadRatio: 0.25,
  },
  {
    exerciseId: 'romanian_deadlift',
    exerciseName: 'Romanian Deadlift',
    aliases: ['romanian deadlift', 'barbell romanian deadlift', 'rdl'],
    muscleGroup: 'LEGS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM'],
    contraindicatedLimitations: ['LOWER_BACK_DISC_HERNIATION'],
    substituteIds: ['dumbbell_rdl', 'glute_bridge_hamstring_walkout', 'lying_hamstring_curl'],
    isBodyweight: false,
    movementType: 'LOWER_COMPOUND',
    defaultStarterLoadRatio: 0.6,
  },
  {
    exerciseId: 'dumbbell_rdl',
    exerciseName: 'Dumbbell Romanian Deadlift',
    aliases: ['dumbbell romanian deadlift', 'db rdl'],
    muscleGroup: 'LEGS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: ['LOWER_BACK_DISC_HERNIATION'],
    substituteIds: ['glute_bridge_hamstring_walkout', 'dumbbell_hip_thrust'],
    isBodyweight: false,
    movementType: 'LOWER_COMPOUND',
    defaultStarterLoadRatio: 0.4,
  },
  {
    exerciseId: 'leg_press',
    exerciseName: 'Leg Press',
    aliases: ['leg press', 'machine leg press', '45-degree leg press'],
    muscleGroup: 'LEGS',
    requiredEquipment: ['FULL_GYM'],
    contraindicatedLimitations: ['PATELLAR_TENDINOPATHY'],
    substituteIds: ['bulgarian_split_squat', 'goblet_squat', 'dumbbell_hip_thrust'],
    isBodyweight: false,
    movementType: 'LOWER_COMPOUND',
    defaultStarterLoadRatio: 0.9,
  },
  {
    exerciseId: 'lying_hamstring_curl',
    exerciseName: 'Lying Hamstring Curl',
    aliases: ['lying hamstring curl', 'machine hamstring curl', 'leg curl'],
    muscleGroup: 'LEGS',
    requiredEquipment: ['FULL_GYM'],
    contraindicatedLimitations: [],
    substituteIds: ['dumbbell_hamstring_curl', 'glute_bridge_hamstring_walkout'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.35,
  },
  {
    exerciseId: 'dumbbell_hamstring_curl',
    exerciseName: 'Dumbbell Lying Hamstring Curl',
    aliases: ['dumbbell lying hamstring curl', 'dumbbell hamstring curl'],
    muscleGroup: 'LEGS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: [],
    substituteIds: ['glute_bridge_hamstring_walkout'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.2,
  },
  {
    exerciseId: 'dumbbell_hip_thrust',
    exerciseName: 'Dumbbell Glute Bridge / Hip Thrust',
    aliases: ['dumbbell glute bridge / hip thrust', 'dumbbell hip thrust', 'hip thrust'],
    muscleGroup: 'LEGS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: [],
    substituteIds: ['glute_bridge_hamstring_walkout'],
    isBodyweight: false,
    movementType: 'LOWER_COMPOUND',
    defaultStarterLoadRatio: 0.4,
  },
  {
    exerciseId: 'glute_bridge_hamstring_walkout',
    exerciseName: 'Bodyweight Glute Bridge Walkout',
    aliases: ['bodyweight glute bridge walkout', 'glute bridge walkout', 'glute bridge'],
    muscleGroup: 'LEGS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: [],
    substituteIds: [],
    isBodyweight: true,
    movementType: 'CORE_BODYWEIGHT',
    defaultStarterLoadRatio: 0,
  },

  // ─── CORE ─────────────────────────────────────────────────────────────────
  {
    exerciseId: 'hanging_leg_raise',
    exerciseName: 'Hanging Leg Raise',
    aliases: ['hanging leg raise', 'leg raise'],
    muscleGroup: 'CORE',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: ['LEFT_SHOULDER_IMPINGEMENT', 'RIGHT_SHOULDER_IMPINGEMENT', 'WRIST_STRAIN'],
    substituteIds: ['dead_bug_core_brace', 'plank_core_hold'],
    isBodyweight: true,
    movementType: 'CORE_BODYWEIGHT',
    defaultStarterLoadRatio: 0,
  },
  {
    exerciseId: 'dead_bug_core_brace',
    exerciseName: 'Controlled Dead Bug Core Brace',
    aliases: ['controlled dead bug core brace', 'dead bug'],
    muscleGroup: 'CORE',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: [],
    substituteIds: ['plank_core_hold'],
    isBodyweight: true,
    movementType: 'CORE_BODYWEIGHT',
    defaultStarterLoadRatio: 0,
  },
  {
    exerciseId: 'plank_core_hold',
    exerciseName: 'Forearm Plank Brace',
    aliases: ['forearm plank brace', 'plank'],
    muscleGroup: 'CORE',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: [],
    substituteIds: [],
    isBodyweight: true,
    movementType: 'CORE_BODYWEIGHT',
    defaultStarterLoadRatio: 0,
  },

  // ─── BACK ─────────────────────────────────────────────────────────────────
  {
    exerciseId: 'conventional_deadlift',
    exerciseName: 'Conventional Deadlift',
    aliases: ['conventional deadlift', 'barbell deadlift', 'deadlift'],
    muscleGroup: 'BACK',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM'],
    contraindicatedLimitations: ['LOWER_BACK_DISC_HERNIATION'],
    substituteIds: ['chest_supported_row', 'single_arm_db_row', 'cable_seated_row'],
    isBodyweight: false,
    movementType: 'LOWER_COMPOUND',
    defaultStarterLoadRatio: 0.75,
  },
  {
    exerciseId: 'chest_supported_row',
    exerciseName: 'Chest-Supported Row',
    aliases: ['chest-supported row', 'incline bench dumbbell row', 'chest supported dumbbell row'],
    muscleGroup: 'BACK',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: [],
    substituteIds: ['single_arm_db_row', 'cable_seated_row'],
    isBodyweight: false,
    movementType: 'UPPER_COMPOUND',
    defaultStarterLoadRatio: 0.4,
  },
  {
    exerciseId: 'single_arm_db_row',
    exerciseName: 'Bench-Supported Single-Arm Dumbbell Row',
    aliases: ['bench-supported single-arm dumbbell row', 'single arm dumbbell row', 'dumbbell row'],
    muscleGroup: 'BACK',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: [],
    substituteIds: ['cable_seated_row'],
    isBodyweight: false,
    movementType: 'UPPER_COMPOUND',
    defaultStarterLoadRatio: 0.35,
  },
  {
    exerciseId: 'lat_pulldown',
    exerciseName: 'Lat Pulldown',
    aliases: ['lat pulldown', 'cable lat pulldown'],
    muscleGroup: 'BACK',
    requiredEquipment: ['FULL_GYM', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: ['LEFT_SHOULDER_IMPINGEMENT', 'RIGHT_SHOULDER_IMPINGEMENT'],
    substituteIds: ['single_arm_db_row', 'dumbbell_pullover', 'cable_seated_row'],
    isBodyweight: false,
    movementType: 'UPPER_COMPOUND',
    defaultStarterLoadRatio: 0.5,
  },
  {
    exerciseId: 'dumbbell_pullover',
    exerciseName: 'Dumbbell Lat Pullover',
    aliases: ['dumbbell lat pullover', 'dumbbell pullover'],
    muscleGroup: 'BACK',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: ['LEFT_SHOULDER_IMPINGEMENT', 'RIGHT_SHOULDER_IMPINGEMENT'],
    substituteIds: ['single_arm_db_row'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.25,
  },
  {
    exerciseId: 'cable_seated_row',
    exerciseName: 'Neutral-Grip Seated Cable Row',
    aliases: ['neutral-grip seated cable row', 'seated cable row', 'bodyweight inverted row'],
    muscleGroup: 'BACK',
    requiredEquipment: ['FULL_GYM', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: [],
    substituteIds: ['single_arm_db_row'],
    isBodyweight: false,
    movementType: 'UPPER_COMPOUND',
    defaultStarterLoadRatio: 0.45,
  },

  // ─── CHEST ────────────────────────────────────────────────────────────────
  {
    exerciseId: 'barbell_incline_bench',
    exerciseName: 'Barbell Incline Bench Press',
    aliases: ['barbell incline bench press', 'incline bench press', 'barbell bench press'],
    muscleGroup: 'CHEST',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM'],
    contraindicatedLimitations: ['LEFT_SHOULDER_IMPINGEMENT', 'RIGHT_SHOULDER_IMPINGEMENT', 'WRIST_STRAIN'],
    substituteIds: ['dumbbell_neutral_incline_press', 'dumbbell_flat_bench', 'push_up_variation'],
    isBodyweight: false,
    movementType: 'UPPER_COMPOUND',
    defaultStarterLoadRatio: 0.55,
  },
  {
    exerciseId: 'dumbbell_neutral_incline_press',
    exerciseName: 'Dumbbell Neutral Incline Press',
    aliases: ['dumbbell neutral incline press', 'dumbbell incline bench press', 'neutral grip dumbbell press'],
    muscleGroup: 'CHEST',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: [],
    substituteIds: ['dumbbell_floor_press', 'push_up_variation'],
    isBodyweight: false,
    movementType: 'UPPER_COMPOUND',
    defaultStarterLoadRatio: 0.4,
  },
  {
    exerciseId: 'dumbbell_flat_bench',
    exerciseName: 'Dumbbell Flat Bench Press',
    aliases: ['dumbbell flat bench press', 'db bench press'],
    muscleGroup: 'CHEST',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: ['LEFT_SHOULDER_IMPINGEMENT', 'RIGHT_SHOULDER_IMPINGEMENT'],
    substituteIds: ['dumbbell_floor_press', 'dumbbell_neutral_incline_press', 'push_up_variation'],
    isBodyweight: false,
    movementType: 'UPPER_COMPOUND',
    defaultStarterLoadRatio: 0.45,
  },
  {
    exerciseId: 'dumbbell_floor_press',
    exerciseName: 'Neutral-Grip Dumbbell Floor Press',
    aliases: ['neutral-grip dumbbell floor press', 'dumbbell floor press'],
    muscleGroup: 'CHEST',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: [],
    substituteIds: ['push_up_variation'],
    isBodyweight: false,
    movementType: 'UPPER_COMPOUND',
    defaultStarterLoadRatio: 0.4,
  },
  {
    exerciseId: 'push_up_variation',
    exerciseName: 'Controlled Push-Up',
    aliases: ['controlled push-up', 'deficit push-up', 'push-up'],
    muscleGroup: 'CHEST',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: ['WRIST_STRAIN'],
    substituteIds: ['cable_chest_press'],
    isBodyweight: true,
    movementType: 'CORE_BODYWEIGHT',
    defaultStarterLoadRatio: 0,
  },
  {
    exerciseId: 'cable_chest_press',
    exerciseName: 'Standing Cable Chest Press',
    aliases: ['standing cable chest press', 'cable chest flye'],
    muscleGroup: 'CHEST',
    requiredEquipment: ['FULL_GYM', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: [],
    substituteIds: ['dumbbell_neutral_incline_press'],
    isBodyweight: false,
    movementType: 'UPPER_COMPOUND',
    defaultStarterLoadRatio: 0.35,
  },

  // ─── SHOULDERS ────────────────────────────────────────────────────────────
  {
    exerciseId: 'cable_lateral_raise',
    exerciseName: 'Cable Lateral Raise',
    aliases: ['cable lateral raise'],
    muscleGroup: 'SHOULDERS',
    requiredEquipment: ['FULL_GYM', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: ['LEFT_SHOULDER_IMPINGEMENT', 'RIGHT_SHOULDER_IMPINGEMENT'],
    substituteIds: ['dumbbell_lateral_raise', 'rear_delt_db_flye', 'cable_face_pull'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.15,
  },
  {
    exerciseId: 'dumbbell_lateral_raise',
    exerciseName: 'Dumbbell Lateral Raise',
    aliases: ['dumbbell lateral raise', 'side lateral raise'],
    muscleGroup: 'SHOULDERS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: ['LEFT_SHOULDER_IMPINGEMENT', 'RIGHT_SHOULDER_IMPINGEMENT'],
    substituteIds: ['rear_delt_db_flye'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.15,
  },
  {
    exerciseId: 'cable_face_pull',
    exerciseName: 'Cable Face Pull',
    aliases: ['cable face pull', 'face pull'],
    muscleGroup: 'SHOULDERS',
    requiredEquipment: ['FULL_GYM', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: [],
    substituteIds: ['rear_delt_db_flye'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.2,
  },
  {
    exerciseId: 'rear_delt_db_flye',
    exerciseName: 'Chest-Supported Rear Delt Dumbbell Flye',
    aliases: ['chest-supported rear delt dumbbell flye', 'rear delt flye', 'dumbbell face pull'],
    muscleGroup: 'SHOULDERS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: [],
    substituteIds: ['cable_face_pull'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.14,
  },

  // ─── ARMS ─────────────────────────────────────────────────────────────────
  {
    exerciseId: 'incline_db_bicep_curl',
    exerciseName: 'Incline DB Bicep Curl',
    aliases: ['incline db bicep curl', 'dumbbell bicep curl'],
    muscleGroup: 'ARMS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: ['WRIST_STRAIN'],
    substituteIds: ['neutral_hammer_curl', 'cable_rope_hammer_curl'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.2,
  },
  {
    exerciseId: 'neutral_hammer_curl',
    exerciseName: 'Neutral-Grip Dumbbell Hammer Curl',
    aliases: ['neutral-grip dumbbell hammer curl', 'hammer curl'],
    muscleGroup: 'ARMS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: [],
    substituteIds: ['cable_rope_hammer_curl'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.2,
  },
  {
    exerciseId: 'cable_rope_hammer_curl',
    exerciseName: 'Cable Rope Hammer Curl',
    aliases: ['cable rope hammer curl'],
    muscleGroup: 'ARMS',
    requiredEquipment: ['FULL_GYM', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: [],
    substituteIds: ['neutral_hammer_curl'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.22,
  },
  {
    exerciseId: 'tricep_rope_pushdown',
    exerciseName: 'Tricep Rope Pushdown',
    aliases: ['tricep rope pushdown', 'cable tricep pushdown'],
    muscleGroup: 'ARMS',
    requiredEquipment: ['FULL_GYM', 'BODYWEIGHT_CABLES'],
    contraindicatedLimitations: [],
    substituteIds: ['dumbbell_tricep_kickback', 'dumbbell_overhead_tricep_ext'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.22,
  },
  {
    exerciseId: 'dumbbell_tricep_kickback',
    exerciseName: 'Chest-Supported Dumbbell Tricep Extension',
    aliases: ['chest-supported dumbbell tricep extension', 'dumbbell tricep kickback', 'dumbbell tricep extension'],
    muscleGroup: 'ARMS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: [],
    substituteIds: ['tricep_rope_pushdown'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.16,
  },
  {
    exerciseId: 'dumbbell_overhead_tricep_ext',
    exerciseName: 'Neutral-Grip Dumbbell Overhead Tricep Extension',
    aliases: ['neutral-grip dumbbell overhead tricep extension', 'overhead tricep extension'],
    muscleGroup: 'ARMS',
    requiredEquipment: ['FULL_GYM', 'BARBELL_DUMBBELL', 'HOME_GYM', 'DUMBBELL_ONLY'],
    contraindicatedLimitations: ['LEFT_SHOULDER_IMPINGEMENT', 'RIGHT_SHOULDER_IMPINGEMENT'],
    substituteIds: ['dumbbell_tricep_kickback'],
    isBodyweight: false,
    movementType: 'ISOLATION',
    defaultStarterLoadRatio: 0.18,
  },
];

/**
 * Legacy blacklist export preserved for compatibility.
 */
export const INJURY_CONTRAINDICATIONS: Record<string, string[]> = {
  LEFT_SHOULDER_IMPINGEMENT: [
    'Barbell Overhead Press',
    'Behind-the-Neck Press',
    'Upright Row',
    'Dips',
    'Barbell Incline Bench Press',
    'Dumbbell Flat Bench Press',
    'Lat Pulldown',
    'Cable Lateral Raise',
    'Dumbbell Lateral Raise',
    'Hanging Leg Raise',
  ],
  RIGHT_SHOULDER_IMPINGEMENT: [
    'Barbell Overhead Press',
    'Behind-the-Neck Press',
    'Upright Row',
    'Dips',
    'Barbell Incline Bench Press',
    'Dumbbell Flat Bench Press',
    'Lat Pulldown',
    'Cable Lateral Raise',
    'Dumbbell Lateral Raise',
    'Hanging Leg Raise',
  ],
  LOWER_BACK_DISC_HERNIATION: [
    'Conventional Deadlift',
    'Barbell Back Squat',
    'Heavy Back Squat',
    'Romanian Deadlift',
    'Dumbbell Romanian Deadlift',
    'Barbell Bent-Over Row',
    'Good Mornings',
  ],
  PATELLAR_TENDINOPATHY: [
    'Barbell Back Squat',
    'Goblet Squat',
    'Leg Press',
    'Bulgarian Split Squat',
    'Leg Extension',
    'Deep Jump Squats',
    'Sissy Squats',
    'Lunges with Forward Knee Drift',
  ],
  WRIST_STRAIN: [
    'Straight Bar Bicep Curl',
    'Incline DB Bicep Curl',
    'Barbell Incline Bench Press',
    'Heavy Front Squat',
    'Handstand Pushup',
    'Hanging Leg Raise',
    'Controlled Push-Up',
  ],
};

export function normalizeEquipment(equipment: AvailableEquipment | string): AvailableEquipment {
  if (equipment === 'HOME_GYM') return 'BARBELL_DUMBBELL';
  if (
    equipment === 'FULL_GYM' ||
    equipment === 'BARBELL_DUMBBELL' ||
    equipment === 'DUMBBELL_ONLY' ||
    equipment === 'BODYWEIGHT_CABLES'
  ) {
    return equipment;
  }
  return 'FULL_GYM';
}

export function findCatalogExercise(idOrName: string): ExerciseCatalogItem | undefined {
  const clean = (idOrName || '').trim().toLowerCase();
  if (!clean) return undefined;
  // Pass 1: exact ID, exact name, or exact alias match
  const exact = EXERCISE_CATALOG.find(
    (item) =>
      item.exerciseId.toLowerCase() === clean ||
      item.exerciseName.toLowerCase() === clean ||
      item.aliases.some((a) => a === clean)
  );
  if (exact) return exact;

  // Pass 2: substring alias match
  return EXERCISE_CATALOG.find((item) => item.aliases.some((a) => clean.includes(a)));
}

export function isExerciseCompatible(
  item: ExerciseCatalogItem,
  equipment: AvailableEquipment,
  activeLimitations: string[]
): { compatible: boolean; failedLimitation?: string; failedEquipment?: boolean } {
  const normEquip = normalizeEquipment(equipment);

  for (const lim of activeLimitations) {
    if (item.contraindicatedLimitations.includes(lim)) {
      return { compatible: false, failedLimitation: lim };
    }
  }

  if (!item.requiredEquipment.includes(normEquip) && !item.requiredEquipment.includes(equipment)) {
    return { compatible: false, failedEquipment: true };
  }

  return { compatible: true };
}

/**
 * Resolves an exercise against both equipment and active limitations,
 * re-checking all constraints on every candidate substitute so the final
 * resolved exercise is guaranteed executable and never an "A or B" choice string.
 */
export function resolveSafeExercise(
  idOrName: string,
  equipment: AvailableEquipment = 'FULL_GYM',
  activeLimitations: string[] = [],
  alreadyChosenIds: Set<string> = new Set()
): {
  exercise: ExerciseCatalogItem;
  wasSubstituted: boolean;
  substitutionReason?: string;
  unknownLimitations: string[];
} {
  const normEquip = normalizeEquipment(equipment);
  const unknownLimitations = activeLimitations.filter((lim) => !KNOWN_LIMITATIONS.has(lim));
  const initialItem =
    findCatalogExercise(idOrName) ||
    EXERCISE_CATALOG.find((e) => isExerciseCompatible(e, normEquip, activeLimitations).compatible) ||
    EXERCISE_CATALOG[0];

  const initialCheck = isExerciseCompatible(initialItem, normEquip, activeLimitations);
  if (initialCheck.compatible && !alreadyChosenIds.has(initialItem.exerciseId)) {
    return {
      exercise: initialItem,
      wasSubstituted: false,
      unknownLimitations,
    };
  }

  // Build ordered candidate queue: direct substituteIds -> substitutes' substitutes -> same muscleGroup -> any safe
  const candidateIds: string[] = [...initialItem.substituteIds];
  for (const subId of initialItem.substituteIds) {
    const subItem = EXERCISE_CATALOG.find((e) => e.exerciseId === subId);
    if (subItem) {
      for (const nestedId of subItem.substituteIds) {
        if (!candidateIds.includes(nestedId)) candidateIds.push(nestedId);
      }
    }
  }
  for (const item of EXERCISE_CATALOG) {
    if (item.muscleGroup === initialItem.muscleGroup && !candidateIds.includes(item.exerciseId)) {
      candidateIds.push(item.exerciseId);
    }
  }
  for (const item of EXERCISE_CATALOG) {
    if (!candidateIds.includes(item.exerciseId)) {
      candidateIds.push(item.exerciseId);
    }
  }

  let selectedItem: ExerciseCatalogItem | undefined;
  // Pass 1: find compatible item not yet chosen in this session
  for (const candId of candidateIds) {
    const cand = EXERCISE_CATALOG.find((e) => e.exerciseId === candId);
    if (!cand || alreadyChosenIds.has(cand.exerciseId)) continue;
    if (isExerciseCompatible(cand, normEquip, activeLimitations).compatible) {
      selectedItem = cand;
      break;
    }
  }
  // Pass 2: if all compatible items for that slot were already chosen, pick any compatible item
  if (!selectedItem) {
    for (const candId of candidateIds) {
      const cand = EXERCISE_CATALOG.find((e) => e.exerciseId === candId);
      if (!cand) continue;
      if (isExerciseCompatible(cand, normEquip, activeLimitations).compatible) {
        selectedItem = cand;
        break;
      }
    }
  }

  const resolved = selectedItem || initialItem;
  const reasons: string[] = [];
  if (initialCheck.failedLimitation) {
    reasons.push(`limitation [${initialCheck.failedLimitation}]`);
  }
  if (initialCheck.failedEquipment) {
    reasons.push(`equipment [${equipment}]`);
  }
  if (!initialCheck.failedLimitation && !initialCheck.failedEquipment && alreadyChosenIds.has(initialItem.exerciseId)) {
    reasons.push('avoiding duplicate exercise in session');
  }

  const wasSubstituted = resolved.exerciseId !== initialItem.exerciseId;
  const substitutionReason = wasSubstituted
    ? `Replaced [${initialItem.exerciseName}] with [${resolved.exerciseName}] for ${reasons.join(' & ')}`
    : undefined;

  return {
    exercise: resolved,
    wasSubstituted,
    substitutionReason,
    unknownLimitations,
  };
}

/**
 * Filter exercises matching active athlete limitations (backed by structured catalog).
 */
export function filterExercisesForInjuries(
  exerciseName: string,
  activeLimitations: string[]
): { isSafe: boolean; contraindicationReason?: string; alternativeSuggestion?: string; resolvedExerciseId?: string } {
  const catalogItem = findCatalogExercise(exerciseName);
  if (catalogItem) {
    const check = isExerciseCompatible(catalogItem, 'FULL_GYM', activeLimitations);
    if (!check.compatible && check.failedLimitation) {
      const resolved = resolveSafeExercise(catalogItem.exerciseId, 'FULL_GYM', activeLimitations);
      return {
        isSafe: false,
        contraindicationReason: `Excluded due to active limitation: [${check.failedLimitation}]`,
        alternativeSuggestion: resolved.exercise.exerciseName,
        resolvedExerciseId: resolved.exercise.exerciseId,
      };
    }
  }

  for (const limitation of activeLimitations) {
    const contraindicated = INJURY_CONTRAINDICATIONS[limitation] || [];
    if (contraindicated.some((ex) => exerciseName.toLowerCase().includes(ex.toLowerCase()))) {
      const resolved = resolveSafeExercise(exerciseName, 'FULL_GYM', activeLimitations);
      return {
        isSafe: false,
        contraindicationReason: `Excluded due to active limitation: [${limitation}]`,
        alternativeSuggestion: resolved.exercise.exerciseName,
        resolvedExerciseId: resolved.exercise.exerciseId,
      };
    }
  }

  return { isSafe: true };
}

/**
 * Substitutes exercises if equipment is unavailable (backed by structured catalog).
 */
export function filterExerciseForEquipment(
  exerciseName: string,
  equipment: AvailableEquipment
): { isSafe: boolean; alternativeSuggestion?: string; reason?: string; resolvedExerciseId?: string } {
  const normEquip = normalizeEquipment(equipment);
  const catalogItem = findCatalogExercise(exerciseName);

  if (catalogItem) {
    const check = isExerciseCompatible(catalogItem, normEquip, []);
    if (!check.compatible) {
      const resolved = resolveSafeExercise(catalogItem.exerciseId, normEquip, []);
      return {
        isSafe: false,
        alternativeSuggestion: resolved.exercise.exerciseName,
        resolvedExerciseId: resolved.exercise.exerciseId,
        reason: `Adjusted for ${equipment} equipment setup`,
      };
    }
    return { isSafe: true, resolvedExerciseId: catalogItem.exerciseId };
  }

  // Fallback for custom exercise strings not in catalog
  const lower = exerciseName.toLowerCase();
  if (normEquip === 'DUMBBELL_ONLY') {
    if (
      lower.includes('barbell') ||
      lower.includes('machine') ||
      lower.includes('cable') ||
      lower.includes('leg press') ||
      lower.includes('pulldown')
    ) {
      const resolved = resolveSafeExercise('goblet_squat', normEquip, []);
      return {
        isSafe: false,
        alternativeSuggestion: resolved.exercise.exerciseName,
        resolvedExerciseId: resolved.exercise.exerciseId,
        reason: 'Adjusted for Dumbbell-Only equipment setup',
      };
    }
  }

  if (normEquip === 'BARBELL_DUMBBELL') {
    if (lower.includes('machine') || lower.includes('cable') || lower.includes('leg press') || lower.includes('pulldown')) {
      const resolved = resolveSafeExercise('bulgarian_split_squat', normEquip, []);
      return {
        isSafe: false,
        alternativeSuggestion: resolved.exercise.exerciseName,
        resolvedExerciseId: resolved.exercise.exerciseId,
        reason: 'Adjusted for Barbell & Dumbbell equipment setup',
      };
    }
  }

  if (normEquip === 'BODYWEIGHT_CABLES') {
    if (lower.includes('barbell') || lower.includes('dumbbell') || lower.includes('leg press')) {
      const resolved = resolveSafeExercise('bulgarian_split_squat', normEquip, []);
      return {
        isSafe: false,
        alternativeSuggestion: resolved.exercise.exerciseName,
        resolvedExerciseId: resolved.exercise.exerciseId,
        reason: 'Adjusted for Bodyweight & Cable environment',
      };
    }
  }

  return { isSafe: true };
}
