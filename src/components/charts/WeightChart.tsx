/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { WeightRecord } from "../../types";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Scale, ChevronDown } from "lucide-react";

interface WeightChartProps {
  weights: WeightRecord[];
}

export const WeightChart: React.FC<WeightChartProps> = ({ weights }) => {
  const latestRecord = useMemo(() => {
    if (weights.length === 0) return null;
    return weights[weights.length - 1];
  }, [weights]);

  const weightStats = useMemo(() => {
    if (weights.length === 0) return { change: 0, min: 0, max: 0 };
    const vals = weights.map((w) => w.weightKg);
    const first = vals[0];
    const last = vals[vals.length - 1];
    return {
      change: parseFloat((last - first).toFixed(1)),
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  }, [weights]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6" id="weight-chart-container">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-500" />
            Body Weight Trend
          </h3>
          <p className="text-slate-400 text-sm mt-0.5">
            Body composition tracking logs
          </p>
        </div>

        {/* Latest measurement card */}
        {latestRecord && (
          <div className="bg-slate-950/45 border border-slate-800/40 px-4 py-2.5 rounded-xl text-right">
            <span className="text-xs text-slate-500 block uppercase font-mono font-bold tracking-wider">Latest Weight</span>
            <span className="text-2xl font-black text-slate-100 tracking-tight">
              {latestRecord.weightKg} <span className="text-xs text-slate-500 font-normal">kg</span>
            </span>
          </div>
        )}
      </div>

      {/* Line Chart */}
      <div className="h-60 w-full mt-2">
        {weights.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
            No weight logs detected. Connect Google Health or add a weight log to get started.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weights} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              <YAxis domain={["dataMin - 2", "dataMax + 2"]} stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0b1329",
                  borderColor: "#1e293b",
                  borderRadius: "12px",
                }}
                labelStyle={{ color: "#94a3b8", fontWeight: 600, fontSize: "12px" }}
                itemStyle={{ color: "#f59e0b", fontSize: "12px" }}
                formatter={(val) => [`${val} kg`, "Weight"]}
              />
              <Line
                type="monotone"
                dataKey="weightKg"
                stroke="#f59e0b" // Amber
                strokeWidth={3}
                dot={{ r: 4, stroke: "#1e1b4b", strokeWidth: 1.5 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary Footer */}
      {weights.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs font-mono text-slate-500">
          <div>
            MIN: <span className="text-slate-300 font-bold">{weightStats.min} kg</span>
          </div>
          <div>
            MAX: <span className="text-slate-300 font-bold">{weightStats.max} kg</span>
          </div>
          <div>
            PROGRESS CHANGE:{" "}
            <span
              className={`font-black ${
                weightStats.change <= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {weightStats.change > 0 ? "+" : ""}
              {weightStats.change} kg
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
