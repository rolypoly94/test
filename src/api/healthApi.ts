/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthService } from "../auth/authService";
import { HEALTH_API_BASE_URL, DATA_TYPES } from "../config";
import { DailyActivity, DailyHeartRate, DailySleep, NightlyVitals, WorkoutLog, WeightRecord } from "../types";

/**
 * Google Health API v4 client — v2, written against the verified reference
 * (developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints).
 *
 * Two endpoint styles:
 *  1. Daily rollups (steps, distance, floors, calories, AZM, weight, resting HR, HRV):
 *       POST /users/me/dataTypes/{id}/dataPoints:dailyRollUp        <- capital U, POST!
 *       body: { range: { start: CivilDateTime, end: CivilDateTime }, windowSizeDays: 1 }
 *       range is CLOSED-OPEN, so end = day after the last day you want.
 *       response: { rollupDataPoints: [ { civilStartTime, civilEndTime, <unionValue> } ] }
 *  2. List (sleep, exercise, intraday heart rate, daily summaries not supported by rollup
 *     like SpO2 / skin temp / breathing rate):
 *       GET /users/me/dataTypes/{id}/dataPoints?filter=<AIP-160 expression>&pageSize=
 *       Filter field depends on data type, e.g.:
 *         steps.interval.start_time >= "..." (RFC-3339)
 *         dailyRestingHeartRate.date >= "YYYY-MM-DD"
 *         sleep.interval.end_time >= "..." (RFC-3339)
 *         exercise.interval.civil_start_time >= "YYYY-MM-DD"
 *       sleep & exercise: max pageSize 25 -> must paginate with nextPageToken.
 *
 * Response VALUE field names inside data points are still partially unverified
 * (e.g. StepsRollupValue's exact field names), so value extraction stays defensive
 * and unknown shapes are logged once per data type with a "[SHAPE]" prefix.
 */

// ---------------------------------------------------------------------------
// Low-level request helper (auth injection + 401/429/5xx handling)
// ---------------------------------------------------------------------------

async function apiRequest(path: string, options: RequestInit = {}): Promise<any> {
  const absoluteUrl = path.startsWith("http") ? path : `${HEALTH_API_BASE_URL}${path}`;
  let token: string;

  try {
    token = await AuthService.getValidAccessToken();
  } catch (err: any) {
    throw new Error(`AUTH_CONNECT_REQUIRED: ${err.message || "Failed to retrieve access credentials"}`);
  }

  const defaultHeaders: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json",
  };
  if (options.body) defaultHeaders["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(absoluteUrl, { ...options, headers: { ...defaultHeaders, ...options.headers } });
  } catch (netErr: any) {
    throw new Error(`NETWORK_ERROR: Unable to contact Google Server. Check connection. (${netErr.message})`);
  }

  if (response.status === 401) {
    try {
      token = await AuthService.refreshAccessToken();
      response = await fetch(absoluteUrl, {
        ...options,
        headers: { ...defaultHeaders, "Authorization": `Bearer ${token}`, ...options.headers },
      });
    } catch {
      throw new Error("REAUTHENTICATION_REQUIRED: Your Google credentials expired. Please reconnect.");
    }
  }

  if (response.status === 403) {
    const errBody = await response.json().catch(() => ({}));
    const msg = errBody.error?.message || "";
    if (msg.toLowerCase().includes("insufficient") && msg.toLowerCase().includes("scope")) {
      throw new Error("SCOPES_MISSING: Your connection lacks health permissions. Click Disconnect, then reconnect and approve ALL permission checkboxes.");
    }
    throw new Error(msg || "Access denied (403).");
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After") || "30";
    throw new Error(`RATE_LIMIT:${retryAfter}`);
  }

  if (response.status >= 500) {
    throw new Error(`SERVER_ERROR: Google Health API server is temporarily unavailable (${response.status}).`);
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = errBody.error?.message || `Google API returned status code ${response.status}`;
    throw new Error(message);
  }

  return await response.json();
}

