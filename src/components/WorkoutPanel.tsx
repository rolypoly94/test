/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { WorkoutLog } from "../types";
import { Dumbbell, Calendar, Flame, Heart, Clock, ListFilter } from "lucide-react";

interface WorkoutPanelProps {
  workouts: WorkoutLog[];
}

export const WorkoutPanel: React.FC<WorkoutPanelProps> = ({ workouts }) => {
  const [filterType, setFilterType] = useState<string>("All");

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    workouts.forEach((w) => {
      if (w.type) types.add(w.type);
    });
    return ["All", ...Array.from(types)];
  }, [workouts]);

  const filteredWorkouts = useMemo(() => {
    if (filterType === "All") return workouts;
    return workouts.filter((w) => w.type === filterType);
  }, [workouts, filterType]);

  const stats = useMemo(() => {
    if (filteredWorkouts.length === 0) return { totalCount: 0, totalCal: 0, avgHr: 0, totalMins: 0 };
    const count = filteredWorkouts.length;
    const calories = filteredWorkouts.reduce((acc, curr) => acc + curr.calories, 0);
    const mins = filteredWorkouts.reduce((acc, curr) => acc + curr.durationMinutes, 0);
    const hrs = filteredWorkouts.reduce((acc, curr) => acc + curr.avgHeartRate, 0);
    return {
      totalCount: count,
      totalCal: calories,
      totalMins: mins,
      avgHr: Math.round(hrs / count),
    };
  }, [filteredWorkouts]);

  const getWorkoutIconColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "run":
        return "text-emerald-400 bg-emerald-500/10";
      case "hiit":
        return "text-rose-400 bg-rose-500/10";
      case "walk":
        return "text-sky-400 bg-sky-500/10";
      case "yoga":
        return "text-fuchsia-400 bg-fuchsia-500/10";
      case "cycle":
        return "text-amber-400 bg-amber-500/10";
      default:
        return "text-slate-400 bg-slate-500/10";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6" id="workout-panel-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-indigo-400" />
            Exercise & Workout Logs
          </h3>
          <p className="text-slate-400 text-sm mt-0.5">
            Active training captures synced from your Charge 6
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          <ListFilter className="h-3.5 w-3.5 text-slate-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-transparent text-slate-300 text-xs font-semibold focus:outline-none cursor-pointer pr-1"
            id="workout-filter-select"
          >
            {availableTypes.map((type) => (
              <option key={type} value={type} className="bg-slate-950 text-slate-300">
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Aggregate Widgets */}
      {workouts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-950/45 border border-slate-800/40 p-4 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider">Workouts</div>
            <div className="text-xl font-black text-slate-200 mt-0.5">{stats.totalCount}</div>
          </div>
          <div className="bg-slate-950/45 border border-slate-800/40 p-4 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider">Total Duration</div>
            <div className="text-xl font-black text-slate-200 mt-0.5">{stats.totalMins} <span className="text-xs text-slate-500 font-normal">mins</span></div>
          </div>
          <div className="bg-slate-950/45 border border-slate-800/40 p-4 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider">Calories Burned</div>
            <div className="text-xl font-black text-slate-200 mt-0.5">{stats.totalCal.toLocaleString()} <span className="text-xs text-slate-500 font-normal">kcal</span></div>
          </div>
          <div className="bg-slate-950/45 border border-slate-800/40 p-4 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider">Average Heart Rate</div>
            <div className="text-xl font-black text-slate-200 mt-0.5">{stats.avgHr} <span className="text-xs text-slate-500 font-normal">bpm</span></div>
          </div>
        </div>
      )}

      {/* List Box */}
      <div className="max-h-80 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin">
        {filteredWorkouts.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
            No training sessions mapped.
          </div>
        ) : (
          filteredWorkouts.map((workout) => (
            <div
              key={workout.id}
              className="bg-slate-950/45 border border-slate-800/60 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-800 transition"
              id={`workout-row-${workout.id}`}
            >
              {/* Left Side: Badge and Info */}
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl shrink-0 font-bold ${getWorkoutIconColor(workout.type)}`}>
                  <Dumbbell className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">{workout.type}</h4>
                  <div className="flex items-center gap-3 text-slate-500 text-xs mt-1 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {workout.date}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: Quick Stats bar */}
              <div className="flex items-center gap-6 text-xs font-mono self-end sm:self-auto">
                <div className="text-right">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Duration</span>
                  <span className="text-slate-200 font-bold flex items-center gap-1 justify-end mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    {workout.durationMinutes}m
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Heart Rate</span>
                  <span className="text-rose-400 font-bold flex items-center gap-1 justify-end mt-0.5">
                    <Heart className="h-3.5 w-3.5 fill-rose-400/10" />
                    {workout.avgHeartRate}
                  </span>
                </div>

                <div className="text-right min-w-[70px]">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Energy</span>
                  <span className="text-orange-400 font-bold flex items-center gap-1 justify-end mt-0.5">
                    <Flame className="h-3.5 w-3.5 fill-orange-400/10" />
                    {workout.calories}c
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
