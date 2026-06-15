/**
 * GoalDetail Page — single goal with tasks
 * Features: drag-and-drop, measurable tasks, progress update, complete button
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, closestCenter,
  KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext,
  sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import TaskItem    from '../components/tasks/TaskItem';
import Modal       from '../components/common/Modal';
import ProgressBar from '../components/common/ProgressBar';
import GoalForm    from '../components/goals/GoalForm';
import { formatDate, deadlineColor, daysUntil } from '../utils/helpers';

const PRIORITY_BADGE = {
  high:   'badge-high',
  medium: 'badge-medium',
  low:    'badge-low',
};

export default function GoalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [goal, setGoal]       = useState(null);
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState({
    title: '', due_date: '',
    target_value: '', unit: '',  // measurable fields
  });
  const [showMeasurable, setShowMeasurable] = useState(false);
  const [addingTask, setAddingTask]   = useState(false);
  const [editGoal, setEditGoal]       = useState(false);
  const [deleteTask, setDeleteTask]   = useState(null);
  const [completingGoal, setCompletingGoal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchGoal = useCallback(async () => {
    try {
      const { data } = await api.get(`/goals/${id}`);
      setGoal(data.goal);
      setTasks(data.tasks);
    } catch {
      toast.error('Goal not found.');
      navigate('/goals');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchGoal(); }, [fetchGoal]);

  // Drag end
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = tasks.findIndex(t => t.id === active.id);
    const newIdx = tasks.findIndex(t => t.id === over.id);
    const reordered = arrayMove(tasks, oldIdx, newIdx);
    setTasks(reordered);
    const updates = reordered.map((t, i) => ({ id: t.id, position: i }));
    try {
      await api.put('/tasks/reorder/batch', { tasks: updates });
    } catch {
      toast.error('Failed to save order.');
      setTasks(tasks);
    }
  };

  // Add task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setAddingTask(true);
    try {
      const payload = {
        goal_id:  id,
        title:    newTask.title,
        due_date: newTask.due_date || undefined,
      };
      // Add measurable fields if provided
      if (showMeasurable && newTask.target_value) {
        payload.target_value  = parseFloat(newTask.target_value);
        payload.current_value = 0;
        payload.unit          = newTask.unit || 'units';
      }
      const { data } = await api.post('/tasks', payload);
      setTasks(ts => [...ts, data.task]);
      setNewTask({ title: '', due_date: '', target_value: '', unit: '' });
      setShowMeasurable(false);
      toast.success('Task added!');
      // Refresh goal completion
      const g = await api.get(`/goals/${id}`);
      setGoal(g.data.goal);
    } catch {
      toast.error('Failed to add task.');
    } finally {
      setAddingTask(false);
    }
  };

  // Task update (status change, progress update)
  const handleTaskUpdate = (updatedTask, newCompletion) => {
    setTasks(ts => ts.map(t => t.id === updatedTask.id ? updatedTask : t));
    if (newCompletion !== undefined) {
      setGoal(g => ({
        ...g,
        completion_percentage: newCompletion,
        status: newCompletion === 100 ? 'completed' : 'active',
      }));
    }
  };

  // Delete task
  const handleDeleteTask = async () => {
    if (!deleteTask) return;
    try {
      await api.delete(`/tasks/${deleteTask.id}`);
      setTasks(ts => ts.filter(t => t.id !== deleteTask.id));
      setDeleteTask(null);
      toast.success('Task deleted.');
      const g = await api.get(`/goals/${id}`);
      setGoal(g.data.goal);
    } catch {
      toast.error('Failed to delete task.');
    }
  };

  // Mark entire goal as completed
  const handleCompleteGoal = async () => {
    setCompletingGoal(true);
    try {
      // Mark all tasks as completed
      const incompleteTasks = tasks.filter(t => t.status !== 'completed');
      await Promise.all(
        incompleteTasks.map(t =>
          api.patch(`/tasks/${t.id}/status`, { status: 'completed' })
        )
      );
      // Update goal status
      await api.put(`/goals/${id}`, { status: 'completed' });
      // Refresh everything
      const { data } = await api.get(`/goals/${id}`);
      setGoal(data.goal);
      setTasks(data.tasks);
      toast.success('🎉 Goal completed! Amazing work!', { duration: 4000 });
    } catch {
      toast.error('Failed to complete goal.');
    } finally {
      setCompletingGoal(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (!goal) return null;

  const days = daysUntil(goal.deadline);
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const isAlreadyCompleted = goal.status === 'completed';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/goals')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        ← Back to goals
      </button>

      {/* Goal header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={PRIORITY_BADGE[goal.priority]}>{goal.priority} priority</span>
              {isAlreadyCompleted && <span className="badge-completed">completed ✓</span>}
              {goal.deadline && (
                <span className={`text-xs ${deadlineColor(goal.deadline)}`}>
                  {days === null ? '' : days < 0
                    ? `${Math.abs(days)}d overdue`
                    : days === 0 ? 'Due today'
                    : `${days}d remaining`}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{goal.title}</h1>
            {goal.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{goal.description}</p>
            )}
            {goal.deadline && (
              <p className="text-xs text-gray-400 mt-1">Deadline: {formatDate(goal.deadline)}</p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <button onClick={() => setEditGoal(true)} className="btn-secondary text-sm px-3 py-1.5">
              ✎ Edit
            </button>

            {/* ── Complete Goal Button ── */}
            {!isAlreadyCompleted && (
              <button
                onClick={handleCompleteGoal}
                disabled={completingGoal || tasks.length === 0}
                className="btn-primary text-sm px-3 py-1.5 disabled:opacity-50 bg-green-600 hover:bg-green-700"
                title={tasks.length === 0 ? 'Add tasks first' : 'Mark entire goal as complete'}
              >
                {completingGoal ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Completing…
                  </span>
                ) : '✓ Complete Goal'}
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <ProgressBar percentage={goal.completion_percentage} />
        <p className="text-xs text-gray-400 mt-1">{completedCount}/{tasks.length} tasks completed</p>
      </div>

      {/* Task list */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Tasks <span className="text-sm font-normal text-gray-400">({tasks.length})</span>
        </h2>

        {/* Add task form */}
        <form onSubmit={handleAddTask} className="mb-4 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a task…"
              value={newTask.title}
              onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))}
              className="input flex-1 py-2"
            />
            <input
              type="date"
              value={newTask.due_date}
              onChange={e => setNewTask(t => ({ ...t, due_date: e.target.value }))}
              className="input w-36 py-2"
              min={new Date().toISOString().split('T')[0]}
            />
            <button
              type="button"
              onClick={() => setShowMeasurable(m => !m)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                showMeasurable
                  ? 'bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-900/20 dark:border-brand-700 dark:text-brand-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
              }`}
              title="Add measurable target (e.g. 20 mins reading)"
            >
              📏
            </button>
            <button
              type="submit"
              disabled={addingTask || !newTask.title.trim()}
              className="btn-primary py-2 px-4 disabled:opacity-50"
            >
              {addingTask ? '…' : '+ Add'}
            </button>
          </div>

          {/* Measurable fields */}
          {showMeasurable && (
            <div className="flex gap-2 p-3 bg-brand-50 dark:bg-brand-900/10 rounded-xl border border-brand-100 dark:border-brand-900/30 animate-slide-up">
              <div className="flex-1">
                <label className="text-xs text-brand-700 dark:text-brand-400 font-medium mb-1 block">
                  📏 Target amount
                </label>
                <input
                  type="number"
                  placeholder="20"
                  min="0"
                  step="0.5"
                  value={newTask.target_value}
                  onChange={e => setNewTask(t => ({ ...t, target_value: e.target.value }))}
                  className="input py-1.5 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-brand-700 dark:text-brand-400 font-medium mb-1 block">
                  Unit (mins, pages, km…)
                </label>
                <input
                  type="text"
                  placeholder="mins"
                  value={newTask.unit}
                  onChange={e => setNewTask(t => ({ ...t, unit: e.target.value }))}
                  className="input py-1.5 text-sm"
                />
              </div>
              <div className="flex items-end pb-0.5">
                <p className="text-xs text-brand-600 dark:text-brand-400">
                  e.g. Read 20 mins/day
                </p>
              </div>
            </div>
          )}
        </form>

        {/* Task list */}
        {tasks.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-3xl mb-2">📝</p>
            <p className="text-sm">No tasks yet. Add your first task above!</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {tasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onUpdate={handleTaskUpdate}
                    onDelete={setDeleteTask}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Task summary */}
        {tasks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-4 text-xs text-gray-400">
            <span>✓ {completedCount} done</span>
            <span>● {tasks.filter(t => t.status === 'in-progress').length} in progress</span>
            <span>○ {tasks.filter(t => t.status === 'pending').length} pending</span>
          </div>
        )}
      </div>

      {/* Edit goal modal */}
      <Modal isOpen={editGoal} onClose={() => setEditGoal(false)} title="Edit goal">
        <GoalForm
          goal={goal}
          onSuccess={(updated) => {
            setGoal(g => ({ ...g, ...updated }));
            setEditGoal(false);
          }}
          onCancel={() => setEditGoal(false)}
        />
      </Modal>

      {/* Delete task confirm */}
      <Modal isOpen={!!deleteTask} onClose={() => setDeleteTask(null)} title="Delete task" size="sm">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Delete <strong className="text-gray-900 dark:text-white">"{deleteTask?.title}"</strong>?
        </p>
        <div className="flex gap-3">
          <button onClick={handleDeleteTask} className="btn-danger flex-1 justify-center">Delete</button>
          <button onClick={() => setDeleteTask(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
