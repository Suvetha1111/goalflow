/**
 * GoalForm — create or edit a goal
 */
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';

const PRIORITIES = ['low', 'medium', 'high'];

export default function GoalForm({ goal, onSuccess, onCancel }) {
  const isEdit = !!goal;
  const [form, setForm] = useState({
    title:       goal?.title || '',
    description: goal?.description || '',
    deadline:    goal?.deadline ? goal.deadline.split('T')[0] : '',
    priority:    goal?.priority || 'medium',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required.');
    setLoading(true);
    try {
      if (isEdit) {
        const { data } = await api.put(`/goals/${goal.id}`, form);
        toast.success('Goal updated!');
        onSuccess(data.goal);
      } else {
        const { data } = await api.post('/goals', form);
        toast.success('Goal created! 🎯');
        onSuccess(data.goal);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Goal title *</label>
        <input
          name="title"
          className="input"
          placeholder="e.g. Learn React in 30 days"
          value={form.title}
          onChange={handleChange}
          required
        />
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          name="description"
          rows={3}
          className="input resize-none"
          placeholder="What does success look like?"
          value={form.description}
          onChange={handleChange}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Deadline</label>
          <input
            name="deadline"
            type="date"
            className="input"
            value={form.deadline}
            onChange={handleChange}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
        <div>
          <label className="label">Priority</label>
          <select name="priority" className="input" value={form.priority} onChange={handleChange}>
            {PRIORITIES.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-50"
        >
          {loading ? 'Saving…' : isEdit ? 'Update goal' : 'Create goal'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary px-5">
          Cancel
        </button>
      </div>
    </form>
  );
}
