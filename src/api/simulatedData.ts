/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DailyActivity, DailyHeartRate, DailySleep, NightlyVitals, WorkoutLog, WeightRecord, HealthDataStore } from "../types";

/**
 * Helper to generate dates looking backward from today.
 */
function getDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
}

/**
 * Generates intraday cardiac points (every 30 mins) with circadian fluctuations:
 * - Low resting rates during early morning sleep (3 AM - 6 AM)
 * - Gradual rise during morning activity
 * - Moderate levels during day with potential exercise spikes
 * - Slow decline in the evening
 */
export function generateIntradayHeartRate(dateStr: string, baseResting: number): { time: string; bpm: number }[] {
  const points: { time: string; bpm: number }[] = [];
  const seed = dateStr.split("-").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Exercise peak around 5 PM (17:00)
  const workoutHour = 17;
  
  for (let hour = 0; hour < 24; hour++) {
    for (let min of [0, 30]) {
      const timeStr = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
      let bpm = baseResting;

      if (hour >= 0 && hour < 6) {
        // Sleep state: lower heart rate
        const sleepDip = 8 - Math.sin((hour + min / 60) * Math.PI / 6) * 4;
        bpm = baseResting - Math.round(sleepDip);
      } else if (hour === workoutHour) {
        // Workout hour: peak heart rate with randomness
        const randomWorkFactor = (seed % 10) + 50; 
        bpm = baseResting + randomWorkFactor + Math.round(Math.random() * 20);
      } else if (hour >= 7 && hour < 21) {
        // Daytime awake rate: slightly higher than resting
        const circadianAdd = Math.sin((hour - 7) * Math.PI / 14) * 12;
        const smallNoise = (seed + hour + min) % 5;
        bpm = baseResting + Math.round(circadianAdd) + smallNoise;
      } else {
        // Evening wind-down
        const eveningDip = Math.cos((hour - 21) * Math.PI / 6) * 4;
        bpm = baseResting + Math.round(eveningDip);
      }

      points.push({ time: timeStr, bpm: Math.max(40, bpm) });
    }
  }

  return points;
}

/**
 * Builds a highly realistic 90-day simulation of all Fitbit Charge 6 metrics.
 */
export function generate90DayHealthData(): HealthDataStore {
  const activities: DailyActivity[] = [];
  const heartRates: DailyHeartRate[] = [];
  const sleeps: DailySleep[] = [];
  const vitals: NightlyVitals[] = [];
  const workouts: WorkoutLog[] = [];
  const weights: WeightRecord[] = [];

  // Static workout options
  const workoutTypes = [
    { type: "Run", duration: 35, caloriesFactor: 11, avgHr: 152 },
    { type: "HIIT", duration: 25, caloriesFactor: 13, avgHr: 161 },
    { type: "Walk", duration: 50, caloriesFactor: 5, avgHr: 112 },
    { type: "Yoga", duration: 45, caloriesFactor: 3.5, avgHr: 98 },
    { type: "Weights", duration: 40, caloriesFactor: 6.5, avgHr: 124 },
  ];

  let currentWeight = 78.5; // Sturdy start weight

  for (let idx = 89; idx >= 0; idx--) {
    const dateStr = getDateString(idx);
    
    // Deterministic random seed based on date string to keep loads consistent
    const seed = dateStr.split("-").reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // 1. Activity Generator
    const stepCount = 5000 + (seed % 9) * 1000 + Math.round((seed % 7) * 120) + (idx % 7 === 0 ? 3000 : 0);
    const distance = parseFloat((stepCount * 0.00078).toFixed(2));
    const activeZone = Math.round(stepCount / 200) + (seed % 4) * 8;
    const calories = 1750 + Math.round(stepCount * 0.055) + (activeZone * 2);
    const floors = Math.round((seed % 6) * 2 + (stepCount / 1800));

    activities.push({
      date: dateStr,
      steps: stepCount,
      distanceKm: distance,
      floors: floors,
      caloriesBurned: calories,
      activeZoneMinutes: activeZone,
    });

    // 2. Heart Rate Generator
    const restingHr = 58 + (seed % 9); // rhr fluctuates between 58 and 66
    heartRates.push({
      date: dateStr,
      restingHeartRate: restingHr,
      intraday: generateIntradayHeartRate(dateStr, restingHr),
    });

    // 3. Sleep Generator
    const duration = 380 + (seed % 17) * 9 - (idx % 5 === 0 ? 60 : 0); // 320 to 533 mins (approx 5.3 to 9 hrs)
    const sleepScore = Math.max(50, Math.min(98, Math.round(55 + (duration / 10) + (seed % 10) - (idx % 11 === 0 ? 12 : 0))));
    
    // Split sleep stage percentages cleanly
    const deepPct = 12 + (seed % 6); // 12% - 17%
    const remPct = 18 + (seed % 7);  // 18% - 24%
    const awakePct = 8 + (seed % 5); // 8% - 12%
    const lightPct = 100 - deepPct - remPct - awakePct;

    sleeps.push({
      date: dateStr,
      durationMinutes: duration,
      sleepScore: sleepScore,
      stages: {
        deepMinutes: Math.round(duration * (deepPct / 100)),
        lightMinutes: Math.round(duration * (lightPct / 100)),
        remMinutes: Math.round(duration * (remPct / 100)),
        awakeMinutes: Math.round(duration * (awakePct / 100)),
      },
    });

    // 4. Nightly Vitals Generator
    const spo2 = parseFloat((94.5 + (seed % 45) * 0.1).toFixed(1)); // 94.5% - 99.0%
    const breathing = parseFloat((12.5 + (seed % 28) * 0.1).toFixed(1)); // 12.5 - 15.3 breaths/min
    const hrv = 34 + (seed % 42); // 34 - 75 ms
    const skinTempVar = parseFloat((-0.6 + (seed % 13) * 0.1).toFixed(1)); // -0.6°C to +0.6°C

    vitals.push({
      date: dateStr,
      spo2: spo2,
      breathingRate: breathing,
      hrv: hrv,
      skinTempVariation: skinTempVar,
    });

    // 5. Workout Logs (Intermittent: approx. every 2-3 days)
    if (seed % 3 === 0) {
      const workoutOption = workoutTypes[seed % workoutTypes.length];
      const workoutDuration = workoutOption.duration + (idx % 15) - 7;
      const workoutCal = Math.round(workoutDuration * workoutOption.caloriesFactor);
      const workoutHr = workoutOption.avgHr + (seed % 7) - 3;
      
      workouts.push({
        id: `workout_${dateStr}_${seed}`,
        date: `${dateStr} 17:00`,
        type: workoutOption.type,
        durationMinutes: workoutDuration,
        avgHeartRate: workoutHr,
        calories: workoutCal,
      });
    }

    // 6. Weight records (once a week)
    if (idx % 7 === 0) {
      // Steady general reduction with slight oscillation
      const weightVar = (seed % 100) / 400 - 0.125; // -0.125 to +0.125 kg fluctuation
      currentWeight = parseFloat((currentWeight - 0.12 + weightVar).toFixed(1));
      weights.push({
        date: dateStr,
        weightKg: currentWeight,
      });
    }
  }

  return {
    activities,
    heartRates,
    sleeps,
    vitals,
    workouts: workouts.reverse(),
    weights: weights.reverse(),
    lastSyncTime: new Date().toISOString(),
  };
}
