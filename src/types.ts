/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  steps: number;
  distanceKm: number;
  floors: number;
  caloriesBurned: number;
  activeZoneMinutes: number;
}

export interface IntradayHeartRatePoint {
  time: string; // HH:MM
  bpm: number;
}

export interface DailyHeartRate {
  date: string; // YYYY-MM-DD
  restingHeartRate: number;
  intraday: IntradayHeartRatePoint[];
}

export interface SleepStageBreakdown {
  deepMinutes: number;
  lightMinutes: number;
  remMinutes: number;
  awakeMinutes: number;
}

export interface DailySleep {
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  sleepScore: number; // 0-100
  stages: SleepStageBreakdown;
}

export interface NightlyVitals {
  date: string; // YYYY-MM-DD
  spo2: number; // percentage (e.g., 95.8)
  breathingRate: number; // breaths per minute (e.g., 14.2)
  hrv: number; // deep sleep HRV (ms, e.g., 54)
  skinTempVariation: number; // °C variation compared to baseline (e.g., -0.2)
}

export interface WorkoutLog {
  id: string;
  date: string; // YYYY-MM-DD HH:MM
  type: string; // 'Run', 'Walk', 'Cycle', 'Swim', 'HIIT', 'Yoga', 'Weights'
  durationMinutes: number;
  avgHeartRate: number;
  calories: number;
}

export interface WeightRecord {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

export interface HealthDataStore {
  activities: DailyActivity[];
  heartRates: DailyHeartRate[];
  sleeps: DailySleep[];
  vitals: NightlyVitals[];
  workouts: WorkoutLog[];
  weights: WeightRecord[];
  lastSyncTime: string | null;
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // epoch ms
  scopes: string[];
}
