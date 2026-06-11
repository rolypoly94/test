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
   * Performs an incremental delta sync since last sync date, or full 90-day backfill.
   */
  const syncData = useCallback(async (forceBackfill = false) => {
    if (isDemoMode) {
      // Demo mode simply updates latest sync time to simulate progress
      setIsSyncing(true);
      setSyncProgress(20);
      setSyncStatusText("Simulating Google API handshake...");
      await new Promise((r) => setTimeout(r, 600));
      setSyncProgress(60);
      setSyncStatusText("Regenerating 90-day statistical models...");
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
    setSyncStatusText("Connecting to google health endpoints...");
    setSyncError(null);

    try {
      const today = new Date();
      let daysToFetch = 90;
      let lastSyncDate: Date | null = null;
      
      const cached = await loadHealthData();
      if (cached && cached.lastSyncTime && !forceBackfill) {
        lastSyncDate = new Date(cached.lastSyncTime);
        const diffTime = Math.abs(today.getTime() - lastSyncDate.getTime());
        daysToFetch = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
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

      // Step 1: Fetch sleeping metrics (Date range queries)
      setSyncProgress(10);
      setSyncStatusText("Syncing nocturnal breathing and sleep logs...");
      try {
        newSleeps = await HealthApiClient.getSleep(startStr, endStr);
      } catch (err: any) {
        console.error("Error syncing sleep:", err);
      }

      // Step 2: Fetch nightly vitals (SpO2, HRV, Breathing Rate)
      setSyncProgress(30);
      setSyncStatusText("Acquiring nightly SpO2 and temperatures...");
      try {
        newVitals = await HealthApiClient.getNightlyVitals(startStr, endStr);
      } catch (err: any) {
        console.error("Error syncing vitals:", err);
      }

      // Step 3: Fetch workouts (Exercises)
      setSyncProgress(50);
      setSyncStatusText("Downloading workout records...");
      try {
        newWorkouts = await HealthApiClient.getWorkouts(startStr, endStr);
      } catch (err: any) {
        console.error("Error syncing workouts:", err);
      }

      // Step 4: Fetch weight records
      setSyncProgress(65);
      setSyncStatusText("Syncing body composition logs...");
      try {
        newWeights = await HealthApiClient.getWeights(startStr, endStr);
      } catch (err: any) {
        console.error("Error syncing weight:", err);
      }

      // Step 5: Day-by-day fetching for activity and heart-rate summaries (due to Google REST format constraints)
      setSyncProgress(75);
      setSyncStatusText(`Reconciling daily step counts (${daysToFetch} days)...`);
      
      for (let offset = daysToFetch - 1; offset >= 0; offset--) {
        const progressChunk = 75 + Math.round(( (daysToFetch - offset) / daysToFetch ) * 20);
        setSyncProgress(Math.min(95, progressChunk));

        const targetDate = new Date();
        targetDate.setDate(today.getDate() - offset);
        const dateStr = targetDate.toISOString().split("T")[0];
        setSyncStatusText(`Syncing data for ${dateStr}...`);

        try {
          const act = await HealthApiClient.getActivitySummary(dateStr);
          const idx = currentActivities.findIndex((a) => a.date === dateStr);
          if (idx >= 0) {
            currentActivities[idx] = act;
          } else {
            currentActivities.push(act);
          }
        } catch (err) {
          console.warn(`Failed to sync activity on ${dateStr}`, err);
        }

        try {
          const hr = await HealthApiClient.getHeartRate(dateStr);
          const idx = currentHeartRates.findIndex((h) => h.date === dateStr);
          if (idx >= 0) {
            currentHeartRates[idx] = hr;
          } else {
            currentHeartRates.push(hr);
          }
        } catch (err) {
          console.warn(`Failed to sync heart rate on ${dateStr}`, err);
        }

        // Slight rate limit spacing delay (simulate real world courtesy)
        await new Promise((r) => setTimeout(r, 100));
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
      setSyncStatusText("Synchronization completed successfully!");
      
      // Update selected display date to today if we have files
      if (finalStore.activities.length > 0) {
        setSelectedDate(finalStore.activities[finalStore.activities.length - 1].date);
      }

      // Reset sync fields after 2 seconds
      setTimeout(() => {
        setSyncStatusText(null);
      }, 2000);
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
