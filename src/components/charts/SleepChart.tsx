/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { DailySleep } from "../../types";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Moon, Star, RefreshCw, Layers } from "lucide-react";

interface SleepChartProps {
  sleeps: DailySleep[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export const SleepChart: React.FC<SleepChartProps> = ({ sleeps, selectedDate, onSelectDate }) => {
  const [timeframe, setTimeframe] = useState<"7d" | "30d">("7d");

  // Filter trend data
  const trendData = useMemo(() => {
    const limit = timeframe === "7d" ? 7 : 30;
    return sleeps.slice(-limit);
  }, [sleeps, timeframe]);

  // Find sleep logs for the currently selected date
  const selectedSleep = useMemo(() => {
    return sleeps.find((s) => s.date === selectedDate) || sleeps[sleeps.length - 1];
  }, [sleeps, selectedDate]);

  // Format minutes into hr / min text
  const formatMinutes = (mins: number) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return `${hrs}h ${m}m`;
  };

  // Convert sleep stages for Pie Chart
  const pieData = useMemo(() => {
    if (!selectedSleep || !selectedSleep.stages) return [];
    const { stages } = selectedSleep;
    return [
      { name: "Deep", value: stages.deepMinutes, color: "#1e3a8a" },  // Dark Blue
      { name: "Light", value: stages.lightMinutes, color: "#4f46e5" }, // Indigo
      { name: "REM", value: stages.remMinutes, color: "#06b6d4" },     // Cyan
      { name: "Awake", value: stages.awakeMinutes, color: "#f59e0b" },  // Amber
    ];
  }, [selectedSleep]);

  const stats = useMemo(() => {
    if (trendData.length === 0) return { avgScore: 0, avgDuration: 0 };
    const validScores = trendData.map((s) => s.sleepScore).filter(Boolean);
    const totalDuration = trendData.reduce((acc, s) => acc + s.durationMinutes, 0);
    return {
      avgScore: validScores.length ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0,
      avgDuration: Math.round(totalDuration / trendData.length),
    };
  }, [trendData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="sleep-chart-container">
      {/* Column 1: Sleep History Trend */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2 font-display">
              <Moon className="h-5 w-5 text-indigo-400" />
              Sleep History
            </h3>
            <p className="text-slate-400 text-sm mt-0.5">
              Nocturnal restorative sleep durations and quality scores
            </p>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setTimeframe("7d")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                timeframe === "7d"
                  ? "bg-slate-800 text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeframe("30d")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                timeframe === "30d"
                  ? "bg-slate-800 text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        {/* Selected night recap */}
        {selectedSleep && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-xl flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 font-display">
                <Moon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Sleep Duration</div>
                <div className="text-lg font-bold text-slate-200 mt-0.5 font-display">
                  {formatMinutes(selectedSleep.durationMinutes)}
                </div>
              </div>
            </div>
            
            <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-xl flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                <Star className="h-5 w-5 fill-amber-500/20" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Sleep Score</div>
                <div className="text-lg font-bold text-slate-200 mt-0.5 font-display">
                  {selectedSleep.sleepScore} <span className="text-xs text-slate-500 font-sans">/ 100</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bar/Line Chart */}
        <div className="h-60 w-full mt-2">
          {trendData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
              No historical sleep records synchronized. Click sync to backfill.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trendData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={(state: any) => {
                  if (state && state.activePayload && state.activePayload.length > 0) {
                    onSelectDate(state.activePayload[0].payload.date);
                  }
                }}
              >
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
                  formatter={(value: any, name: any) => {
                    if (name === "durationMinutes") {
                      return [formatMinutes(value), "Duration"];
                    }
                    return [value, "Sleep Score"];
                  }}
                />
                <Bar
                  dataKey="durationMinutes"
                  name="durationMinutes"
                  fill="#4f46e5" // Indigo
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Trend Aggregations */}
        {trendData.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs font-mono text-slate-500">
            <div>
              AVG SCORE: <span className="text-slate-300 font-bold font-display">{stats.avgScore} / 100</span>
            </div>
            <div>
              AVG DURATION: <span className="text-slate-300 font-bold font-display">{formatMinutes(stats.avgDuration)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Column 2: Selected Sleep Stages Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2 font-display">
              <Layers className="h-5 w-5 text-indigo-400" />
              Sleep Stages Breakdown
            </h3>
            <p className="text-slate-400 text-sm mt-0.5">
              Selected night: {selectedDate}
            </p>
          </div>
        </div>

        {/* Content displays */}
        {!selectedSleep || !selectedSleep.stages || selectedSleep.durationMinutes === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-slate-500 font-mono text-xs gap-3">
            <RefreshCw className="h-10 w-10 text-slate-700 animate-spin" />
            No stage telemetry available for {selectedDate}. Selection lacks sleep.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 h-72">
            {/* Pie Chart display */}
            <div className="w-full sm:w-1/2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0b1329",
                      borderColor: "#1e293b",
                      borderRadius: "12px",
                    }}
                    formatter={(value: any) => [formatMinutes(value), "Duration"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Stage legend & percentage display */}
            <div className="w-full sm:w-1/2 flex flex-col gap-3.5 pr-2">
              {pieData.map((stage) => {
                const totalMins = selectedSleep.durationMinutes;
                const pct = totalMins > 0 ? Math.round((stage.value / totalMins) * 100) : 0;
                
                return (
                  <div key={stage.name} className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                      <span className="text-slate-300 font-sans font-medium">{stage.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-100 font-bold">{formatMinutes(stage.value)}</span>
                      <span className="text-slate-500 ml-1.5 text-[10px] bg-slate-950 px-1.5 py-0.5 rounded-md border border-slate-800">
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
