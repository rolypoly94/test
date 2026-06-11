/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { DailyActivity } from "../../types";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Activity, Flame, Milestone, ArrowUpRight, Award, Footprints } from "lucide-react";

interface ActivityChartProps {
  activities: DailyActivity[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

type ActivityMetric = "steps" | "caloriesBurned" | "activeZoneMinutes" | "distanceKm" | "floors";

export const ActivityChart: React.FC<ActivityChartProps> = ({ activities, selectedDate, onSelectDate }) => {
  const [activeMetric, setActiveMetric] = useState<ActivityMetric>("steps");
  const [timeframe, setTimeframe] = useState<"7d" | "30d">("7d");

  // Filter activities based on timeframe
  const filteredData = useMemo(() => {
    const limit = timeframe === "7d" ? 7 : 30;
    return activities.slice(-limit);
  }, [activities, timeframe]);

  // Find active record
  const selectedRecord = useMemo(() => {
    return activities.find((a) => a.date === selectedDate) || activities[activities.length - 1];
  }, [activities, selectedDate]);

  const metricConfigs = {
    steps: {
      label: "Steps",
      color: "#10b981", // Emerald
      icon: Footprints,
      unit: "steps",
      formatter: (val: number) => val.toLocaleString(),
    },
    caloriesBurned: {
      label: "Calories",
      color: "#f97316", // Orange/Flame
      icon: Flame,
      unit: "kcal",
      formatter: (val: number) => `${val.toLocaleString()} kcal`,
    },
    activeZoneMinutes: {
      label: "Active Zone Minutes",
      color: "#a855f7", // Purple/Award
      icon: Award,
      unit: "mins",
      formatter: (val: number) => `${val} mins`,
    },
    distanceKm: {
      label: "Distance",
      color: "#3b82f6", // Blue/Milestone
      icon: Milestone,
      unit: "km",
      formatter: (val: number) => `${val} km`,
    },
    floors: {
      label: "Floors Climbed",
      color: "#eab308", // Yellow
      icon: ArrowUpRight,
      unit: "floors",
      formatter: (val: number) => `${val} floors`,
    },
  };

  const activeConf = metricConfigs[activeMetric];

  // Quick stats calculations
  const stats = useMemo(() => {
    if (filteredData.length === 0) return { avg: 0, total: 0 };
    const sum = filteredData.reduce((acc, curr) => acc + curr[activeMetric], 0);
    return {
      total: sum,
      avg: Math.round(sum / filteredData.length),
    };
  }, [filteredData, activeMetric]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.45)]" id="activity-chart-container">
      {/* Upper header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2 font-display">
            <Activity className="h-5 w-5 text-cyan-400" />
            Activity Summaries
          </h3>
          <p className="text-slate-400 text-sm mt-0.5">
            Fitbit Charge 6 steps, calories, elevation, and intensity
          </p>
        </div>

        {/* 7d vs 30d toggle */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setTimeframe("7d")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              timeframe === "7d"
                ? "bg-slate-800 text-slate-100 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            id="btn-timeframe-7d"
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
            id="btn-timeframe-30d"
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Primary Metrics Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {(Object.keys(metricConfigs) as ActivityMetric[]).map((key) => {
          const cfg = metricConfigs[key];
          const isActive = activeMetric === key;
          const Icon = cfg.icon;
          const displayVal = selectedRecord ? selectedRecord[key] : 0;

          return (
            <button
              key={key}
              onClick={() => setActiveMetric(key)}
              className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                isActive
                  ? "bg-slate-800/60 border-slate-700 shadow-md ring-1 ring-slate-700/50"
                  : "bg-slate-950/40 border-slate-800/60 hover:bg-slate-800/20 hover:border-slate-800"
              }`}
              id={`metric-tab-${key}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase tracking-wider font-bold ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                  {cfg.label.split(" ")[0]}
                </span>
                <Icon className="h-4 w-4" style={{ color: cfg.color }} />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-100 tracking-tight font-display">
                  {cfg.formatter ? cfg.formatter(displayVal).split(" ")[0] : displayVal}
                </span>
                <span className="text-[9px] text-slate-500 uppercase font-mono">{cfg.unit}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Chart Section */}
      <div className="h-72 w-full mt-4">
        {filteredData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
            No activity records available. Pull to synchronize.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={filteredData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  onSelectDate(state.activePayload[0].payload.date);
                }
              }}
            >
              <defs>
                <linearGradient id={`gradient-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeConf.color} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={activeConf.color} stopOpacity={0.15} />
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
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0b1329",
                  borderColor: "#1e293b",
                  borderRadius: "12px",
                }}
                labelStyle={{ color: "#94a3b8", fontWeight: 600, fontSize: "12px" }}
                itemStyle={{ color: activeConf.color, fontSize: "12px" }}
                formatter={(value: any) => [activeConf.formatter(value), activeConf.label]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Bar
                dataKey={activeMetric}
                fill={`url(#gradient-${activeMetric})`}
                radius={[6, 6, 0, 0]}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Aggregated Footer banner */}
      {filteredData.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs font-mono text-slate-500">
          <div>
            TOTAL: <span className="text-slate-300 font-bold">{activeConf.formatter(stats.total)}</span>
          </div>
          <div>
            DAILY AVERAGE: <span className="text-slate-300 font-bold">{activeConf.formatter(stats.avg)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
