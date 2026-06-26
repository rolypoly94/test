/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthService } from "../auth/authService";
import { HEALTH_API_BASE_URL, DATA_TYPES } from "../config";
import { DailyActivity, DailyHeartRate, DailySleep, NightlyVitals, WorkoutLog, WeightRecord } from "../types";

/**
 * Google Health API v4 client.
 *
 * Request/response shapes below are taken from the live discovery document
 * (https://health.googleapis.com/$discovery/rest?version=v4), not guessed:
 *
 *  1. Daily rollups (steps, distance, floors, total-calories, active-zone-minutes, weight):
 *       POST /users/me/dataTypes/{id}/dataPoints:dailyRollUp
 *       body: { range: CivilTimeInterval, windowSizeDays: 1 }
 *       CivilTimeInterval = { start: CivilDateTime, end: CivilDateTime }   (closed-open)
 *       CivilDateTime     = { date: { year, month, day }, time? }
 *       response: { rollupDataPoints: [ { civilStartTime: CivilDateTime, <union>: {...} } ] }
 *       Units matter: distance is millimeters, weight is grams, AZM is split per HR zone.
 *
 *  2. List (daily summaries, intraday heart-rate sample, sleep & exercise sessions):
 *       GET /users/me/dataTypes/{id}/dataPoints?filter=<AIP-160>&pageSize=
 *       Filter field token is the snake_case form of the data type id, e.g.
 *         daily_resting_heart_rate.date >= "YYYY-MM-DD"
 *         heart_rate.sample_time.physical_time >= "...Z"   (heart-rate is a SAMPLE type)
 *         sleep.interval.end_time >= "...Z"
 *         exercise.interval.civil_start_time >= "YYYY-MM-DD"
 *       response: { dataPoints: [ DataPoint ], nextPageToken }
 *       Each DataPoint carries the value under a camelCase union field matching its type.
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
// Small value / date / unit helpers
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/** int64-as-string or plain number -> finite number (0 otherwise). */
function num(v: any): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && isFinite(n) ? n : 0;
}

/**
 * Round to a fixed number of decimals, returning a clean Number (no IEEE-754
 * artifacts like 0.30000000000000004) so the UI never renders raw float noise.
 */
