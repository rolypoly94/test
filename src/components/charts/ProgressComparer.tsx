/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { HealthDataStore } from "../../types";
import { TrendingUp, TrendingDown, Minus, Info, ClipboardList } from "lucide-react";

interface ProgressComparerProps {
  healthData: HealthDataStore;
}

type CompareMetric = "steps" | "caloriesBurned" | "activeZoneMinutes" | "sleepDuration" | "restingHr" | "hrv" | "weight";

export const ProgressComparer: React.FC<ProgressComparerProps> = ({ healthData }) => {
  const [activeMetric, setActiveMetric] = useState<CompareMetric>("steps");

  const metrics = [
    { value: "steps", label: "Daily Steps", category: "Activity" },
    { value: "caloriesBurned", label: "Calories Burned", category: "Activity" },
    { value: "activeZoneMinutes", label: "Active Zone Minutes", category: "Activity" },
    { value: "sleepDuration", label: "Sleep Duration", category: "Sleep" },
    { value: "restingHr", label: "Resting Heart Rate", category: "Heart" },
    { value: "hrv", label: "Nightly HRV", category: "Vitals" },
    { value: "weight", label: "Body Weight", category: "Body" },
  ];

  // Map dates helper
  const getDaysAgo = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  };

  const comparisonData = useMemo(() => {
    // 1. Establish date benchmarks
    const todayStr = getDaysAgo(0);
    const sixDaysAgoStr = getDaysAgo(6);
    const s7DaysAgoStr = getDaysAgo(7);
    const s13DaysAgoStr = getDaysAgo(13);
    
    const s29DaysAgoStr = getDaysAgo(29);
    const s30DaysAgoStr = getDaysAgo(30);
    const s59DaysAgoStr = getDaysAgo(59);

    // 2. Helper to fetch values based on metric selection
    const getMetricValues = (dateStr: string): number | null => {
      switch (activeMetric) {
        case "steps": {
          const act = healthData.activities.find((a) => a.date === dateStr);
          return act ? act.steps : null;
        }
        case "caloriesBurned": {
          const act = healthData.activities.find((a) => a.date === dateStr);
          return act ? act.caloriesBurned : null;
        }
        case "activeZoneMinutes": {
          const act = healthData.activities.find((a) => a.date === dateStr);
          return act ? act.activeZoneMinutes : null;
        }
        case "sleepDuration": {
          const sl = healthData.sleeps.find((s) => s.date === dateStr);
          return sl ? sl.durationMinutes : null;
        }
        case "restingHr": {
          const hr = healthData.heartRates.find((h) => h.date === dateStr);
          return hr ? hr.restingHeartRate : null;
        }
        case "hrv": {
          const vt = healthData.vitals.find((v) => v.date === dateStr);
          return vt ? vt.hrv : null;
        }
        case "weight": {
          // Weight metrics might be less frequent (weekly), so query nearest preceding if direct is missing
          const wt = healthData.weights.find((w) => w.date === dateStr);
          if (wt) return wt.weightKg;
          
          // Fallback scan
          const sortedWts = [...healthData.weights]
            .filter((w) => w.date <= dateStr)
            .sort((a, b) => b.date.localeCompare(a.date));
          return sortedWts.length > 0 ? sortedWts[0].weightKg : null;
        }
        default:
          return null;
      }
    };

    // 3. Helper to aggregate averages or sums for a given date range
    const aggregatePeriod = (startDateStr: string, endDateStr: string): number => {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      let total = 0;
      let count = 0;

      // Loop date from startDateStr to endDateStr inclusive
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const curDateStr = d.toISOString().split("T")[0];
        const val = getMetricValues(curDateStr);
        if (val !== null) {
          total += val;
          count++;
        }
      }

      if (count === 0) return 0;
      
      // For weights and Resting HR or HRV, we always prefer average. For steps, calories, active mins, sleep, we use Average or sum.
      // Let's use Averages for all to maintain comparative scaling consistency across custom sample logs.
      return activeMetric === "steps" || activeMetric === "caloriesBurned" || activeMetric === "activeZoneMinutes"
        ? Math.round(total / count) // Average steps/calories per day
        : parseFloat((total / count).toFixed(1)); // Rounded average decimal
    };

    // Calculate Week 1 (This Week) vs Week 2 (Last Week)
    const thisWeekVal = aggregatePeriod(sixDaysAgoStr, todayStr);
    const lastWeekVal = aggregatePeriod(s13DaysAgoStr, s7DaysAgoStr);

    // Calculate Month 1 (This Month) vs Month 2 (Last Month)
    const thisMonthVal = aggregatePeriod(s29DaysAgoStr, todayStr);
    const lastMonthVal = aggregatePeriod(s59DaysAgoStr, s30DaysAgoStr);

    // Calculate Percentage changes safely
    const calculatePctChange = (current: number, past: number): number => {
      if (past === 0) return 0;
      return parseFloat((((current - past) / past) * 100).toFixed(1));
    };

    const weekPct = calculatePctChange(thisWeekVal, lastWeekVal);
    const monthPct = calculatePctChange(thisMonthVal, lastMonthVal);

    return {
      thisWeekVal,
      lastWeekVal,
      weekPct,
      thisMonthVal,
      lastMonthVal,
      monthPct,
    };
  }, [healthData, activeMetric]);

  const unitFormats = {
    steps: "steps / day",
    caloriesBurned: "kcal / day",
    activeZoneMinutes: "mins / day",
    sleepDuration: "mins / night",
    restingHr: "bpm",
    hrv: "ms",
    weight: "kg",
  };

  const getFormatLabel = (val: number) => {
    if (activeMetric === "sleepDuration") {
      const hrs = Math.floor(val / 60);
      const mins = Math.round(val % 60);
      return `${hrs}h ${mins}m`;
    }
    return val.toLocaleString();
  };

  // Determine if a positive change represents beneficial progression:
  // e.g. RHR decrease is GOOD. Weight decrease is usually GOOD. Steps increase is GOOD.
  const isBeneficial = (pct: number) => {
    if (pct === 0) return null;
    
    const isIncrease = pct > 0;
    if (activeMetric === "restingHr" || activeMetric === "weight") {
      // Decreasing is beneficial
      return !isIncrease;
    }
    // Increasing is beneficial
    return isIncrease;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6" id="progress-comparer-container">
      {/* Upper Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-indigo-400" />
            Adaptive Progress Compare
          </h3>
          <p className="text-slate-400 text-sm mt-0.5">
            Identify behavioral improvements across weeks and months
          </p>
        </div>

        {/* Metric selection Box */}
        <div className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 max-w-sm self-start md:self-auto">
          <select
            value={activeMetric}
            onChange={(e) => setActiveMetric(e.target.value as CompareMetric)}
            className="bg-transparent text-slate-100 text-sm font-semibold focus:outline-none cursor-pointer pr-4"
            id="progress-metric-select"
          >
            {metrics.map((m) => (
              <option key={m.value} value={m.value} className="bg-slate-950 text-slate-200">
                {m.category}: {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid Comparisons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Weekly Sync comparison */}
        <div className="bg-slate-950/45 border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h4 className="text-slate-400 text-xs font-bold font-mono uppercase tracking-wider">Weekly Progression</h4>
            <div className="mt-4 grid grid-cols-2 gap-4 pb-4 border-b border-slate-900">
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">This Week Avg</span>
                <span className="text-xl font-black text-slate-100 block mt-1">
                  {getFormatLabel(comparisonData.thisWeekVal)}
                </span>
                <span className="text-[9px] text-slate-500 font-mono italic">
                  {unitFormats[activeMetric]}
                </span>
              </div>
              
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Last Week Avg</span>
                <span className="text-xl font-black text-slate-400 block mt-1">
                  {getFormatLabel(comparisonData.lastWeekVal)}
                </span>
                <span className="text-[9px] text-slate-500 font-mono italic">
                  {unitFormats[activeMetric]}
                </span>
              </div>
            </div>
          </div>

          {/* Week Results Indicator */}
          <div className="mt-4 flex items-center gap-4">
            {comparisonData.weekPct === 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                <Minus className="h-4 w-4" />
                No change identified
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 text-sm font-mono ${
                    isBeneficial(comparisonData.weekPct) === true
                      ? "bg-emerald-500/10 text-emerald-400"
                      : isBeneficial(comparisonData.weekPct) === false
                      ? "bg-rose-500/10 text-rose-400"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {comparisonData.weekPct > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {comparisonData.weekPct > 0 ? "+" : ""}
                  {comparisonData.weekPct}%
                </div>
                <div className="text-[11px] text-slate-400 max-w-xs">
                  {isBeneficial(comparisonData.weekPct) === true ? (
                    <span className="text-emerald-400 font-bold">Optimal progress!</span>
                  ) : (
                    <span className="text-rose-400 font-bold">Deficit warning.</span>
                  )}{" "}
                  Your average performance shifted by {comparisonData.weekPct}% compared to last week.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Monthly Sync comparison */}
        <div className="bg-slate-950/45 border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h4 className="text-slate-400 text-xs font-bold font-mono uppercase tracking-wider">Monthly Progression</h4>
            <div className="mt-4 grid grid-cols-2 gap-4 pb-4 border-b border-slate-900">
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">This Month Avg</span>
                <span className="text-xl font-black text-slate-100 block mt-1">
                  {getFormatLabel(comparisonData.thisMonthVal)}
                </span>
                <span className="text-[9px] text-slate-500 font-mono italic">
                  {unitFormats[activeMetric]}
                </span>
              </div>
              
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Last Month Avg</span>
                <span className="text-xl font-black text-slate-400 block mt-1">
                  {getFormatLabel(comparisonData.lastMonthVal)}
                </span>
                <span className="text-[9px] text-slate-500 font-mono italic">
                  {unitFormats[activeMetric]}
                </span>
              </div>
            </div>
          </div>

          {/* Month Results Indicator */}
          <div className="mt-4 flex items-center gap-4">
            {comparisonData.monthPct === 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                <Minus className="h-4 w-4" />
                No change identified
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 text-sm font-mono ${
                    isBeneficial(comparisonData.monthPct) === true
                      ? "bg-emerald-500/10 text-emerald-400"
                      : isBeneficial(comparisonData.monthPct) === false
                      ? "bg-rose-500/10 text-rose-400"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {comparisonData.monthPct > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {comparisonData.monthPct > 0 ? "+" : ""}
                  {comparisonData.monthPct}%
                </div>
                <div className="text-[11px] text-slate-400 max-w-xs">
                  {isBeneficial(comparisonData.monthPct) === true ? (
                    <span className="text-emerald-400 font-bold">Optimal progress!</span>
                  ) : (
                    <span className="text-rose-400 font-bold">Deficit warning.</span>
                  )}{" "}
                  Your core monthly metric averages shifted by {comparisonData.monthPct}% compared to last month.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info notice bar */}
      <div className="mt-4 bg-slate-950/20 border border-slate-800/40 p-3 rounded-lg flex items-start gap-2.5 text-xs text-slate-400">
        <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
        <p>
          Calculations compare the average value of your logged metrics over Week 1 (Days 0-6 ago) vs Week 2 (Days 7-13 ago), and Month 1 (Days 0-29 ago) vs Month 2 (Days 30-59 ago). Averages adjust dynamically on each synchronization.
        </p>
      </div>
    </div>
  );
};
