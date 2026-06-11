# MyHealth Sync - Personal Health Dashboard

MyHealth Sync is a premium, client-side React + TypeScript dashboard designed specifically to display fitness, sleep, cardiac, and physiological vitals recorded by your **Fitbit Charge 6**.

It integrates directly with the **Google Health API (v4 REST REST endpoints)** using secure **OAuth 2.0 with PKCE (Proof Key for Code Exchange) Authorization Code flow** entirely within the browser sandbox, requiring no custom server secrets.

## Features Mapped (Fitbit Charge 6 Records All of These)
- **Daily Physical Performance:** Step counts, active zone minutes, calories burned, distance, and floors climbed with interactive weekly and monthly scales.
- **Cardiograms:** Rest heart rate trends combined with intraday minute-by-minute cardiac rhythms.
- **Sleep Architecture:** Quality sleep scores, durations, and deep, light, REM, and awake stage breakdowns.
- **Overnight Physiological Vitals:** Nightly SpO2 percentages, breathing rates, Heart Rate Variability (HRV), and skin temperature variation deviations.
- **Exercise Deck & Weight Logs:** Sorted training exercises and weight composition progression lines.
- **Adaptive Progress comparisons:** Inspect week-over-week and month-over-month performance with colored, benefit-calibrated indicator dials, tracking positive improvements or physical deficits.
- **IndexedDB Local Caching:** Caches data locally to respect Google API rate limits and boot the app instantaneously on load.

---

## 📋 Complete Google Cloud Platform (GCP) Configuration Guide

Since the Fitbit Web API was fully migrated to the new Google Health API, you must link your Google account to a Google Cloud Credentials profile. Follow these quick steps:

### Step 1: Create a Google Cloud Project
1. Open the [Google Cloud Console](https://console.cloud.google.com).
2. Log in with your preferred Google account.
3. Click the Project dropdown menu at the top left and select **New Project**. Name it `MyHealth Sync`.

### Step 2: Enable the Google Health API
1. Using the search bar at the top of GCP, search for **"Google Health API"** (or the Fitbit developer integration center).
2. Click **Google Health API** from the results and choose **Enable** to activate the endpoints.

### Step 3: Configure the OAuth Consent Screen (Testing Mode)
Since this is a personal health portal, you do not need Google verification! Simply configure it in a secure individual testing environment:
1. Navigate to **APIs & Services** &rarr; **OAuth Consent Screen** in the left sidebar.
2. Select **External** as the User Type and click **Create**.
3. Fill out the **App Information** (e.g., App Name: `MyHealth Sync`, User Support Email, Developer Email). Click **Save and Continue**.
4. Skip the **Scopes** tab by clicking **Save and Continue** (scopes are handled cleanly dynamically on the client).
5. under the **Test Users** tab, click **Add Users**. Type your exact login email address:
   - **`yadavsumit1301@gmail.com`**
   - *Note: Google blocks all non-registered test accounts from connecting to health endpoints before verification, so registering this test email is mandatory!*
6. Click **Save and Continue**, then review your summary.

### Step 4: Create OAuth 2.0 Web Client Credentials
1. Navigate to the **Credentials** page in the left sidebar.
2. Click **Create Credentials** at the top and select **OAuth Client ID**.
3. Under **Application Type**, select **Web Application**.
4. Register the matching callback URIs in the **Authorized redirect URIs** box:
   - **Active Sandbox Development:** `https://ais-dev-zdsr7k3xk6pvml5b4pfrbd-642761539186.asia-southeast1.run.app/`
   - **Shared Preview Deployed:** `https://ais-pre-zdsr7k3xk6pvml5b4pfrbd-642761539186.asia-southeast1.run.app/`
   - **Local Developer Fallback:** `http://localhost:3000/`
5. Click **Create**. Copy the resulting **Client ID** (looks like `xxxxxx.apps.googleusercontent.com`).

### Step 5: Load Credentials inside your App
Open `/src/config.ts` in your text editor and paste your client ID inside the matching constant:
```typescript
export const GOOGLE_CLIENT_ID = "PASTE_YOUR_OAUTH_CLIENT_ID_HERE";
```

Once pasted, the dashboard will establish real cryptographic handshakes directly with Google's servers whenever you click **Connect Client Account**!

---

## 🛠️ Offline Simulation Sandbox

To explore the responsive dashboard and comparative analytics immediately without configuring GCP, use the integrated **Simulation Mode**:
1. Click the **Device Sync** tab.
2. Ensure **Simulation** is toggled to **ON** (toggles automatically on login failures).
3. The dashboard will populate with 90 days of high-fidelity Fitbit Charge 6 recordings, letting you test the circadian heart ranges, sleep stage percentages, respiratory vitals, and progress comparisons immediately!
