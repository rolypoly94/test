/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { parseFitbitTakeout, type TakeoutProgress } from "../api/fitbitTakeout";
import { useHealth } from "../store/healthStore";

export const TakeoutImport: React.FC = () => {
  const { importTakeoutData } = useHealth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<TakeoutProgress | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setResult(null);
    setError(null);
    setProgress({ filesScanned: 0, filesTotal: files.length, status: "Starting…" });

    try {
      const data = await parseFitbitTakeout(files, setProgress);
      await importTakeoutData(data);

      const parts: string[] = [];
      if (data.activities?.length)  parts.push(`${data.activities.length} days of activity`);
      if (data.heartRates?.length)  parts.push(`${data.heartRates.length} days of heart rate`);
      if (data.sleeps?.length)      parts.push(`${data.sleeps.length} sleep records`);
      if (data.weights?.length)     parts.push(`${data.weights.length} weight entries`);
      if (data.vitals?.length)      parts.push(`${data.vitals.length} days of vitals`);
      setResult("Imported: " + (parts.length ? parts.join(", ") : "no matching files found"));
    } catch (e: any) {
      setError(e.message || "Failed to parse Takeout data");
    } finally {
      setIsProcessing(false);
      setProgress(null);
      // Reset input so the same folder can be re-selected if needed
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const pct = progress && progress.filesTotal > 0
    ? Math.round((progress.filesScanned / progress.filesTotal) * 100)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {/* Hidden directory picker */}
      <input
        ref={inputRef}
        type="file"
        // @ts-ignore – webkitdirectory is non-standard but supported in all modern browsers
        webkitdirectory=""
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        className="secondary"
        onClick={() => { setResult(null); setError(null); inputRef.current?.click(); }}
        disabled={isProcessing}
        title="Select the Fitbit folder inside your unzipped Google Takeout export"
      >
        {isProcessing ? "Importing…" : "📂 Import Fitbit Takeout"}
      </button>

      {isProcessing && progress && (
        <div style={{ fontSize: "0.75rem", color: "var(--md-on-surface-variant)" }}>
          <div style={{
            height: "3px", borderRadius: "2px", background: "var(--md-surface-container-highest)",
            marginBottom: "0.3rem", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: "2px", background: "var(--md-primary)",
              width: `${pct}%`, transition: "width 0.3s ease",
            }} />
          </div>
          {progress.status}
          {progress.filesTotal > 0 && ` (${progress.filesScanned}/${progress.filesTotal} files)`}
        </div>
      )}

      {result && (
        <div style={{ fontSize: "0.75rem", color: "var(--md-tertiary)" }}>
          ✓ {result}
        </div>
      )}

      {error && (
        <div style={{ fontSize: "0.75rem", color: "var(--md-error)" }}>
          {error}
        </div>
      )}
    </div>
  );
};