// ---------------------------------------------------------------------------
// Date helpers (CivilDateTime + closed-open ranges)
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" -> CivilDateTime object for request bodies. */
function toCivilDateTime(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** "YYYY-MM-DD" -> the next day, for closed-open range ends and "< nextDay" filters. */
function nextDay(date: string): string {
  const dt = new Date(`${date}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

/** CivilDateTime object (from responses) -> "YYYY-MM-DD". */
function fromCivilDateTime(c: any): string | null {
  if (!c || typeof c !== "object" || !c.year) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${c.year}-${pad(c.month ?? 1)}-${pad(c.day ?? 1)}`;
}

// ---------------------------------------------------------------------------
// Defensive value extraction + shape logging
// ---------------------------------------------------------------------------

const loggedShapes = new Set<string>();

function logShapeOnce(dataType: string, json: any) {
  if (loggedShapes.has(dataType)) return;
  loggedShapes.add(dataType);
  console.warn(`[SHAPE] Unrecognized response for "${dataType}" — copy this into Claude to fix the mapping:`,
    JSON.stringify(json).slice(0, 2000));
}

/**
 * Pull a single representative number out of a rollup/data value object.
 * Field names follow "{field}_{aggregation}" (e.g. count_sum) per the docs but the
 * exact JSON casing is unverified, so we score candidate keys by preference.
 */
function extractNumber(obj: any): number | null {
  if (typeof obj === "number") return obj;
  if (!obj || typeof obj !== "object") return null;
  const entries: { key: string; value: number }[] = [];
  const walk = (o: any, prefix: string) => {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === "number") entries.push({ key: `${prefix}${k}`.toLowerCase(), value: v });
      else if (typeof v === "string" && v !== "" && !isNaN(Number(v))) entries.push({ key: `${prefix}${k}`.toLowerCase(), value: Number(v) });
      else if (v && typeof v === "object" && !Array.isArray(v)) walk(v, `${prefix}${k}.`);
    }
  };
  walk(obj, "");
  if (entries.length === 0) return null;
  const score = (k: string) =>
    k.includes("sum") || k.includes("total") ? 3 :
    k.includes("avg") || k.includes("average") || k.includes("mean") ? 2 :
    k.includes("value") || k.includes("count") || k.includes("amount") ? 1 : 0;
  entries.sort((a, b) => score(b.key) - score(a.key));
  return entries[0].value;
}

/**
 * Round a value to a fixed number of decimals, returning a clean Number (no IEEE-754
 * artifacts like 0.30000000000000004). The simulated/demo data is pre-rounded, so the
 * UI assumes clean numbers; live API values flow through extractNumber() unrounded and
 * must be normalised here or they render with full float precision and overflow the cards.
 */
