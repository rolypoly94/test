/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { NightlyVitals } from "../../types";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Gauge, Sparkles, Activity, Thermometer, Info } from "lucide-react";

interface VitalsChartProps {
  vitals: NightlyVitals[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

type VitalMetric = "spo2" | "breathingRate" | "hrv" | "skinTempVariation";

export const VitalsChart: React.FC<VitalsChartProps> = ({ vitals, selectedDate, onSelectDate }) => {
  const [activeMetric, setActiveMetric] = useState<VitalMetric>("spo2");
  const [timeframe, setTimeframe] = useState<"7d" | "30d">("7d");

  // Trend subset
  const trendData = useMemo(() => {
    const limit = timeframe === "7d" ? 7 : 30;
    return vitals.slice(-limit);
  }, [vitals, timeframe]);

  // Current selected day's record
  const selectedRecord = useMemo(() => {
    return vitals.find((v) => v.date === selectedDate) || vitals[vitals.length - 1];
  }, [vitals, selectedDate]);

  const configs = {
    spo2: {
      label: "Blood Oxygen (SpO2)",
      color: "#06b6d4", // Cyan
      icon: Gauge,
      unit: "%",
      domain: [90, 100],
      formatter: (v: number) => `${v}%`,
      description: "Average percentage of oxygen in blood during sleep.",
    },
    breathingRate: {
      label: "Breathing Rate",
      color: "#a855f7", // Purple
      icon: Activity,
      unit: "br/min",
      domain: ["dataMin - 1", "dataMax + 1"],
      formatter: (v: number) => `${v} br/min`,
      description: "Average number of breaths taken per minute during sleep.",
    },
    hrv: {
      label: "Heart Rate Variability (HRV)",
      color: "#f43f5e", // Rose
      icon: Sparkles,
      unit: "ms",
      domain: ["dataMin - 10", "dataMax + 10"],
      formatter: (v: number) => `${v} ms`,
      description: "The variation in time between consecutive heartbeats during deep sleep.",
    },
    skinTempVariation: {
      label: "Skin Temperature Variation",
      color: "#f59e0b", // Amber
      icon: Thermometer,
      unit: "°C",
      domain: [-1.5, 1.5],
      formatter: (v: number) => `${v > 0 ? "+" : ""}${v}°C`,
      description: "Your nightly skin temperature deviation compared to your personal baseline.",
    },
  };

  const activeConf = configs[activeMetric];

  // Calculate vital averages
  const vitalStats = useMemo(() => {
    if (trendData.length === 0) return { min: 0, max: 0, avg: 0 };
    const vals = trendData.map((d) => d[activeMetric]);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)),
    };
  }, [trendData, activeMetric]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.45)]" id="vitals-chart-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2 font-display">
            <Sparkles className="h-5 w-5 text-cyan-400 animate-pulse" />
            Nightly Vitals Trend
          </h3>
          <p className="text-slate-400 text-sm mt-0.5">
            Fitbit Charge 6 overnight vital parameters and deviations
          </p>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setTimeframe("7d")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              timeframe === "7d"
                ? "bg-slate-800 text-slate-100 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTimeframe("30d")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              timeframe === "30d"
                ? "bg-slate-800 text-slate-100 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Grid of indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {(Object.keys(configs) as VitalMetric[]).map((key) => {
          const cfg = configs[key];
          const isSelected = activeMetric === key;
          const displayVal = selectedRecord ? selectedRecord[key] : null;
          const Icon = cfg.icon;

          return (
            <button
              key={key}
              onClick={() => setActiveMetric(key)}
              className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                isSelected
                  ? "bg-slate-800/60 border-slate-700 shadow-md ring-1 ring-slate-700/50"
                  : "bg-slate-950/40 border-slate-800/60 hover:bg-slate-800/20 hover:border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase ${isSelected ? "text-slate-300" : "text-slate-500"} tracking-wider`}>
                  {cfg.label.split(" (")[0]}
                </span>
                <Icon className="h-4 w-4" style={{ color: cfg.color }} />
              </div>
              <div className="mt-2.5 flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-100 tracking-tight font-display">
                  {displayVal !== null && displayVal !== undefined ? cfg.formatter(displayVal) : "--"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Graph */}
      <div className="h-64 w-full">
        {trendData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
            No vitals logs cached. Pull to sync.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradientVital-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeConf.color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={activeConf.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(dateStr) => {
                  const parts = dateStr.split("-");
                  return `${parts[1]}/${parts[2]}`;
                }}
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
              />
              <YAxis domain={activeConf.domain as any} stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0b1329",
                  borderColor: "#1e293b",
                  borderRadius: "12px",
                }}
                labelStyle={{ color: "#94a3b8", fontWeight: 600, fontSize: "12px" }}
                itemStyle={{ color: activeConf.color, fontSize: "12px" }}
                formatter={(val: any) => [activeConf.formatter(val), activeConf.label]}
              />
              <Area
                type="monotone"
                dataKey={activeMetric}
                name={activeConf.label}
                stroke={activeConf.color}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#gradientVital-${activeMetric})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Description & aggregates bar */}
      <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-slate-800/80 pt-4 text-xs">
        <div className="text-slate-400 font-medium max-w-lg">
          {activeConf.description}
        </div>
        <div className="flex gap-4 font-mono text-slate-500 self-start md:self-auto shrink-0">
          <div>
            MIN: <span className="text-slate-300 font-bold">{activeConf.formatter(vitalStats.min)}</span>
          </div>
          <div>
            AVG: <span className="text-slate-300 font-bold">{activeConf.formatter(vitalStats.avg)}</span>
          </div>
          <div>
            MAX: <span className="text-slate-300 font-bold">{activeConf.formatter(vitalStats.max)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
