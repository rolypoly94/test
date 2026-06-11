/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useHealth } from "../store/healthStore";
import { GOOGLE_CLIENT_ID } from "../config";
import { KeyRound, ShieldAlert, CloudLightning, Copy, Check, ToggleLeft, ToggleRight, RefreshCw, LogOut, CheckCircle, Smartphone } from "lucide-react";

export const ConnectionPanel: React.FC = () => {
  const {
    authState,
    isDemoMode,
    isSyncing,
    syncProgress,
    syncStatusText,
    syncError,
    login,
    disconnect,
    syncData,
    toggleDemoMode,
  } = useHealth();

  const [copiedType, setCopiedType] = useState<"dev" | "prod" | null>(null);

  const devUrl = `${window.location.origin}/`;
  // Shared app URL fallback is useful for display
  const sharedUrl = "https://ais-pre-zdsr7k3xk6pvml5b4pfrbd-642761539186.asia-southeast1.run.app/";

  const handleCopy = (text: string, type: "dev" | "prod") => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="space-y-6" id="connection-panel-container">
      {/* Configuration Hub Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-indigo-400" />
          Google OAuth 2.0 PKCE setup
        </h3>
        <p className="text-slate-400 text-sm mt-1">
          To display data recorded by your Fitbit Charge 6, connect or run simulated telemetry.
        </p>

        {/* Sync Status Overlay / Banner */}
        {syncError && (
          <div className="mt-4 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-sm font-bold text-slate-200">Sync Error Identified</h5>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{syncError}</p>
            </div>
          </div>
        )}

        {isSyncing && (
          <div className="mt-4 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300">
              <span className="flex items-center gap-2 animate-pulse font-medium text-slate-200">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                {syncStatusText}
              </span>
              <span className="font-bold">{syncProgress}%</span>
            </div>
            {/* Real Progress Bar */}
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                style={{ width: `${syncProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Active connection widgets */}
        <div className="mt-6 p-5 rounded-xl border border-slate-800 bg-slate-950/45 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1 max-w-lg">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Sync State</span>
            <div className="flex items-center gap-2">
              {authState.accessToken && !isDemoMode ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-sm font-bold text-slate-200">Connected with Google Health API</span>
                </>
              ) : isDemoMode ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-sm font-bold text-slate-200">Running in Demo Mode (Simulating Charge 6 telemetry)</span>
                </>
              ) : (
                <>
                  <div className="h-2 w-2 rounded-full bg-slate-600" />
                  <span className="text-sm font-bold text-slate-200">Disconnected offline</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              {authState.accessToken && !isDemoMode
                ? `Successfully synced. Your credentials will remain active until you click 'Disconnect'.`
                : "Active simulation populates the dials with 90 days of high-fidelity Charge 6 records."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto shrink-0 justify-end">
            {/* Demo Mode Toggle Button */}
            <button
              onClick={toggleDemoMode}
              className={`px-4 py-2 text-xs font-semibold rounded-xl border flex items-center gap-2 transition cursor-pointer ${
                isDemoMode
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/15"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
              }`}
              disabled={isSyncing}
              id="btn-toggle-demo"
            >
              Simulation: {isDemoMode ? "ON" : "OFF"}
            </button>

            {/* Sync now button if logged in */}
            {authState.accessToken && !isDemoMode ? (
              <>
                <button
                  onClick={() => syncData()}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-slate-100 rounded-xl flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
                  id="btn-sync-now"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  Sync Now
                </button>
                <button
                  onClick={disconnect}
                  className="px-4 py-2 bg-slate-900 hover:bg-rose-950/20 hover:border-rose-500/20 border border-slate-800 text-slate-400 hover:text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                  id="btn-disconnect"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={login}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-extrabold text-slate-100 rounded-xl flex items-center gap-2 shadow-md shadow-indigo-600/30 transition cursor-pointer"
                id="btn-connect-google"
              >
                <CloudLightning className="h-4 w-4" />
                Connect Google Account
              </button>
            )}
          </div>
        </div>
      </div>

      {/* GCP Creds Step-by-Step guides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step-by-step directions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h4 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
            <Smartphone className="h-4.5 w-4.5 text-emerald-400" />
            1. Configure Google Cloud Console
          </h4>
          <div className="mt-4 text-xs text-slate-400 space-y-4 leading-relaxed font-sans">
            <p>
              To authorize your real Fitbit Charge 6, configure a Google Cloud Credentials profile:
            </p>
            <ol className="list-decimal pl-4 space-y-2.5">
              <li>
                Open the <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google Cloud Console</a> and create a fresh project.
              </li>
              <li>
                Type <strong className="text-slate-300">"Google Health API"</strong> in the search bar (or the active Fitbit integration portal) and click <strong className="text-slate-300">Enable</strong>.
              </li>
              <li>
                Navigate to <strong className="text-slate-300">OAuth Consent Screen</strong>. Set User Type to <strong className="text-slate-300">External</strong>, then enter app metadata.
              </li>
              <li>
                Under the <strong className="text-slate-300">Testing</strong> tab, add <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1 py-0.5 rounded font-mono">yadavsumit1301@gmail.com</span> as an Authorized Test User (Google blocks non-test emails during consent trials).
              </li>
              <li>
                Navigate to <strong className="text-slate-300">Credentials</strong>, click <strong className="text-slate-300">Create Credentials</strong> &rarr; <strong className="text-slate-300">OAuth Client ID</strong>. Select <strong className="text-slate-300">Web Application</strong>.
              </li>
              <li>
                Register the precise redirect URIs displayed on the right, and paste your generated client ID inside <span className="text-slate-300 font-mono">src/config.ts</span>!
              </li>
            </ol>
          </div>
        </div>

        {/* Copyable Redirect URIs card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
              <CheckCircle className="h-4.5 w-4.5 text-indigo-400" />
              2. Authorized Redirect URIs
            </h4>
            <p className="text-slate-400 text-xs mt-1 leading-relaxed">
              Copy and paste these exact URL paths into the <strong className="text-slate-300">Authorized redirect URIs</strong> box inside GCP:
            </p>

            <div className="mt-4 space-y-4">
              {/* Development URI cell */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider">Development Redirect (Active Sandbox)</span>
                <div className="flex bg-slate-950 rounded-xl border border-slate-800 p-2 text-xs font-mono text-slate-300 justify-between items-center group overflow-hidden">
                  <span className="truncate pr-4">{devUrl}</span>
                  <button
                    onClick={() => handleCopy(devUrl, "dev")}
                    className="p-1 px-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition shrink-0 cursor-pointer"
                  >
                    {copiedType === "dev" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Shared URI cell */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider">Shared App Redirect (Production Callback)</span>
                <div className="flex bg-slate-950 rounded-xl border border-slate-800 p-2 text-xs font-mono text-slate-300 justify-between items-center group overflow-hidden">
                  <span className="truncate pr-4">{sharedUrl}</span>
                  <button
                    onClick={() => handleCopy(sharedUrl, "prod")}
                    className="p-1 px-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition shrink-0 cursor-pointer"
                  >
                    {copiedType === "prod" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Client ID Check block */}
          <div className="mt-5 border-t border-slate-800/80 pt-4 text-xs space-y-2">
            <div className="flex items-center justify-between font-mono text-slate-400">
              <span>ACTIVE CLIENT ID:</span>
              <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{GOOGLE_CLIENT_ID}</span>
            </div>
            {GOOGLE_CLIENT_ID.startsWith("YOUR_OAUTH") ? (
              <p className="text-[11px] text-rose-400 leading-relaxed">
                ⚠️ Currently using default placeholder. You must update GOOGLE_CLIENT_ID in config.ts to establish real GCP handshakes.
              </p>
            ) : (
              <p className="text-[11px] text-emerald-400 leading-relaxed font-sans flex items-center gap-1">
                ✓ Client ID configuration updated and loaded.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
