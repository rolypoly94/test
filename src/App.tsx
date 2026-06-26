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
          Sync failed: {syncError}
          {syncError.includes('403') && (
            <div className="error-hint">
              403 usually means stale consent — revoke access at myaccount.google.com/permissions, then sign in again.
            </div>
          )}
        </div>
      )}

      <main>
        {healthData ? (
          <>
            <ProgressComparer healthData={healthData} />
            <ActivityChart activities={healthData.activities} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <HeartRateChart heartRates={healthData.heartRates} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <SleepChart sleeps={healthData.sleeps} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <VitalsChart vitals={healthData.vitals} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <WorkoutPanel workouts={healthData.workouts} />
            <WeightChart weights={healthData.weights} />
          </>
        ) : (
          <div className="no-data">
            {signedIn ? "Loading your health data..." : "Sign in to sync your health data"}
          </div>
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
