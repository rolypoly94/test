/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Google Health API client configuration.
 *
 * SETUP CHECKLIST (Google Cloud Console — https://console.cloud.google.com):
 * 1. Create a project and enable the "Google Health API".
 * 2. OAuth consent screen: External, Testing mode, add your own Gmail as a Test user,
 *    and add ALL scopes listed in HEALTH_API_SCOPES below to the consent screen.
 * 3. Credentials -> Create Credentials -> OAuth Client ID -> "Web application".
 *    - Authorized JavaScript origins: your AI Studio dev/preview URLs (no trailing slash).
 *    - Authorized redirect URIs: the SAME URLs WITH a trailing "/" appended,
 *      because the app sends `${window.location.origin}/` as redirect_uri.
 *      Example: https://ais-dev-xxxx.asia-southeast1.run.app/
 * 4. Paste the Client ID below.
 * 5. In AI Studio's Secrets panel, add GOOGLE_CLIENT_SECRET with the client secret.
 *    (Google "Web application" clients require the secret at the token endpoint,
 *    even with PKCE. NOTE: in a frontend-only app this secret is visible in the
 *    bundle — fine for a personal tool, to be moved server-side later.)
 */

export const GOOGLE_CLIENT_ID = "766820539236-92r70tn1o77kr30f7ahs5c0h8d6jo1e3.apps.googleusercontent.com";

// Injected by AI Studio from the Secrets panel.
export const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET as string) || "";

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export const HEALTH_API_BASE_URL = "https://health.googleapis.com/v4";

/**
 * Google Health API scopes (NOT the deprecated Google Fit "fitness.*" scopes).
 * Pattern: https://www.googleapis.com/auth/googlehealth.{scope}
 * Read-only is enough for this dashboard.
 *
 * Coverage for Charge 6 metrics:
 * - activity_and_fitness.readonly: steps, distance, floors, calories, AZM, exercises
 * - sleep.readonly: sleep duration + stages
 * - health_metrics_and_measurements.readonly: heart rate, SpO2, breathing rate,
 *   HRV, skin temperature, weight (one consolidated scope)
 * - profile.readonly: user profile / units
 */
export const HEALTH_API_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.profile.readonly",
];

/**
 * Google Health API v4 data type endpoint IDs (from the official migration table).
 * All data is fetched via a uniform pattern:
 *   GET {BASE}/users/me/dataTypes/{dataTypeId}/dataPoints           -> "list" (granular/intraday)
 *   GET {BASE}/users/me/dataTypes/{dataTypeId}/dataPoints:dailyRollup -> daily summaries over a range
 *
 * TODO(verify): the exact custom-method spelling (":dailyRollup" vs a query param)
 * and the time-range parameter names are normalized in ONE place: buildDataPointsUrl()
 * in src/api/healthApi.ts. If Google's reference differs, fix it there only.
 */
export const DATA_TYPES = {
  steps: "steps",
  distance: "distance",
  floors: "floors",
  totalCalories: "total-calories",
  activeZoneMinutes: "active-zone-minutes",
  heartRate: "heart-rate",
  restingHeartRate: "daily-resting-heart-rate",
  sleep: "sleep",
  spo2: "daily-oxygen-saturation",
  hrv: "daily-heart-rate-variability",
  // TODO(verify): breathing/respiratory rate wasn't in the public mapping table.
  // Best guess below — if it 404s, check the v4 reference's data type list.
  breathingRate: "daily-respiratory-rate",
  skinTemp: "daily-sleep-temperature-derivations",
  exercise: "exercise",
  weight: "weight",
} as const;