function roundTo(value: number, decimals = 0): number {
  if (!isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Snake_case filter token for a data type id, e.g. "daily-resting-heart-rate" -> "daily_resting_heart_rate". */
function filterToken(dataType: string): string {
  return dataType.replace(/-/g, "_");
}

/** "YYYY-MM-DD" -> CivilDateTime request value: { date: { year, month, day } }. */
function toCivilDateTime(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { date: { year, month, day } };
}

/** "YYYY-MM-DD" -> the next day (for closed-open range ends and "< nextDay" filters). */
function nextDay(date: string): string {
  const dt = new Date(`${date}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Resolve a "YYYY-MM-DD" string from either a CivilDateTime ({ date: { year, month, day } })
 * or a bare Date ({ year, month, day }) — daily summaries use the latter, rollups the former.
 */
function civilToDateStr(c: any): string | null {
  const d = c?.date ?? c;
  if (!d || !d.year) return null;
  return `${d.year}-${pad(d.month ?? 1)}-${pad(d.day ?? 1)}`;
}

/** CivilDateTime -> "HH:MM" using its civil time-of-day, or null if no time component. */
function civilToTimeStr(c: any): string | null {
  const t = c?.time;
  if (!t || (t.hours == null && t.minutes == null)) return null;
  return `${pad(t.hours ?? 0)}:${pad(t.minutes ?? 0)}`;
}

/** google-duration string ("2100s", "12.5s") -> minutes. */
function durationToMinutes(s: any): number {
  if (typeof s !== "string") return 0;
  const seconds = parseFloat(s.replace(/s$/, ""));
  return isFinite(seconds) ? seconds / 60 : 0;
}

/** Minutes between RFC-3339 start/end timestamps of a SessionTimeInterval. */
function intervalMinutes(interval: any): number {
  const start = interval?.startTime, end = interval?.endTime;
  if (typeof start !== "string" || typeof end !== "string") return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms > 0 ? ms / 60000 : 0;
}

/** "RUNNING" / "FUNCTIONAL_STRENGTH_TRAINING" -> "Running" / "Functional Strength Training". */
function prettyExerciseType(type: any): string {
  if (typeof type !== "string" || !type || type === "EXERCISE_TYPE_UNSPECIFIED") return "Exercise";
  return type.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ---------------------------------------------------------------------------
// Endpoint wrappers
// ---------------------------------------------------------------------------

/** POST dataPoints:dailyRollUp over [startDate, endDate] inclusive -> raw rollup points. */
async function fetchRollupPoints(dataType: string, startDate: string, endDate: string): Promise<any[]> {
  try {
    const json = await apiRequest(`/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`, {
      method: "POST",
      body: JSON.stringify({
        range: { start: toCivilDateTime(startDate), end: toCivilDateTime(nextDay(endDate)) }, // closed-open
        windowSizeDays: 1,
      }),
    });
    return json?.rollupDataPoints ?? [];
  } catch (err) {
    console.warn(`Rollup failed for "${dataType}":`, err);
    return [];
  }
}

/** Single-day rollup -> extracted numeric value (0 if absent). */
async function fetchRollupValue(dataType: string, date: string, extract: (point: any) => number): Promise<number> {
  const points = await fetchRollupPoints(dataType, date, date);
  const point = points.find((p) => civilToDateStr(p.civilStartTime) === date) ?? points[0];
  return point ? extract(point) : 0;
}

/** GET dataPoints list with an AIP-160 filter; paginates via nextPageToken. */
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
    all.push(...(json?.dataPoints ?? []));
    pageToken = json?.nextPageToken || undefined;
  } while (pageToken && ++guard < 50);
  return all;
}

/** Daily-summary list -> Map of date -> value, using the snake_case ".date" filter. */
async function fetchDailySummary(
  dataType: string,
  unionKey: string,
  startDate: string,
  endDate: string,
  getValue: (union: any) => number,
): Promise<Map<string, number>> {
  const token = filterToken(dataType);
  const filter = `${token}.date >= "${startDate}" AND ${token}.date < "${nextDay(endDate)}"`;
  const points = await fetchList(dataType, filter, 1000);
  const result = new Map<string, number>();
  for (const p of points) {
    const union = p[unionKey];
    if (!union) continue;
    const date = civilToDateStr(union.date);
    if (date) result.set(date, getValue(union));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public client — same method signatures the rest of the app already uses
// ---------------------------------------------------------------------------

export class HealthApiClient {

  static async getActivitySummary(date: string): Promise<DailyActivity> {
    const [steps, distanceMm, floors, kcal, azm] = await Promise.all([
      fetchRollupValue(DATA_TYPES.steps, date, (p) => num(p.steps?.countSum)),
      fetchRollupValue(DATA_TYPES.distance, date, (p) => num(p.distance?.millimetersSum)),
      fetchRollupValue(DATA_TYPES.floors, date, (p) => num(p.floors?.countSum)),
      fetchRollupValue(DATA_TYPES.totalCalories, date, (p) => num(p.totalCalories?.kcalSum)),
      fetchRollupValue(DATA_TYPES.activeZoneMinutes, date, (p) =>
        num(p.activeZoneMinutes?.sumInPeakHeartZone) +
        num(p.activeZoneMinutes?.sumInFatBurnHeartZone) +
        num(p.activeZoneMinutes?.sumInCardioHeartZone),
      ),
    ]);
    return {
      date,
      steps: roundTo(steps),
      distanceKm: roundTo(distanceMm / 1_000_000, 2), // millimeters -> km
      floors: roundTo(floors),
      caloriesBurned: roundTo(kcal),
      activeZoneMinutes: roundTo(azm),
    };
  }

  static async getHeartRate(date: string): Promise<DailyHeartRate> {
    // Resting HR: daily-summary list filtered on its snake_case ".date" field.
    const restingMap = await fetchDailySummary(
      DATA_TYPES.restingHeartRate, "dailyRestingHeartRate", date, date,
      (u) => num(u.beatsPerMinute),
    );

    // Intraday HR: heart-rate is a SAMPLE type -> filter on sample_time.physical_time (RFC-3339).
    const token = filterToken(DATA_TYPES.heartRate); // "heart_rate"
    const filter =
      `${token}.sample_time.physical_time >= "${date}T00:00:00Z" AND ` +
      `${token}.sample_time.physical_time < "${nextDay(date)}T00:00:00Z"`;
    const points = await fetchList(DATA_TYPES.heartRate, filter, 10000);

    const intraday = points
      .map((p: any) => {
        const hr = p.heartRate;
        if (!hr) return null;
        const time =
          civilToTimeStr(hr.sampleTime?.civilTime) ??
          (typeof hr.sampleTime?.physicalTime === "string" ? hr.sampleTime.physicalTime.slice(11, 16) : "00:00");
        return { time, bpm: roundTo(num(hr.beatsPerMinute)) };
      })
      .filter(Boolean) as { time: string; bpm: number }[];
    intraday.sort((a, b) => a.time.localeCompare(b.time));

    return {
      date,
      restingHeartRate: roundTo(restingMap.get(date) ?? 0),
      intraday, // empty = "no data"; charts must not show fake values
    };
  }

  static async getSleep(startDate: string, endDate: string): Promise<DailySleep[]> {
    // Sleep sessions filter on end_time (RFC-3339). Max pageSize 25 -> fetchList paginates.
    const filter =
      `sleep.interval.end_time >= "${startDate}T00:00:00Z" AND ` +
      `sleep.interval.end_time < "${nextDay(endDate)}T00:00:00Z"`;
    const points = await fetchList(DATA_TYPES.sleep, filter, 25);

    return points
      .map((p: any) => {
        const sl = p.sleep;
        if (!sl) return null;
        const date =
          civilToDateStr(sl.interval?.civilEndTime) ??
          (typeof sl.interval?.endTime === "string" ? sl.interval.endTime.slice(0, 10) : startDate);

        const summary = sl.summary ?? {};
        const stages: any[] = summary.stagesSummary ?? [];
        const stageMinutes = (type: string) => num(stages.find((s) => s.type === type)?.minutes);

        const inPeriod = num(summary.minutesInSleepPeriod);
        const asleep = num(summary.minutesAsleep);
        const duration = inPeriod || asleep; // total time in the sleep period
        // The API has no "sleep score" field; surface sleep efficiency (% asleep) as the score.
        const score = inPeriod ? Math.round((asleep / inPeriod) * 100) : 0;

        return {
          date,
          durationMinutes: roundTo(duration),
          sleepScore: roundTo(score),
          stages: {
            deepMinutes: roundTo(stageMinutes("DEEP")),
            lightMinutes: roundTo(stageMinutes("LIGHT")),
            remMinutes: roundTo(stageMinutes("REM")),
            // "stages" sleep reports AWAKE; "classic" sleep reports RESTLESS as wake time.
            awakeMinutes: roundTo(stageMinutes("AWAKE") || stageMinutes("RESTLESS")),
          },
        };
      })
      .filter(Boolean) as DailySleep[];
  }

  static async getNightlyVitals(startDate: string, endDate: string): Promise<NightlyVitals[]> {
    const [spo2, breathing, hrv, temp] = await Promise.all([
      fetchDailySummary(DATA_TYPES.spo2, "dailyOxygenSaturation", startDate, endDate,
        (u) => num(u.averagePercentage)),
      fetchDailySummary(DATA_TYPES.breathingRate, "dailyRespiratoryRate", startDate, endDate,
        (u) => num(u.breathsPerMinute)),
      fetchDailySummary(DATA_TYPES.hrv, "dailyHeartRateVariability", startDate, endDate,
        (u) => num(u.averageHeartRateVariabilityMilliseconds ?? u.deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds)),
      fetchDailySummary(DATA_TYPES.skinTemp, "dailySleepTemperatureDerivations", startDate, endDate,
        (u) => {
          const nightly = num(u.nightlyTemperatureCelsius);
          const baseline = num(u.baselineTemperatureCelsius);
          return baseline ? nightly - baseline : 0; // deviation from personal baseline
        }),
    ]);

    const allDates = new Set<string>([...spo2.keys(), ...breathing.keys(), ...hrv.keys(), ...temp.keys()]);
    return Array.from(allDates).sort().map((d) => ({
      date: d,
      spo2: roundTo(spo2.get(d) ?? 0, 1),
      breathingRate: roundTo(breathing.get(d) ?? 0, 1),
      hrv: roundTo(hrv.get(d) ?? 0),
      skinTempVariation: roundTo(temp.get(d) ?? 0, 1),
    }));
  }

  static async getWorkouts(startDate: string, endDate: string): Promise<WorkoutLog[]> {
    // Exercise sessions filter on civil_start_time (ISO date). Max pageSize 25 -> paginated.
    const filter =
      `exercise.interval.civil_start_time >= "${startDate}" AND ` +
      `exercise.interval.civil_start_time < "${nextDay(endDate)}"`;
    const points = await fetchList(DATA_TYPES.exercise, filter, 25);

    return points
      .map((p: any, i: number) => {
        const ex = p.exercise;
        if (!ex) return null;
        const civilStart = ex.interval?.civilStartTime;
        const dateStr = civilToDateStr(civilStart);
        const timeStr = civilToTimeStr(civilStart);
        const dateField = dateStr
          ? (timeStr ? `${dateStr} ${timeStr}` : dateStr)
          : (typeof ex.interval?.startTime === "string" ? ex.interval.startTime.slice(0, 16).replace("T", " ") : startDate);

        const ms = ex.metricsSummary ?? {};
        const duration = durationToMinutes(ex.activeDuration) || intervalMinutes(ex.interval);

        return {
          id: p.name ?? `exercise_${dateField}_${i}`,
          date: dateField,
          type: ex.displayName || prettyExerciseType(ex.exerciseType),
          durationMinutes: roundTo(duration),
          avgHeartRate: roundTo(num(ms.averageHeartRateBeatsPerMinute)),
          calories: roundTo(num(ms.caloriesKcal)),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b!.date).localeCompare(a!.date)) as WorkoutLog[];
  }

  static async getWeights(startDate: string, endDate: string): Promise<WeightRecord[]> {
    const points = await fetchRollupPoints(DATA_TYPES.weight, startDate, endDate);
    return points
      .map((p) => ({
        date: civilToDateStr(p.civilStartTime),
        weightKg: roundTo(num(p.weight?.weightGramsAvg) / 1000, 1), // grams -> kg
      }))
      .filter((w): w is WeightRecord => !!w.date && w.weightKg > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
