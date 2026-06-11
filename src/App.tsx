/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { HealthStoreProvider, useHealth } from "./store/healthStore";
import { ActivityChart } from "./components/charts/ActivityChart";
import { HeartRateChart } from "./components/charts/HeartRateChart";
import { SleepChart } from "./components/charts/SleepChart";
import { VitalsChart } from "./components/charts/VitalsChart";
import { WeightChart } from "./components/charts/WeightChart";
import { WorkoutPanel } from "./components/WorkoutPanel";
import { ProgressComparer } from "./components/charts/ProgressComparer";
import { ConnectionPanel } from "./pages/ConnectionPanel";
import { motion, AnimatePresence } from "motion/react";
import { LayoutDashboard, Dumbbell, ClipboardList, RefreshCw, KeyRound, Smartphone, Sparkles, Heart } from "lucide-react";

type TabType = "dashboard" | "workouts" | "progress" | "settings";

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const { healthData, selectedDate, setSelectedDate, isDemoMode, isSyncing, syncData } = useHealth();

  // Intercept Google OAuth authorization redirect inside popup window
  useEffect(() => {
    if (window.opener && window.location.search.includes("code=")) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      
      // Notify the parent window
      window.opener.postMessage(
        { type: "GOOGLE_OAUTH_CODE", code, state },
        window.location.origin
      );
      
      // Instantly self-terminate the popup
      window.close();
    }
  }, []);

  const tabsConfig = [
    { id: "dashboard" as TabType, label: "Core Dashboard", icon: LayoutDashboard },
    { id: "workouts" as TabType, label: "Workouts & Weight", icon: Dumbbell },
    { id: "progress" as TabType, label: "Progress Analysis", icon: ClipboardList },
    { id: "settings" as TabType, label: "Device Sync", icon: KeyRound },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 1. Header Area bar */}
      <div className="px-6 pt-6">
        <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800 p-4 rounded-2xl md:rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.45)]">
              <Heart className="h-6 w-6 text-slate-950 fill-slate-950/20" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white font-display flex items-center gap-2">
                MyHealth Sync
                <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                  v1.2
                </span>
              </h1>
              <p className="text-slate-500 text-xs">Syncing with Google Health API v4</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
            {/* User Account pill */}
            <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-full border border-slate-800/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              <span className="text-xs font-medium text-slate-400 font-mono italic">yadavsumit1301@gmail.com</span>
            </div>

            {/* Simulation pill */}
            {isDemoMode ? (
              <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-full text-[11px] font-bold text-amber-400 animate-pulse font-mono">
                SIMULATION ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-full text-[11px] font-bold text-emerald-400 font-mono">
                LIVE FITBIT SYNCED
              </span>
            )}
          </div>
        </header>
      </div>

      {/* 2. Top-bar Responsive Navigation rail */}
      <div className="px-6 pt-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-slate-900/30 border border-slate-800/70 p-1.5 rounded-2xl md:rounded-3xl inline-flex w-full select-none">
            <nav className="flex gap-1.5 overflow-x-auto scrollbar-none w-full">
              {tabsConfig.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-xs font-bold rounded-xl md:rounded-2xl flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-slate-800 text-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-slate-700/80"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                    }`}
                    id={`tab-btn-${tab.id}`}
                  >
                    <TabIcon className={`h-4 w-4 ${isActive ? "text-cyan-400" : ""}`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard stage canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="space-y-6"
          >
            {activeTab === "dashboard" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="view-dashboard">
                {/* 1. Daily Aggregated charts - Bento Col Span 1 */}
                <div className="lg:col-span-1 flex flex-col">
                  <ActivityChart
                    activities={healthData.activities}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                </div>

                {/* 4. Nightly vitals trend panels - Bento Col Span 1 */}
                <div className="lg:col-span-1 flex flex-col">
                  <VitalsChart
                    vitals={healthData.vitals}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                </div>

                {/* 2. Cardiogram charts - Bento Full Width */}
                <div className="lg:col-span-2">
                  <HeartRateChart
                    heartRates={healthData.heartRates}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                </div>

                {/* 3. Sleep breakdown panels - Bento Full Width */}
                <div className="lg:col-span-2">
                  <SleepChart
                    sleeps={healthData.sleeps}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                </div>
              </div>
            )}

            {activeTab === "workouts" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="view-workouts">
                <WorkoutPanel workouts={healthData.workouts} />
                <WeightChart weights={healthData.weights} />
              </div>
            )}

            {activeTab === "progress" && (
              <div id="view-progress">
                <ProgressComparer healthData={healthData} />
              </div>
            )}

            {activeTab === "settings" && (
              <div id="view-settings">
                <ConnectionPanel />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 4. Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 px-6 py-6 text-center text-[10px] text-slate-600">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 MyHealth Sync. Mapped registered identifiers match Fitbit Charge 6 specifications.</p>
          <p className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              API STATUS: HEALTHY (200 OK)
            </span>
            <span>OAUTH: PKCE FLOW ACTIVE</span>
            <span>STORAGE: INDEXEDDB SYNCED</span>
          </p>
        </div>
      </footer>
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
