/**
 * Heatmap — GitHub-style full year activity heatmap
 */
import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Color levels: 0=empty, 1=light, 2=medium, 3=dark, 4=max
const LEVEL_COLORS = [
  'bg-gray-100 dark:bg-gray-800',
  'bg-green-200 dark:bg-green-900',
  'bg-green-400 dark:bg-green-700',
  'bg-green-500 dark:bg-green-500',
  'bg-green-600 dark:bg-green-400',
];

export default function Heatmap() {
  const [heatmap, setHeatmap] = useState([]);
  const [tooltip, setTooltip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalTasks, setTotalTasks] = useState(0);
  const [activeDays, setActiveDays] = useState(0);

  useEffect(() => {
    api.get('/dashboard/heatmap')
      .then(({ data }) => {
        setHeatmap(data.heatmap);
        setTotalTasks(data.heatmap.reduce((s, d) => s + d.tasks_completed, 0));
        setActiveDays(data.heatmap.filter(d => d.tasks_completed > 0).length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="skeleton h-36 rounded-2xl" />;
  }

  // Group into weeks (columns), each week = 7 days (rows)
  // Pad start so first day aligns with correct weekday
  const firstDay = heatmap.length > 0 ? new Date(heatmap[0].date).getDay() : 0;
  const padded = [...Array(firstDay).fill(null), ...heatmap];
  const weeks = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  // Find month label positions
  const monthLabels = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstReal = week.find(d => d !== null);
    if (firstReal) {
      const m = new Date(firstReal.date).getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ week: wi, label: MONTHS[m] });
        lastMonth = m;
      }
    }
  });

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Activity Heatmap
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {totalTasks} tasks completed · {activeDays} active days in the last year
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span>Less</span>
          {LEVEL_COLORS.map((c, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Month labels */}
          <div className="flex mb-1 ml-8">
            {weeks.map((_, wi) => {
              const label = monthLabels.find(m => m.week === wi);
              return (
                <div key={wi} className="w-4 mr-0.5 text-xs text-gray-400 text-center">
                  {label ? label.label : ''}
                </div>
              );
            })}
          </div>

          {/* Day rows */}
          <div className="flex gap-0">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1">
              {DAYS.map((d, i) => (
                <div key={d} className="h-4 w-7 text-xs text-gray-400 flex items-center justify-end pr-1">
                  {i % 2 === 1 ? d : ''}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5 mr-0.5">
                {[0,1,2,3,4,5,6].map(di => {
                  const day = week[di];
                  if (!day) return <div key={di} className="w-4 h-4" />;
                  return (
                    <div
                      key={di}
                      className={`w-4 h-4 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-brand-400 hover:ring-offset-1 ${LEVEL_COLORS[day.level]}`}
                      onMouseEnter={() => setTooltip(day)}
                      onMouseLeave={() => setTooltip(null)}
                      title={`${day.date}: ${day.tasks_completed} tasks`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg inline-block">
          <strong className="text-gray-900 dark:text-white">{tooltip.date}</strong>
          {' · '}
          {tooltip.tasks_completed > 0
            ? `${tooltip.tasks_completed} task${tooltip.tasks_completed > 1 ? 's' : ''} completed · ${tooltip.xp_earned} XP`
            : 'No activity'}
        </div>
      )}
    </div>
  );
}
