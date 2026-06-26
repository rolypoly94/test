/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Fitbit Google Takeout parser.
 *
 * Fitbit Takeout structure (Takeout/Fitbit/...):
 *   Physical Activity/
 *     steps-YYYY-MM-DD.json          [{dateTime, value}]   (intraday, 1/min)
 *     calories-YYYY-MM-DD.json       [{dateTime, value}]   (intraday, 1/min)
 *     distance-YYYY-MM-DD.json       [{dateTime, value}]   (intraday, 1/min, km)
 *     floors-YYYY-MM-DD.json         [{dateTime, value}]   (intraday, 1/min)
 *     active_zone_minutes-*.json     [{dateTime, value}]   (intraday or daily)
 *   Heart Rate/
 *     heart_rate-YYYY-MM-DD.json     [{dateTime, value:{bpm,confidence}}]  (intraday, 1/5s)
 *   Sleep/
 *     sleep-YYYY-MM-DD.json          [{dateOfSleep, duration, efficiency, minutesAsleep, minutesAwake, levels}]
 *   Body & Weight/
 *     weight-YYYY-MM-DD.json         [{date, time, weight}]   (weight in kg if metric)
 *   Mindfulness/SpO2/
 *     SpO2 - *.csv                   Timestamp,Value
 *   Computed Temperature/
 *     computed_temperature-*.json    [{dateTime, value:{nightlyTemperature}}]
 *   Heart Rate Variability/
 *     hrv_details-YYYY-MM-DD.json    [{dateTime, value:{dailyRmssd}}]
 *   Breathing Rate/
 *     breathing_rate-YYYY-MM-DD.json [{dateTime, value:{breathingRate}}]
 *
 * Memory strategy: files are processed one at a time; raw entries are discarded
 * after aggregation.  Heart-rate intraday detail is only kept for the last 90
 * days (older dates contribute only to the daily resting-HR value).
 */

import type { DailyActivity, DailyHeartRate, DailySleep, NightlyVitals, WeightRecord, HealthDataStore } from "../types";

export interface TakeoutProgress {
  filesScanned: number;
  filesTotal: number;
  status: string;
}
export type ProgressCb = (p: TakeoutProgress) => void;

// ─── tiny helpers ────────────────────────────────────────────────────────────

function toDate(dateTime: string): string {
  return dateTime.slice(0, 10);
}

function n(v: any): number {
  const x = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round(v: number, dec = 0): number {
  const f = 10 ** dec;
  return Math.round(v * f) / f;
}

async function readJson(file: File): Promise<any[]> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

async function readCsv(file: File): Promise<Record<string, string>[]> {
  try {
    const text = await file.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      return obj;
    });
  } catch {
    return [];
  }
}

