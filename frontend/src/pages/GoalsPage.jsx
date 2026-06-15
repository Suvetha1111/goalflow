/**
 * Goals Page — lists all user goals with filtering
 */
import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import GoalCard from '../components/goals/GoalCard';
import GoalForm from '../components/goals/GoalForm';
import Modal   from '../components/common/Modal';

const FILTERS = ['all', 'active', 'completed'];
const PRIORITIES = ['all', 'high', 'medium', 'low'];

export default function GoalsPage() {
  const [goals, setGoals]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [deleteGoal, setDeleteGoal] = useState(null);
  const [filter, setFilter]     = useState('all');
  const [priority, setPriority] = useState('all');
  const [search, setSearch]     = useState('');

  const fetchGoals = useCallback(async () => {
    try {
      const { data } = await api.get('/goals');
      setGoals(data.goals);
    } catch {
      toast.error('Failed to load goals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  // Filter goals locally
  const filtered = goals.filter(g => {
    if (filter !== 'all' && g.status !== filter) return false;
    if (priority !== 'all' && g.priority !== priority) return false;
    if (search && !g.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCreate = (newGoal) => {
    setGoals(gs => [newGoal, ...gs]);
    setShowForm(false);
  };

  const handleEdit = (goal) => {
    setEditGoal(goal);
  };

  const handleEditSuccess = (updated) => {
    setGoals(gs => gs.map(g => g.id === updated.id ? { ...g, ...updated } : g));
    setEditGoal(null);
    toast.success('Goal updated!');
  };

  const handleDelete = async () => {
    if (!deleteGoal) return;
    try {
      await api.delete(`/goals/${deleteGoal.id}`);
      setGoals(gs => gs.filter(g => g.id !== deleteGoal.id));
      setDeleteGoal(null);
      toast.success('Goal deleted.');
    } catch {
      toast.error('Failed to delete goal.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Your Goals</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {goals.length} goals · {goals.filter(g => g.status === 'completed').length} completed
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + New goal
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search goals…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input w-48 py-2"
        />

        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                filter === f
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className="input w-36 py-2"
        >
          {PRIORITIES.map(p => (
            <option key={p} value={p}>
              {p === 'all' ? 'All priorities' : p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Goals grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {goals.length === 0 ? 'No goals yet' : 'No goals match your filters'}
          </p>
          {goals.length === 0 && (
            <button onClick={() => setShowForm(true)} className="btn-primary mx-auto mt-4">
              Create your first goal
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={handleEdit}
              onDelete={setDeleteGoal}
            />
          ))}
        </div>
      )}

      {/* Create goal modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Create new goal">
        <GoalForm onSuccess={handleCreate} onCancel={() => setShowForm(false)} />
      </Modal>

      {/* Edit goal modal */}
      <Modal isOpen={!!editGoal} onClose={() => setEditGoal(null)} title="Edit goal">
        {editGoal && (
          <GoalForm
            goal={editGoal}
            onSuccess={handleEditSuccess}
            onCancel={() => setEditGoal(null)}
          />
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal isOpen={!!deleteGoal} onClose={() => setDeleteGoal(null)} title="Delete goal" size="sm">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Are you sure you want to delete <strong className="text-gray-900 dark:text-white">"{deleteGoal?.title}"</strong>? This will also delete all its tasks.
        </p>
        <div className="flex gap-3">
          <button onClick={handleDelete} className="btn-danger flex-1 justify-center">
            Yes, delete
          </button>
          <button onClick={() => setDeleteGoal(null)} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
