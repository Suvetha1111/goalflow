import React from 'react';
import { progressColor } from '../../utils/helpers';

/**
 * ProgressBar — animated completion bar with optional label
 */
export default function ProgressBar({ percentage, showLabel = true, height = 'h-2', className = '' }) {
  const clampedPct = Math.min(Math.max(percentage || 0, 0), 100);
  const color = progressColor(clampedPct);

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Progress</span>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{clampedPct}%</span>
        </div>
      )}
      <div className={`${height} bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden`}>
        <div
          className={`${height} ${color} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
    </div>
  );
}