/** Extract YYYY-MM-DD from a filename like "steps-2023-06-15.json" */
function dateFromFilename(name: string): string | null {
  const m = name.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Is this date within `days` days of today? */
function isRecent(date: string, days: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(date + "T00:00:00Z") >= cutoff;
}

// ─── daily accumulator maps ───────────────────────────────────────────────────

type DailyNum = Map<string, number>;

function addToDate(map: DailyNum, date: string, value: number) {
  map.set(date, (map.get(date) ?? 0) + value);
}

// ─── main export ─────────────────────────────────────────────────────────────

export async function parseFitbitTakeout(
  files: FileList,
  onProgress?: ProgressCb,
): Promise<Partial<HealthDataStore>> {

  const fileArray = Array.from(files);
  const total = fileArray.length;
  let scanned = 0;
  const report = (status: string) => onProgress?.({ filesScanned: scanned, filesTotal: total, status });

  // ── categorise files by name ────────────────────────────────────────────
  const cat = {
    steps: [] as File[],
    calories: [] as File[],
    distance: [] as File[],
    floors: [] as File[],
    azm: [] as File[],
    hr: [] as File[],
    sleep: [] as File[],
    weight: [] as File[],
    spo2Csv: [] as File[],
    temp: [] as File[],
    hrv: [] as File[],
    breathing: [] as File[],
  };

  for (const file of fileArray) {
    const n_ = file.name.toLowerCase();
    if (n_.startsWith("steps-") && n_.endsWith(".json"))                       cat.steps.push(file);
    else if (n_.startsWith("calories-") && n_.endsWith(".json"))               cat.calories.push(file);
    else if (n_.startsWith("distance-") && n_.endsWith(".json"))               cat.distance.push(file);
    else if (n_.startsWith("floors-") && n_.endsWith(".json"))                 cat.floors.push(file);
    else if (n_.startsWith("active_zone_minutes") && n_.endsWith(".json"))     cat.azm.push(file);
    else if (n_.startsWith("heart_rate-") && n_.endsWith(".json"))             cat.hr.push(file);
    else if (n_.startsWith("sleep-") && n_.endsWith(".json"))                  cat.sleep.push(file);
    else if ((n_.startsWith("weight-") || n_.includes("weight")) && n_.endsWith(".json") && !n_.includes("body_fat")) cat.weight.push(file);
    else if ((n_.startsWith("spo2") || n_.includes("spo2") || n_.includes("oxygen")) && n_.endsWith(".csv")) cat.spo2Csv.push(file);
    else if (n_.startsWith("computed_temperature") && n_.endsWith(".json"))    cat.temp.push(file);
    else if (n_.startsWith("hrv_details") && n_.endsWith(".json"))             cat.hrv.push(file);
    else if (n_.startsWith("breathing_rate") && n_.endsWith(".json"))          cat.breathing.push(file);
  }

  // ── activity accumulators ────────────────────────────────────────────────
  const dailySteps:    DailyNum = new Map();
  const dailyCal:      DailyNum = new Map();
  const dailyDist:     DailyNum = new Map();
  const dailyFloors:   DailyNum = new Map();
  const dailyAzm:      DailyNum = new Map();

  report("Parsing step counts…");
  for (const file of cat.steps) {
    scanned++;
    const data = await readJson(file);
    for (const e of data) {
      if (!e.dateTime) continue;
      addToDate(dailySteps, toDate(e.dateTime), n(e.value));
    }
  }

  report("Parsing calorie data…");
  for (const file of cat.calories) {
    scanned++;
    const data = await readJson(file);
    for (const e of data) {
      if (!e.dateTime) continue;
      addToDate(dailyCal, toDate(e.dateTime), n(e.value));
    }
  }

  report("Parsing distance data…");
  for (const file of cat.distance) {
    scanned++;
    const data = await readJson(file);
    for (const e of data) {
      if (!e.dateTime) continue;
      addToDate(dailyDist, toDate(e.dateTime), n(e.value));
    }
  }

  report("Parsing floors data…");
  for (const file of cat.floors) {
    scanned++;
    const data = await readJson(file);
    for (const e of data) {
      if (!e.dateTime) continue;
      addToDate(dailyFloors, toDate(e.dateTime), n(e.value));
    }
  }

  report("Parsing active zone minutes…");
  for (const file of cat.azm) {
    scanned++;
    const data = await readJson(file);
    for (const e of data) {
      if (!e.dateTime) continue;
      let val = 0;
      if (typeof e.value === "object" && e.value !== null) {
        val = n(e.value.activeZoneMinutes ??
          (n(e.value.fatBurnActiveZoneMinutes) + n(e.value.cardioActiveZoneMinutes) + n(e.value.peakActiveZoneMinutes)));
      } else {
        val = n(e.value);
      }
      addToDate(dailyAzm, toDate(e.dateTime), val);
    }
  }

  // ── assemble DailyActivity ───────────────────────────────────────────────
  const activityDates = new Set<string>([
    ...dailySteps.keys(), ...dailyCal.keys(),
    ...dailyDist.keys(), ...dailyFloors.keys(),
  ]);
  const activities: DailyActivity[] = Array.from(activityDates).sort().map((date) => ({
    date,
    steps:            Math.round(dailySteps.get(date) ?? 0),
    distanceKm:       round(dailyDist.get(date) ?? 0, 2),
    floors:           Math.round(dailyFloors.get(date) ?? 0),
    caloriesBurned:   Math.round(dailyCal.get(date) ?? 0),
    activeZoneMinutes: Math.round(dailyAzm.get(date) ?? 0),
  })).filter((a) => a.steps > 0 || a.caloriesBurned > 0);

  // ── heart rate ───────────────────────────────────────────────────────────
  // For recent dates (≤90 days): build 30-min intraday buckets AND resting HR.
  // For older dates: track only early-morning (2–6 AM) values for resting HR.
  // This keeps memory bounded even for 2+ years of 5-second HR data.

  report("Parsing heart rate… (this may take a moment for large exports)");

  type HrAcc = {
    buckets: Map<string, number[]>;   // "HH:MM" -> bpm samples (recent only)
    earlyMorning: number[];           // 2–6 AM bpm values for resting estimate
    recent: boolean;
  };
  const hrAcc = new Map<string, HrAcc>();

  for (const file of cat.hr) {
    scanned++;
    // Infer date from filename to decide whether to build intraday detail
    const fileDate = dateFromFilename(file.name);
    const recent = fileDate ? isRecent(fileDate, 90) : false;
    if (scanned % 30 === 0) report(`Parsing heart rate (${scanned}/${total})…`);

    const data = await readJson(file);
    for (const e of data) {
      if (!e.dateTime || !e.value) continue;
      const dt = e.dateTime as string; // "YYYY-MM-DD HH:MM:SS"
      const date = dt.slice(0, 10);
      const hour = parseInt(dt.slice(11, 13), 10);
      const bpm  = n(typeof e.value === "object" ? e.value.bpm : e.value);
      if (bpm < 30 || bpm > 250) continue;

      if (!hrAcc.has(date)) hrAcc.set(date, { buckets: new Map(), earlyMorning: [], recent });
      const acc = hrAcc.get(date)!;

      // Early-morning resting HR (anyone's file can contribute this)
      if (hour >= 2 && hour < 6) acc.earlyMorning.push(bpm);

      // Intraday detail only for recent dates
      if (acc.recent) {
        const min = parseInt(dt.slice(14, 16), 10);
        const key = `${String(hour).padStart(2, "0")}:${min < 30 ? "00" : "30"}`;
        if (!acc.buckets.has(key)) acc.buckets.set(key, []);
        acc.buckets.get(key)!.push(bpm);
      }
    }
  }

  const heartRates: DailyHeartRate[] = Array.from(hrAcc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, acc]) => {
      const intraday = acc.recent
        ? Array.from(acc.buckets.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([time, bpms]) => ({
              time,
              bpm: Math.round(bpms.reduce((s, v) => s + v, 0) / bpms.length),
            }))
        : [];

      const resting = acc.earlyMorning.length > 0
        ? Math.round(acc.earlyMorning.reduce((s, v) => s + v, 0) / acc.earlyMorning.length)
        : (intraday.length > 0 ? Math.min(...intraday.map((p) => p.bpm)) : 0);

      return { date, restingHeartRate: resting, intraday };
    })
    .filter((hr) => hr.restingHeartRate > 0 || hr.intraday.length > 0);

  // ── sleep ────────────────────────────────────────────────────────────────
  report("Parsing sleep sessions…");
  const sleepByDate = new Map<string, DailySleep>();

  for (const file of cat.sleep) {
    scanned++;
    const data = await readJson(file);
    for (const e of data) {
      const date = e.dateOfSleep as string;
      if (!date) continue;

      const lvl = e.levels?.summary ?? {};
      const deepMin  = n(lvl.deep?.minutes  ?? lvl.DEEP?.minutes  ?? 0);
      const lightMin = n(lvl.light?.minutes ?? lvl.LIGHT?.minutes ?? 0);
      const remMin   = n(lvl.rem?.minutes   ?? lvl.REM?.minutes   ?? 0);
      const wakeMin  = n(lvl.wake?.minutes  ?? lvl.WAKE?.minutes  ?? e.minutesAwake ?? 0);

      // duration: API gives milliseconds in `duration`, or derive from minutesAsleep + awake
      const durationMs = n(e.duration);
      const duration = durationMs > 0
        ? Math.round(durationMs / 60000)
        : (n(e.minutesAsleep) + n(e.minutesAwake));

      const existing = sleepByDate.get(date);
      if (existing && existing.durationMinutes >= duration) continue;

      sleepByDate.set(date, {
        date,
        durationMinutes: duration,
        sleepScore: n(e.efficiency),   // efficiency % is the closest proxy
        stages: { deepMinutes: deepMin, lightMinutes: lightMin, remMinutes: remMin, awakeMinutes: wakeMin },
      });
    }
  }
  const sleeps = Array.from(sleepByDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  // ── weight ───────────────────────────────────────────────────────────────
  report("Parsing weight records…");
  const weightByDate = new Map<string, number>();

  for (const file of cat.weight) {
    scanned++;
    const data = await readJson(file);
    for (const e of data) {
      const date = e.date as string;
      if (!date) continue;
      const kg = n(e.weight);
      // Fitbit exports kg when user's unit is metric; skip implausible values
      if (kg < 20 || kg > 500) continue;
      weightByDate.set(date, round(kg, 1));
    }
  }
  const weights: WeightRecord[] = Array.from(weightByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, weightKg]) => ({ date, weightKg }));

  // ── nightly vitals (SpO2, HRV, breathing rate, skin temp) ───────────────
  const spo2ByDate:      DailyNum = new Map();
  const spo2CountByDate: DailyNum = new Map();
  const hrvByDate:       DailyNum = new Map();
  const breathByDate:    DailyNum = new Map();
  const tempByDate:      DailyNum = new Map();

  report("Parsing SpO2…");
  for (const file of cat.spo2Csv) {
    scanned++;
    const rows = await readCsv(file);
    for (const row of rows) {
      const ts  = row["Timestamp"] ?? row["timestamp"] ?? "";
      const val = n(row["Value"] ?? row["value"] ?? row["SpO2"] ?? row["spo2"] ?? 0);
      if (!ts || val < 80) continue;
      const date = ts.slice(0, 10);
      addToDate(spo2ByDate,      date, val);
      addToDate(spo2CountByDate, date, 1);
    }
  }

  report("Parsing skin temperature…");
  for (const file of cat.temp) {
    scanned++;
    const data = await readJson(file);
    for (const e of data) {
      const date = (e.dateTime as string)?.slice(0, 10);
      if (!date) continue;
      const variation = n(
        e.value?.nightlyTemperature ?? e.value?.tempVariation ?? e.value ?? 0,
      );
      tempByDate.set(date, round(variation, 1));
    }
  }

  report("Parsing heart rate variability…");
  for (const file of cat.hrv) {
    scanned++;
    const data = await readJson(file);
    for (const e of data) {
      const date = (e.dateTime as string)?.slice(0, 10);
      if (!date) continue;
      const rmssd = n(e.value?.dailyRmssd ?? e.value?.deepRmssd ?? e.value ?? 0);
      if (rmssd > 0) hrvByDate.set(date, round(rmssd, 0));
    }
  }

  report("Parsing breathing rate…");
  for (const file of cat.breathing) {
    scanned++;
    const data = await readJson(file);
    for (const e of data) {
      const date = (e.dateTime as string)?.slice(0, 10);
      if (!date) continue;
      const rate = n(e.value?.breathingRate ?? e.value ?? 0);
      if (rate > 0) breathByDate.set(date, round(rate, 1));
    }
  }

  // Assemble NightlyVitals
  const vitalDates = new Set<string>([
    ...spo2ByDate.keys(), ...tempByDate.keys(),
    ...hrvByDate.keys(), ...breathByDate.keys(),
  ]);
  const vitals: NightlyVitals[] = Array.from(vitalDates).sort().map((date) => {
    const count = spo2CountByDate.get(date) ?? 0;
    const spo2avg = count > 0 ? round((spo2ByDate.get(date) ?? 0) / count, 1) : 0;
    return {
      date,
      spo2:             spo2avg,
      breathingRate:    breathByDate.get(date) ?? 0,
      hrv:              hrvByDate.get(date) ?? 0,
      skinTempVariation: tempByDate.get(date) ?? 0,
    };
  }).filter((v) => v.spo2 > 0 || v.hrv > 0 || v.breathingRate > 0 || v.skinTempVariation !== 0);

  report("Done!");
  return { activities, heartRates, sleeps, weights, vitals, workouts: [] };
}
