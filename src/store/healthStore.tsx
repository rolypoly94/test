/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { HealthDataStore, AuthState, DailyActivity, DailyHeartRate, DailySleep, NightlyVitals, WorkoutLog, WeightRecord } from "../types";
import { AuthService } from "../auth/authService";
import { HealthApiClient } from "../api/healthApi";
import { generate90DayHealthData } from "../api/simulatedData";
import { saveHealthData, loadHealthData, clearHealthData } from "./db";

interface HealthStoreContextType {
  authState: AuthState;
  healthData: HealthDataStore;
  isDemoMode: boolean;
  isSyncing: boolean;
  syncProgress: number; // 0 - 100
  syncStatusText: string | null;
  syncError: string | null;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  toggleDemoMode: () => void;
  login: () => Promise<void>;
  disconnect: () => Promise<void>;
  syncData: (forceBackfill?: boolean) => Promise<void>;
}

const HealthContext = createContext<HealthStoreContextType | undefined>(undefined);

const emptyStore: HealthDataStore = {
  activities: [],
  heartRates: [],
  sleeps: [],
  vitals: [],
  workouts: [],
  weights: [],
  lastSyncTime: null,
};

export const HealthStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(AuthService.getAuthState());
  const [healthData, setHealthData] = useState<HealthDataStore>(emptyStore);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true); // Defaults to demo mode for immersive immediate preview
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Subscribe to OAuth state changes
  useEffect(() => {
    const unsubscribe = AuthService.subscribe((state) => {
      setAuthState(state);
      if (state.accessToken) {
        setIsDemoMode(false); // Disable demo mode once a real Google auth session begins
      }
    });
    return unsubscribe;
  }, []);

  // Hydrate healthData from IndexedDB cache or Simulation Mode on boot
  useEffect(() => {
    async function hydrate() {
      if (isDemoMode) {
        const demoPayload = generate90DayHealthData();
        setHealthData(demoPayload);
        // Find latest date in demo payload to display. Usually today.
        if (demoPayload.activities.length > 0) {
          setSelectedDate(demoPayload.activities[demoPayload.activities.length - 1].date);
        }
      } else {
        const cached = await loadHealthData();
        if (cached) {
          setHealthData(cached);
          if (cached.activities.length > 0) {
            setSelectedDate(cached.activities[cached.activities.length - 1].date);
          }
        } else {
          setHealthData(emptyStore);
        }
      }
    }
    hydrate();
  }, [isDemoMode]);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((prev) => !prev);
    // If turning on, will generate data automatically via useEffect.
    // If turning off and authenticated, client will reload IndexedDB cache.
  }, []);

  const login = useCallback(async () => {
    try {
      setSyncError(null);
      await AuthService.login();
      setIsDemoMode(false);
    } catch (err: any) {
      setSyncError(err.message || "Failed to complete Google Sign In.");
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      setSyncError(null);
      await AuthService.disconnectAndRevoke();
      await clearHealthData();
      setHealthData(emptyStore);
      setIsDemoMode(true); // Re-activate simulation mode so page remains visually rich
    } catch (err: any) {
      setSyncError(err.message || "Failed to disconnect account.");
    }
  }, []);

  /**
   * Performs an incremental delta sync since last sync date, or full 365-day backfill.
   */
  const syncData = useCallback(async (forceBackfill = false) => {
    if (isDemoMode) {
      // Demo mode simply updates latest sync time to simulate progress
      setIsSyncing(true);
      setSyncProgress(20);
      setSyncStatusText("Simulating Google API handshake...");
      await new Promise((r) => setTimeout(r, 600));
      setSyncProgress(60);
      setSyncStatusText("Regenerating 365-day statistical models...");
      await new Promise((r) => setTimeout(r, 600));
      setSyncProgress(100);
      setSyncStatusText("Cached inside sandbox IndexedDB!");

      const refreshedDemo = generate90DayHealthData();
      setHealthData(refreshedDemo);
      setIsSyncing(false);
      setSyncStatusText(null);
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncStatusText("Connecting to Google Health endpoints...");
    setSyncError(null);

    /** Split a date range into 90-day chunks (rollup API limit). */
    const chunkDateRange = (start: string, end: string, chunkDays = 90): Array<[string, string]> => {
      const chunks: Array<[string, string]> = [];
      let cur = new Date(`${start}T00:00:00Z`);
      const endDt = new Date(`${end}T00:00:00Z`);
      while (cur <= endDt) {
        const chunkEnd = new Date(cur);
        chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays - 1);
        if (chunkEnd > endDt) chunkEnd.setTime(endDt.getTime());
        chunks.push([cur.toISOString().slice(0, 10), chunkEnd.toISOString().slice(0, 10)]);
        cur = new Date(chunkEnd);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      return chunks;
    };

    try {
      const today = new Date();
      let daysToFetch = 90;
      let lastSyncDate: Date | null = null;

      const cached = await loadHealthData();
      if (cached && cached.lastSyncTime && !forceBackfill && cached.activities.length > 85) {
        lastSyncDate = new Date(cached.lastSyncTime);
        const diffTime = Math.abs(today.getTime() - lastSyncDate.getTime());
        daysToFetch = Math.max(1, Math.min(90, Math.ceil(diffTime / (1000 * 60 * 60 * 24))));
      }

      // Restructure local arrays
      const currentActivities = cached ? [...cached.activities] : [];
      const currentHeartRates = cached ? [...cached.heartRates] : [];

      // Accumulators for series/date ranges
      let newSleeps: DailySleep[] = [];
      let newVitals: NightlyVitals[] = [];
      let newWorkouts: WorkoutLog[] = [];
      let newWeights: WeightRecord[] = [];

      const startBackfillDate = new Date();
      startBackfillDate.setDate(today.getDate() - daysToFetch);
      const startStr = startBackfillDate.toISOString().split("T")[0];
      const endStr = today.toISOString().split("T")[0];

      const stepErrors: string[] = [];
      const handleSyncError = (err: any, stepName: string) => {
        const msg = err?.message || String(err);
        if (
          msg.includes("AUTH_CONNECT_REQUIRED") ||
          msg.includes("REAUTHENTICATION_REQUIRED") ||
          msg.includes("SCOPES_MISSING") ||
          msg.includes("NETWORK_ERROR")
        ) {
          throw err; // Propagate fatal/structural errors immediately
        }
        console.error(`Error syncing ${stepName}:`, err);
        stepErrors.push(`${stepName}: ${msg}`);
      };

      const dateChunks = chunkDateRange(startStr, endStr, 90);

      // Step 1: Fetch sleeping metrics in 90-day chunks
      setSyncProgress(10);
      setSyncStatusText(`Syncing sleep logs (${daysToFetch} days)...`);
      try {
        for (const [cs, ce] of dateChunks) {
          const chunk = await HealthApiClient.getSleep(cs, ce);
          newSleeps.push(...chunk);
        }
      } catch (err: any) {
        handleSyncError(err, "Sleep logs");
      }

      // Step 2: Fetch nightly vitals in 90-day chunks
      setSyncProgress(25);
      setSyncStatusText(`Acquiring nightly vitals (${daysToFetch} days)...`);
      try {
        for (const [cs, ce] of dateChunks) {
          const chunk = await HealthApiClient.getNightlyVitals(cs, ce);
          newVitals.push(...chunk);
        }
      } catch (err: any) {
        handleSyncError(err, "Nightly vitals");
      }

      // Step 3: Fetch workouts in 90-day chunks
      setSyncProgress(40);
      setSyncStatusText(`Downloading workout records (${daysToFetch} days)...`);
      try {
        for (const [cs, ce] of dateChunks) {
          const chunk = await HealthApiClient.getWorkouts(cs, ce);
          newWorkouts.push(...chunk);
        }
      } catch (err: any) {
        handleSyncError(err, "Workout records");
      }

      // Step 4: Fetch weight records in 90-day chunks (rollup API limited to 90 days)
      setSyncProgress(55);
      setSyncStatusText(`Syncing body composition logs (${daysToFetch} days)...`);
      try {
        for (const [cs, ce] of dateChunks) {
          const chunk = await HealthApiClient.getWeights(cs, ce);
          newWeights.push(...chunk);
        }
      } catch (err: any) {
        handleSyncError(err, "Weight records");
      }

      // Step 5: Batch fetching for activities (chunks)
      setSyncProgress(65);
      setSyncStatusText(`Reconciling daily step counts (${daysToFetch} days)...`);
      
      let activityFailures = 0;
      let heartRateFailures = 0;

      try {
        for (const [cs, ce] of dateChunks) {
          const actChunk = await HealthApiClient.getActivities(cs, ce);
          for (const act of actChunk) {
            const idx = currentActivities.findIndex((a) => a.date === act.date);
            if (idx >= 0) {
              currentActivities[idx] = act;
            } else {
              currentActivities.push(act);
            }
          }
        }
      } catch (err: any) {
        handleSyncError(err, "Activity records");
        activityFailures++;
      }

      setSyncProgress(80);
      setSyncStatusText(`Syncing heart-rate logs (${daysToFetch} days). This takes ~1-2 minutes to respect rate limits...`);

      try {
        for (const [cs, ce] of dateChunks) {
          const hrChunk = await HealthApiClient.getHeartRatesBatch(cs, ce);
          for (const hr of hrChunk) {
            const idx = currentHeartRates.findIndex((h) => h.date === hr.date);
            if (idx >= 0) {
              currentHeartRates[idx] = hr;
            } else {
              currentHeartRates.push(hr);
            }
          }
        }
      } catch (err: any) {
        handleSyncError(err, "Heart rate details");
        heartRateFailures++;
      }

      if (activityFailures > 0) {
        stepErrors.push(`Daily activities: failed to sync ${activityFailures} out of ${daysToFetch} days`);
      }
      if (heartRateFailures > 0) {
        stepErrors.push(`Heart rate details: failed to sync ${heartRateFailures} out of ${daysToFetch} days`);
      }

      // De-duplicate lists and sort by date ascending
      const sortAndFilter = <T extends { date: string }>(current: T[], incoming: T[]): T[] => {
        const map = new Map<string, T>();
        current.forEach(item => map.set(item.date, item));
        incoming.forEach(item => map.set(item.date, item));
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      };

      const finalStore: HealthDataStore = {
        activities: sortAndFilter(currentActivities, []),
        heartRates: sortAndFilter(currentHeartRates, []),
        sleeps: sortAndFilter(cached ? cached.sleeps : [], newSleeps),
        vitals: sortAndFilter(cached ? cached.vitals : [], newVitals),
        // Sort weight entries by date
        weights: sortAndFilter(cached ? cached.weights : [], newWeights),
        // Keep workout lists sorted and de-duplicated by ID
        workouts: [
          ...(cached ? cached.workouts : []).filter(cw => !newWorkouts.some(nw => nw.id === cw.id)),
          ...newWorkouts,
        ].sort((a, b) => b.date.localeCompare(a.date)), // Workouts sorted chronological descending
        lastSyncTime: new Date().toISOString(),
      };

      // Save to cache
      await saveHealthData(finalStore);
      setHealthData(finalStore);
      
      setSyncProgress(100);
      if (stepErrors.length > 0) {
        const hasNoDataAtAll =
          finalStore.activities.length === 0 &&
          finalStore.heartRates.length === 0 &&
          finalStore.sleeps.length === 0 &&
          finalStore.vitals.length === 0 &&
          finalStore.workouts.length === 0 &&
          finalStore.weights.length === 0;

        if (hasNoDataAtAll || stepErrors.length >= 5) {
          throw new Error("All health data categories failed to sync:\n" + stepErrors.join("\n"));
        } else {
          setSyncError("Sync completed with warnings:\n" + stepErrors.join("\n"));
          setSyncStatusText("Synced with some warnings.");
        }
      } else {
        setSyncStatusText("Synchronization completed successfully!");
      }
      
      // Update selected display date to today if we have files
      if (finalStore.activities.length > 0) {
        setSelectedDate(finalStore.activities[finalStore.activities.length - 1].date);
      }

      // Reset sync fields after 4 seconds to give user time to read
      setTimeout(() => {
        setSyncStatusText(null);
      }, 4000);
    } catch (err: any) {
      console.error("Sync process failure:", err);
      let errorMsg = err.message || "An unexpected synchronization error occurred.";
      if (errorMsg.startsWith("RATE_LIMIT:")) {
        const secs = errorMsg.split(":")[1];
        errorMsg = `Google Health API Rate Limit reached. Please wait ${secs} seconds before clicking 'Sync' again (429 Backoff).`;
      }
      setSyncError(errorMsg);
    } finally {
      setIsSyncing(false);
    }
  }, [isDemoMode]);

  return (
    <HealthContext.Provider
      value={{
        authState,
        healthData,
        isDemoMode,
        isSyncing,
        syncProgress,
        syncStatusText,
        syncError,
        selectedDate,
        setSelectedDate,
        toggleDemoMode,
        login,
        disconnect,
        syncData,
      }}
    >
      {children}
    </HealthContext.Provider>
  );
};

export const useHealth = () => {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error("useHealth must be used within a HealthStoreProvider");
  }
  return context;
};