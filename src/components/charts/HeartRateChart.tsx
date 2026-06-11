/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { DailyHeartRate } from "../../types";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";
import { Heart, TrendingUp, Clock, Info } from "lucide-react";

interface HeartRateChartProps {
  heartRates: DailyHeartRate[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export const HeartRateChart: React.FC<HeartRateChartProps> = ({ heartRates, selectedDate, onSelectDate }) => {
  const [timeframe, setTimeframe] = useState<"7d" | "30d">("7d");

  // Resting heart rate trend subset
  const trendData = useMemo(() => {
    const limit = timeframe === "7d" ? 7 : 30;
    return heartRates.slice(-limit);
  }, [heartRates, timeframe]);

  // Selected Day's heart rate logs
  const selectedDayLog = useMemo(() => {
    return heartRates.find((h) => h.date === selectedDate) || heartRates[heartRates.length - 1];
  }, [heartRates, selectedDate]);

  // Stats computed
  const heartStats = useMemo(() => {
    if (trendData.length === 0) return { min: 0, max: 0, avg: 0 };
    const rhrs = trendData.map((d) => d.restingHeartRate).filter(Boolean);
    if (!rhrs.length) return { min: 0, max: 0, avg: 0 };
    return {
      min: Math.min(...rhrs),
      max: Math.max(...rhrs),
      avg: Math.round(rhrs.reduce((a, b) => a + b, 0) / rhrs.length),
    };
  }, [trendData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="heart-rate-chart-container">
      {/* Chart 1: Resting HR Trend */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2 font-display">
              <Heart className="h-5 w-5 text-rose-500 fill-rose-500/10" />
              Resting Heart Rate (RHR)
            </h3>
            <p className="text-slate-400 text-sm mt-0.5">
              Nightly baseline cardiac activity logs
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

        {/* Selected RHR display */}
        {selectedDayLog && (
          <div className="flex items-baseline gap-2 mb-4 bg-slate-950/40 border border-slate-800/50 p-4 rounded-2xl">
            <span className="text-3xl font-extrabold text-white tracking-tight font-display">
              {selectedDayLog.restingHeartRate}
            </span>
            <span className="text-xs uppercase text-slate-500 font-mono font-bold">bpm</span>
            <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
              On {selectedDayLog.date}
            </span>
          </div>
        )}

        {/* Resting Line Chart */}
        <div className="h-60 w-full mt-2">
          {trendData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
              No resting heart rate data cached. Sync to retrieve.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
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
                <YAxis domain={["dataMin - 5", "dataMax + 5"]} stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0b1329",
                    borderColor: "#1e293b",
                    borderRadius: "12px",
                  }}
                  labelStyle={{ color: "#94a3b8", fontWeight: 600, fontSize: "12px" }}
                  itemStyle={{ color: "#f43f5e", fontSize: "12px" }}
                />
                <Line
                  type="monotone"
                  dataKey="restingHeartRate"
                  name="Resting Heart Rate"
                  stroke="#f43f5e" // Rose
                  strokeWidth={3}
                  activeDot={{ r: 6 }}
                  dot={{ r: 4 }}
                  cursor="pointer"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* HR Aggregates */}
        {trendData.length > 0 && (
          <div className="mt-4 grid grid-cols-3 text-center border-t border-slate-800/80 pt-4 text-xs font-mono text-slate-500">
            <div>
              MIN: <span className="text-slate-300 font-bold font-display">{heartStats.min} bpm</span>
            </div>
            <div>
              AVG: <span className="text-slate-300 font-bold font-display">{heartStats.avg} bpm</span>
            </div>
            <div>
              MAX: <span className="text-slate-300 font-bold font-display">{heartStats.max} bpm</span>
            </div>
          </div>
        )}
      </div>

      {/* Chart 2: Intraday HR detail */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2 font-display">
              <Clock className="h-5 w-5 text-indigo-400" />
              Intraday Heart Rate
            </h3>
            <p className="text-slate-400 text-sm mt-0.5">
              Fluctuations for selected day ({selectedDate})
            </p>
          </div>
        </div>

        {/* Selected Intraday summary statistics */}
        {selectedDayLog && selectedDayLog.intraday && selectedDayLog.intraday.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-2xl text-left">
              <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Min Active HR</div>
              <div className="text-xl font-extrabold text-slate-200 mt-1 font-display">
                {Math.min(...selectedDayLog.intraday.map((i) => i.bpm))} <span className="text-xs text-slate-500">bpm</span>
              </div>
            </div>
            <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-2xl text-left">
              <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Max Active HR</div>
              <div className="text-xl font-extrabold text-slate-200 mt-1 font-display">
                {Math.max(...selectedDayLog.intraday.map((i) => i.bpm))} <span className="text-xs text-slate-500">bpm</span>
              </div>
            </div>
          </div>
        )}

        {/* Intraday Area Chart */}
        <div className="h-60 w-full mt-2">
          {!selectedDayLog || !selectedDayLog.intraday || selectedDayLog.intraday.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
              No intraday heart rate logs found for {selectedDate}. Click a date on the resting trend to load logs.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={selectedDayLog.intraday} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIntraday" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) => {
                    const hour = parseInt(t.split(":")[0], 10);
                    const min = t.split(":")[1];
                    if (min === "00" && hour % 4 === 0) return t;
                    return "";
                  }}
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis domain={["dataMin - 10", "dataMax + 10"]} stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0b1329",
                    borderColor: "#1e293b",
                    borderRadius: "12px",
                  }}
                  labelStyle={{ color: "#94a3b8", fontWeight: 600, fontSize: "12px" }}
                  itemStyle={{ color: "#818cf8", fontSize: "12px" }}
                />
                <Area
                  type="monotone"
                  dataKey="bpm"
                  name="Heart Rate"
                  stroke="#818cf8" // Indigo
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorIntraday)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-4 bg-slate-950/20 border border-slate-800/40 p-3 rounded-xl flex items-start gap-2.5 text-xs text-slate-400">
          <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
          <p>
            Your Charge 6 measures continuous heart rate. High intensity workout segments are visible as major intraday cardio elevations.
          </p>
        </div>
      </div>
    </div>
  );
};
