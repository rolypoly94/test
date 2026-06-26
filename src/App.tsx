import { HealthStoreProvider, useHealth } from './store/healthStore';
import { ActivityChart } from './components/charts/ActivityChart';
import { HeartRateChart } from './components/charts/HeartRateChart';
import { SleepChart } from './components/charts/SleepChart';
import { VitalsChart } from './components/charts/VitalsChart';
import { WeightChart } from './components/charts/WeightChart';
import { ProgressComparer } from './components/charts/ProgressComparer';
import { WorkoutPanel } from './components/WorkoutPanel';

function AppContent() {
  const {
    authState,
    isDemoMode,
    isSyncing,
    syncError,
    healthData,
    login,
    syncData,
    disconnect,
    toggleDemoMode,
    selectedDate,
    setSelectedDate
  } = useHealth();

  const signedIn = !!authState.accessToken;
  const lastSyncDate = healthData.lastSyncTime;

  const hasNoData =
    healthData.activities.length === 0 &&
    healthData.heartRates.length === 0 &&
    healthData.sleeps.length === 0 &&
    healthData.vitals.length === 0 &&
    healthData.workouts.length === 0 &&
    healthData.weights.length === 0;

  return (
    <div className="app">
      <header>
        <h1>MyHealth Sync</h1>
        <div className="header-actions">
          {isDemoMode && <span className="badge demo">DEMO DATA</span>}
          {lastSyncDate && !isDemoMode && <span className="badge">Last sync: {new Date(lastSyncDate).toLocaleString()}</span>}
          {signedIn ? (
            <>
              <button onClick={() => syncData().catch(() => {})} disabled={isSyncing}>
                {isSyncing ? 'Syncing…' : 'Sync'}
              </button>
              <button className="secondary" onClick={disconnect}>Sign out</button>
            </>
          ) : (
            <>
              <button onClick={() => login().catch(() => {})} disabled={isSyncing}>
                {isSyncing ? 'Syncing…' : 'Sign in with Google'}
              </button>
              {!isDemoMode && <button className="secondary" onClick={toggleDemoMode}>Demo mode</button>}
            </>
          )}
        </div>
      </header>

      {syncError && (
        <div className="error-banner">
          <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>Sync Status Error:</div>
          <div style={{ whiteSpace: "pre-line" }}>{syncError}</div>
          {syncError.includes('403') && (
            <div className="error-hint">
              403 usually means stale consent — revoke access at myaccount.google.com/permissions, then sign in again.
            </div>
          )}
        </div>
      )}

      <main>
        {hasNoData && !isDemoMode ? (
          <div className="empty-state-container" style={{ gridColumn: "1 / -1", padding: "2.5rem", background: "rgba(19, 23, 34, 0.8)", border: "1px dashed rgba(255, 255, 255, 0.1)", borderRadius: "1.25rem", marginTop: "1rem" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1rem", color: "#f8fafc", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              📊 Connection Active — But No Health Data Found
            </h2>
            <p style={{ color: "#94a3b8", lineHeight: "1.6", marginBottom: "1.75rem", fontSize: "0.95rem" }}>
              Your Google authentication connected successfully! However, we couldn't find any health, workout, sleep, or body composition data in your Google Account. Here is why this happens and how to resolve it:
            </p>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
              <div style={{ background: "rgba(30, 41, 59, 0.3)", padding: "1.5rem", borderRadius: "1rem", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <h3 style={{ fontWeight: "600", color: "#3b82f6", marginBottom: "0.75rem", fontSize: "1rem" }}>1. Check Your Permission Boxes</h3>
                <p style={{ color: "#cbd5e1", fontSize: "0.875rem", lineHeight: "1.5" }}>
                  During Google Sign-In, did you check <strong>all</strong> of the requested permission boxes on the Google screen? If any boxes were left unchecked, Google returns empty datasets. Click <strong>Sign Out</strong>, then sign in again and ensure all consent boxes are checked.
                </p>
              </div>
              
              <div style={{ background: "rgba(30, 41, 59, 0.3)", padding: "1.5rem", borderRadius: "1rem", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <h3 style={{ fontWeight: "600", color: "#10b981", marginBottom: "0.75rem", fontSize: "1rem" }}>2. Connect Your Wearable to Google Fit</h3>
                <p style={{ color: "#cbd5e1", fontSize: "0.875rem", lineHeight: "1.5" }}>
                  The health API pulls data recorded by smartwatches or trackers synced with <strong>Google Fit</strong> or <strong>Health Connect</strong> on your mobile device. Ensure you have Google Fit or Health Connect installed on your phone and synced with your wearable (Fitbit, Garmin, Pixel Watch, Apple Watch via sync utilities, or Samsung Health).
                </p>
              </div>
              
              <div style={{ background: "rgba(30, 41, 59, 0.3)", padding: "1.5rem", borderRadius: "1rem", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <h3 style={{ fontWeight: "600", color: "#a855f7", marginBottom: "0.75rem", fontSize: "1rem" }}>3. Cloud Synchronization Delay</h3>
                <p style={{ color: "#cbd5e1", fontSize: "0.875rem", lineHeight: "1.5" }}>
                  Wait a few minutes if you recently connected your tracker. Syncing between your wearable application, Health Connect/Google Fit, and Google's cloud servers can take a brief period to fully propagate.
                </p>
              </div>
            </div>
            
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
              <button onClick={() => syncData(true)} disabled={isSyncing}>
                {isSyncing ? "Syncing..." : "Force Full 365-Day Sync"}
              </button>
              <button className="secondary" onClick={toggleDemoMode}>
                Use Simulated Demo Data (Immediate View)
              </button>
            </div>
          </div>
        ) : (
          <>
            <ProgressComparer healthData={healthData} />
            <ActivityChart activities={healthData.activities} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <HeartRateChart heartRates={healthData.heartRates} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <SleepChart sleeps={healthData.sleeps} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <VitalsChart vitals={healthData.vitals} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <WorkoutPanel workouts={healthData.workouts} />
            <WeightChart weights={healthData.weights} />
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HealthStoreProvider>
      <AppContent />
    </HealthStoreProvider>
  );
}