function roundTo(value: number | null, decimals = 0): number {
  if (value === null || !isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** The non-time field of a rollupDataPoint is the union value (e.g. "steps": {...}). */
function rollupUnionValue(point: any): any {
  if (!point || typeof point !== "object") return null;
  for (const k of Object.keys(point)) {
    if (k !== "civilStartTime" && k !== "civilEndTime" && typeof point[k] === "object") return point[k];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Endpoint wrappers
// ---------------------------------------------------------------------------

/** POST dataPoints:dailyRollUp over [startDate, endDate] inclusive -> Map of date -> value. */
async function fetchDailyRollUp(dataType: string, startDate: string, endDate: string): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  let json: any;
  try {
    json = await apiRequest(`/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`, {
      method: "POST",
      body: JSON.stringify({
        range: { start: toCivilDateTime(startDate), end: toCivilDateTime(nextDay(endDate)) }, // closed-open
        windowSizeDays: 1,
      }),
    });
  } catch (err) {
    console.warn(`Rollup failed for "${dataType}":`, err);
    return result;
  }
  const points = json?.rollupDataPoints ?? [];
  if (points.length === 0 && json && Object.keys(json).length > 0) logShapeOnce(dataType, json);
  for (const p of points) {
    const d = fromCivilDateTime(p.civilStartTime);
    const v = extractNumber(rollupUnionValue(p));
    if (d !== null && v !== null) result.set(d, v);
    else logShapeOnce(dataType, p);
  }
  return result;
}

/** GET dataPoints list with an AIP-160 filter; paginates (needed for sleep/exercise, max 25/page). */
async function fetchList(dataType: string, filter: string, pageSize = 1000): Promise<any[]> {
  const all: any[] = [];
  let pageToken: string | undefined;
  let guard = 0;
  do {
    const params = new URLSearchParams({ filter, pageSize: String(pageSize) });
    if (pageToken) params.set("pageToken", pageToken);
    let json: any;
    try {
      json = await apiRequest(`/users/me/dataTypes/${dataType}/dataPoints?${params.toString()}`);
    } catch (err) {
      console.warn(`List failed for "${dataType}":`, err);
      break;
    }
    const points = json?.dataPoints ?? [];
    if (points.length === 0 && all.length === 0 && json && Object.keys(json).filter(k => k !== "nextPageToken").length > 0) {
      logShapeOnce(dataType, json);
    }
    all.push(...points);
    pageToken = json?.nextPageToken || undefined;
  } while (pageToken && ++guard < 20);
  return all;
}

/** Daily-summary data types (resting HR, HRV, SpO2, skin temp...) filter on "{camelType}.date". */
async function fetchDailySummaries(dataType: string, filterField: string, startDate: string, endDate: string): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const filter = `${filterField}.date >= "${startDate}" AND ${filterField}.date < "${nextDay(endDate)}"`;
  const points = await fetchList(dataType, filter);
  for (const p of points) {
    // Expected shape: { <unionField>: { date | value fields } } — extract defensively.
    const union = rollupUnionValue(p) ?? p;
    const d = (typeof union.date === "string" && union.date.slice(0, 10)) ||
              fromCivilDateTime(union.date) ||
              (typeof p.date === "string" && p.date.slice(0, 10)) || null;
    const v = extractNumber(union);
    if (d !== null && v !== null) result.set(d, v);
    else logShapeOnce(dataType, p);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public client — same method signatures the rest of the app already uses
// ---------------------------------------------------------------------------

export class HealthApiClient {

  static async getActivitySummary(date: string): Promise<DailyActivity> {
    const [steps, distance, floors, calories, azm] = await Promise.all([
      fetchDailyRollUp(DATA_TYPES.steps, date, date),
      fetchDailyRollUp(DATA_TYPES.distance, date, date),
      fetchDailyRollUp(DATA_TYPES.floors, date, date),
      fetchDailyRollUp(DATA_TYPES.totalCalories, date, date), // 14-day max range; single day is fine
      fetchDailyRollUp(DATA_TYPES.activeZoneMinutes, date, date),
    ]);
    return {
      date,
      steps: roundTo(steps.get(date) ?? 0),
      // TODO(verify): DistanceRollupValue unit (meters assumed; check [SHAPE]/values and adjust)
      distanceKm: distance.has(date) ? roundTo(distance.get(date)! / 1000, 2) : 0,
      floors: roundTo(floors.get(date) ?? 0),
      caloriesBurned: roundTo(calories.get(date) ?? 0),
      activeZoneMinutes: roundTo(azm.get(date) ?? 0),
    };
  }

  static async getHeartRate(date: string): Promise<DailyHeartRate> {
    const restingMap = await fetchDailySummaries(DATA_TYPES.restingHeartRate, "dailyRestingHeartRate", date, date);

    // Intraday heart rate via list. heart-rate is an interval data type:
    // filter field heartRate.interval.start_time with RFC-3339 timestamps.
    const filter = `heartRate.interval.start_time >= "${date}T00:00:00Z" AND heartRate.interval.start_time < "${nextDay(date)}T00:00:00Z"`;
    const points = await fetchList(DATA_TYPES.heartRate, filter, 1440);

    const intraday = points
      .map((p: any) => {
        const union = rollupUnionValue(p) ?? p;
        const ts = union.interval?.startTime ?? union.startTime ?? p.interval?.startTime ?? null;
        const bpm = extractNumber(union);
        if (bpm === null) return null;
        const time = typeof ts === "string" && ts.includes("T") ? ts.slice(11, 16) : "00:00";
        return { time, bpm: roundTo(bpm) };
      })
      .filter(Boolean) as { time: string; bpm: number }[];

    return {
      date,
      restingHeartRate: roundTo(restingMap.get(date) ?? 0),
      intraday, // empty = "no data"; charts must not show fake values
    };
  }

  static async getSleep(startDate: string, endDate: string): Promise<DailySleep[]> {
    // Sleep filters on session end time (RFC-3339). Max pageSize 25 -> fetchList paginates.
    const filter = `sleep.interval.end_time >= "${startDate}T00:00:00Z" AND sleep.interval.end_time < "${nextDay(endDate)}T00:00:00Z"`;
    const sessions = await fetchList(DATA_TYPES.sleep, filter, 25);

    return sessions.map((p: any) => {
      const sl = rollupUnionValue(p) ?? p;
      const endTs = sl.interval?.endTime ?? p.interval?.endTime ?? null;
      const date = (typeof endTs === "string" && endTs.slice(0, 10)) || startDate;
      // Stage minutes: try common containers; log shape if nothing matches.
      const stages = sl.stages ?? sl.stageSummary ?? sl.levels?.summary ?? {};
      const stageMin = (name: string) => {
        const s = stages[name] ?? stages[`${name}Minutes`] ?? null;
        return s === null ? 0 : roundTo(extractNumber(s) ?? 0);
      };
      const duration =
        extractNumber(sl.durationMinutes) ??
        extractNumber(sl.minutesAsleep) ??
        // TODO(verify): if "duration" is a protobuf Duration string like "28800s", parse seconds
        (typeof sl.duration === "string" && sl.duration.endsWith("s") ? Math.round(parseInt(sl.duration) / 60) : null) ??
        0;
      if (duration === 0 && stageMin("light") === 0 && stageMin("deep") === 0) logShapeOnce(DATA_TYPES.sleep, p);
      return {
        date,
        durationMinutes: roundTo(duration),
        sleepScore: roundTo(extractNumber(sl.sleepScore ?? sl.score ?? sl.efficiency) ?? 0),
        stages: {
          deepMinutes: stageMin("deep"),
          lightMinutes: stageMin("light"),
          remMinutes: stageMin("rem"),
          awakeMinutes: stageMin("awake") || stageMin("wake"),
        },
      };
    });
  }

  static async getNightlyVitals(startDate: string, endDate: string): Promise<NightlyVitals[]> {
    // These daily-summary types are not supported by dailyRollUp -> list with {type}.date filters.
    // TODO(verify): camelCase filter field names below are derived from the documented pattern
    // ("dailyRestingHeartRate.date", "dailyHeartRateVariability.date" are confirmed examples).
    const [spo2, br, hrv, temp] = await Promise.all([
      fetchDailySummaries(DATA_TYPES.spo2, "dailyOxygenSaturation", startDate, endDate),
      fetchDailySummaries(DATA_TYPES.breathingRate, "dailyRespiratoryRate", startDate, endDate),
      fetchDailySummaries(DATA_TYPES.hrv, "dailyHeartRateVariability", startDate, endDate),
      fetchDailySummaries(DATA_TYPES.skinTemp, "dailySleepTemperatureDerivations", startDate, endDate),
    ]);

    const allDates = new Set<string>([...spo2.keys(), ...br.keys(), ...hrv.keys(), ...temp.keys()]);
    return Array.from(allDates).sort().map((d) => ({
      date: d,
      spo2: roundTo(spo2.get(d) ?? 0, 1),
      breathingRate: roundTo(br.get(d) ?? 0, 1),
      hrv: roundTo(hrv.get(d) ?? 0),
      skinTempVariation: roundTo(temp.get(d) ?? 0, 1),
    }));
  }

  static async getWorkouts(startDate: string, endDate: string): Promise<WorkoutLog[]> {
    // Exercise filters on session civil start time. Max pageSize 25 -> paginated.
    const filter = `exercise.interval.civil_start_time >= "${startDate}" AND exercise.interval.civil_start_time < "${nextDay(endDate)}"`;
    const sessions = await fetchList(DATA_TYPES.exercise, filter, 25);

    return sessions.map((p: any, i: number) => {
      const w = rollupUnionValue(p) ?? p;
      const start = w.interval?.startTime ?? w.interval?.civilStartTime ?? p.interval?.startTime ?? startDate;
      const startStr = typeof start === "string" ? start : (fromCivilDateTime(start) ?? startDate);
      return {
        id: p.name ?? w.id ?? `workout_${startStr}_${i}`,
        date: startStr.slice(0, 16).replace("T", " "),
        type: w.exerciseType ?? w.activityName ?? w.type ?? "Exercise",
        durationMinutes: roundTo(
          extractNumber(w.durationMinutes) ??
          (typeof w.duration === "string" && w.duration.endsWith("s") ? parseInt(w.duration) / 60 : null) ?? 0,
        ),
        avgHeartRate: roundTo(extractNumber(w.averageHeartRate ?? w.avgHeartRate) ?? 0),
        calories: roundTo(extractNumber(w.calories ?? w.totalCalories) ?? 0),
      };
    });
  }

  static async getWeights(startDate: string, endDate: string): Promise<WeightRecord[]> {
    const weights = await fetchDailyRollUp(DATA_TYPES.weight, startDate, endDate);
    return Array.from(weights.entries()).sort().map(([date, weightKg]) => ({ date, weightKg: roundTo(weightKg, 1) }));
  }
}