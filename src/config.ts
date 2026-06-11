// Single source of truth for client ID, scopes, and data type IDs.
// All values verified against the live discovery doc:
// https://health.googleapis.com/$discovery/rest?version=v4

export const API_BASE = 'https://health.googleapis.com/v4';

export const OAUTH = {
  clientId:
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
    '766820539236-92r70tn1o77kr30f7ahs5c0h8d6jo1e3.apps.googleusercontent.com',
  // SECURITY DEBT: secret belongs on a backend, not in the bundle.
  clientSecret:
    (import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string) ||
    ((typeof process !== 'undefined' ? process.env?.GOOGLE_CLIENT_SECRET : '') as string) ||
    '',
  redirectUri:
    (import.meta.env.VITE_OAUTH_REDIRECT_URI as string) ||
    `${window.location.origin}/oauth-callback.html`,
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export const GOOGLE_CLIENT_ID = OAUTH.clientId;
export const GOOGLE_CLIENT_SECRET = OAUTH.clientSecret;
export const GOOGLE_AUTH_ENDPOINT = OAUTH.authEndpoint;
export const GOOGLE_TOKEN_ENDPOINT = OAUTH.tokenEndpoint;
export const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
export const HEALTH_API_SCOPES = SCOPES;

// Verified scope URIs (discovery doc auth.oauth2.scopes).
export const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.profile.readonly',
];

// Data type IDs (kebab-case of the DataPoint union field names).
export const DATA_TYPES = {
  steps: 'steps',
  distance: 'distance',
  floors: 'floors',
  totalCalories: 'total-calories',
  activeZoneMinutes: 'active-zone-minutes',
  heartRate: 'heart-rate',
  dailyRestingHeartRate: 'daily-resting-heart-rate',
  sleep: 'sleep',
  dailyOxygenSaturation: 'daily-oxygen-saturation',
  dailyHeartRateVariability: 'daily-heart-rate-variability',
  dailyRespiratoryRate: 'daily-respiratory-rate',
  dailySleepTemperatureDerivations: 'daily-sleep-temperature-derivations',
  exercise: 'exercise',
  weight: 'weight',
} as const;

// dailyRollUp range limits (verified: discovery doc DailyRollUpDataPointsRequest.range).
// 14 days for heart-rate / total-calories / calories-in-heart-rate-zone / active-minutes;
// 90 days for everything else.
export const ROLLUP_MAX_DAYS: Record<string, number> = {
  'heart-rate': 14,
  'total-calories': 14,
};
export const ROLLUP_MAX_DAYS_DEFAULT = 90;

// Verified: sleep & exercise list calls cap pageSize at 25.
export const SESSION_PAGE_SIZE = 25;

// Verified dataSourceFamily values for rollUp bodies.
export const DATA_SOURCE_FAMILIES = {
  all: 'users/me/dataSourceFamilies/all-sources',
  wearables: 'users/me/dataSourceFamilies/google-wearables',
  googleSources: 'users/me/dataSourceFamilies/google-sources',
};
