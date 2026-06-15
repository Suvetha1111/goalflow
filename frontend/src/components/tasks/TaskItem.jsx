/**
 * TaskItem — draggable task row with:
 * - Status toggle (pending → in-progress → completed)
 * - Progress update modal (for measurable tasks with target_value)
 * - Complete button
 * - Delete
 */
import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';
import { formatDate, deadlineColor } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

const STATUS_CYCLE = {
  pending:       'in-progress',
  'in-progress': 'completed',
  completed:     'pending',
};

const STATUS_LABEL = {
  pending:       'To do',
  'in-progress': 'In progress',
  completed:     'Done',
};

const STATUS_BADGE = {
  pending:       'badge-pending',
  'in-progress': 'badge-in-progress',
  completed:     'badge-completed',
};

// ── Progress Update Modal ────────────────────────────────────────────────────
function ProgressModal({ task, onClose, onUpdate }) {
  const [value, setValue] = useState(parseFloat(task.current_value) || 0);
  const [loading, setLoading] = useState(false);
  const target = parseFloat(task.target_value);
  const pct = target ? Math.min(Math.round((value / target) * 100), 100) : 0;
  const remaining = target ? Math.max(target - value, 0) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.patch(`/tasks/${task.id}/progress`, {
        current_value: value,
      });
      toast.success(
        data.remaining_label
          ? `Updated! ${data.remaining_label}`
          : 'Progress updated!'
      );
      onUpdate(data.task, data.goal_completion);
      onClose();
    } catch {
      toast.error('Failed to update progress.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6 animate-slide-up">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Update Progress
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {task.title}
        </p>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span className="font-semibold text-gray-900 dark:text-white">{pct}%</span>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-brand-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0 {task.unit}</span>
            <span>{target} {task.unit}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">
              How much did you complete? ({task.unit || 'units'})
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max={target || 99999}
                step="0.5"
                value={value}
                onChange={e => setValue(parseFloat(e.target.value) || 0)}
                className="input flex-1"
                autoFocus
              />
              <span className="text-sm text-gray-400">/ {target} {task.unit}</span>
            </div>
          </div>

          {/* Remaining info */}
          {target > 0 && (
            <div className={`text-sm px-3 py-2 rounded-xl ${
              remaining === 0
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
            }`}>
              {remaining === 0
                ? '✅ Goal reached! Task will be marked complete.'
                : `⏳ ${remaining} ${task.unit} remaining (${100 - pct}% left)`}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save progress'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-4">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── TaskItem ─────────────────────────────────────────────────────────────────
export default function TaskItem({ task, onUpdate, onDelete }) {
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Has measurable target (e.g. 20 mins)
  const isMeasurable = task.target_value !== null && task.target_value !== undefined;
  const target = parseFloat(task.target_value) || 0;
  const current = parseFloat(task.current_value) || 0;
  const progressPct = isMeasurable && target > 0
    ? Math.min(Math.round((current / target) * 100), 100)
    : null;

  // Cycle through status on checkbox click
  const toggleStatus = async (e) => {
    e.stopPropagation();
    const nextStatus = STATUS_CYCLE[task.status];
    setLoading(true);
    try {
      const { data } = await api.patch(`/tasks/${task.id}/status`, { status: nextStatus });
      onUpdate({ ...task, status: nextStatus, current_value: data.task.current_value }, data.goal_completion);
      if (nextStatus === 'completed' && data.xp_update) {
        toast.success(`+${task.xp_reward || 10} XP earned! 🎉`, { duration: 2000 });
        updateUser({ xp_points: data.xp_update.xp_points, level: data.xp_update.level });
      }
    } catch {
      toast.error('Failed to update task.');
    } finally {
      setLoading(false);
    }
  };

  // Mark directly as completed (the "Complete" button)
  const markComplete = async (e) => {
    e.stopPropagation();
    if (task.status === 'completed') return;
    setLoading(true);
    try {
      const { data } = await api.patch(`/tasks/${task.id}/status`, { status: 'completed' });
      onUpdate({ ...task, status: 'completed', current_value: data.task.current_value }, data.goal_completion);
      if (data.xp_update) {
        toast.success(`Task completed! +${task.xp_reward || 10} XP 🎉`, { duration: 2500 });
        updateUser({ xp_points: data.xp_update.xp_points, level: data.xp_update.level });
      }
    } catch {
      toast.error('Failed to complete task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 group ${
          task.status === 'completed'
            ? 'bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30'
            : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
        }`}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 dark:text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0"
          aria-label="Drag to reorder"
        >
          ⠿
        </button>

        {/* Status toggle circle */}
        <button
          onClick={toggleStatus}
          disabled={loading}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
            task.status === 'completed'
              ? 'bg-green-500 border-green-500 text-white'
              : task.status === 'in-progress'
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-brand-400'
          }`}
          title="Click to cycle status"
        >
          {task.status === 'completed' && <span className="text-xs leading-none">✓</span>}
          {task.status === 'in-progress' && <span className="text-xs text-blue-500">●</span>}
        </button>

        {/* Task info */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${
            task.status === 'completed'
              ? 'line-through text-gray-400 dark:text-gray-600'
              : 'text-gray-900 dark:text-white'
          }`}>
            {task.title}
          </p>

          {/* Measurable progress bar */}
          {isMeasurable && progressPct !== null && task.status !== 'completed' && (
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {current}/{target} {task.unit} · {progressPct}%
              </span>
            </div>
          )}

          {task.due_date && (
            <p className={`text-xs mt-0.5 ${deadlineColor(task.due_date)}`}>
              Due {formatDate(task.due_date)}
            </p>
          )}
        </div>

        {/* Status badge */}
        <span className={`${STATUS_BADGE[task.status]} shrink-0`}>
          {STATUS_LABEL[task.status]}
        </span>

        {/* Action buttons (visible on hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">

          {/* Update progress button — only for measurable tasks */}
          {isMeasurable && task.status !== 'completed' && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowProgress(true); }}
              className="text-xs px-2 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 hover:bg-brand-100 font-medium transition-colors"
              title="Update progress"
            >
              Update
            </button>
          )}

          {/* Complete button — for non-completed tasks */}
          {task.status !== 'completed' && (
            <button
              onClick={markComplete}
              disabled={loading}
              className="text-xs px-2 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 font-medium transition-colors disabled:opacity-50"
              title="Mark as completed"
            >
              ✓ Done
            </button>
          )}

          {/* XP badge */}
          <span className="text-xs text-brand-500 dark:text-brand-400 font-medium">
            +{task.xp_reward || 10}xp
          </span>

          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task); }}
            className="text-gray-300 hover:text-red-500 dark:text-gray-700 dark:hover:text-red-400 text-sm transition-colors"
            title="Delete task"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Progress update modal */}
      {showProgress && (
        <ProgressModal
          task={task}
          onClose={() => setShowProgress(false)}
          onUpdate={(updatedTask, goalCompletion) => {
            onUpdate(updatedTask, goalCompletion);
          }}
        />
      )}
    </>
  );
}
