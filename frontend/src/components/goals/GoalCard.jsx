/**
 * GoalCard — summary card shown in goals list
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate, daysUntil, deadlineColor } from '../../utils/helpers';
import ProgressBar from '../common/ProgressBar';

const PRIORITY_BADGE = {
  high:   'badge-high',
  medium: 'badge-medium',
  low:    'badge-low',
};

export default function GoalCard({ goal, onEdit, onDelete }) {
  const navigate = useNavigate();
  const days = daysUntil(goal.deadline);

  return (
    <div
      className="card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group animate-fade-in"
      onClick={() => navigate(`/goals/${goal.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={PRIORITY_BADGE[goal.priority]}>{goal.priority}</span>
            {goal.status === 'completed' && (
              <span className="badge-completed">completed</span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            {goal.title}
          </h3>
          {goal.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{goal.description}</p>
          )}
        </div>

        {/* Action buttons (shown on hover) */}
        <div
          className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onEdit(goal)}
            className="w-7 h-7 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 flex items-center justify-center text-sm transition-colors"
            title="Edit"
          >
            ✎
          </button>
          <button
            onClick={() => onDelete(goal)}
            className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-sm transition-colors"
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar
        percentage={goal.completion_percentage}
        showLabel={false}
        height="h-1.5"
        className="mb-3"
      />

      {/* Footer: task count + deadline */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">
          {goal.completed_tasks || 0}/{goal.total_tasks || 0} tasks · {goal.completion_percentage || 0}%
        </span>
        {goal.deadline && (
          <span className={deadlineColor(goal.deadline)}>
            {days === null ? '—' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
          </span>
        )}
      </div>
    </div>
  );
}
