/**
 * Dashboard Page
 * Shows stats, charts, insights, and daily tracker
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { levelColor, xpToNextLevel } from '../utils/helpers';
import Heatmap from '../components/dashboard/Heatmap';

// Stat card subcomponent
const StatCard = ({ label, value, sub, icon, color = 'brand' }) => {
  const colors = {
    brand:  'from-brand-500 to-brand-600',
    green:  'from-green-400 to-green-600',
    amber:  'from-amber-400 to-amber-500',
    purple: 'from-purple-500 to-purple-600',
  };

  return (
    <div className="card p-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white text-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

// Insight card
const InsightCard = ({ insight }) => {
  const colors = {
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    info:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  return (
    <div className={`text-sm p-3 rounded-xl border ${colors[insight.type]} text-gray-700 dark:text-gray-300 animate-slide-up`}>
      {insight.message}
    </div>
  );
};

const PIE_COLORS = ['#6366f1', '#e5e7eb'];

export default function DashboardPage() {
  const { user, updateUser } = useAuth();
  const [stats, setStats]       = useState(null);
  const [chartData, setChart]   = useState([]);
  const [insights, setInsights] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]   = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, chartRes, insightRes, notifRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/daily-chart'),
        api.get('/goals/insights/smart'),
        api.get('/dashboard/notifications'),
      ]);

      setStats(statsRes.data);
      setChart(chartRes.data.chart_data || []);
      setInsights(insightRes.data.insights || []);
      setNotifications(notifRes.data.notifications || []);

      // Sync user XP/level from server
      if (statsRes.data.user) {
        updateUser(statsRes.data.user);
      }
    } catch (err) {
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [updateUser]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { goals, tasks, today, user: userStats, productivity_percentage } = stats || {};
  const xpInfo = xpToNextLevel(userStats?.xp_points || 0);
  const xpPct  = Math.min(Math.round((xpInfo.current / xpInfo.total) * 100), 100);

  const pieData = [
    { name: 'Completed', value: tasks?.completed || 0 },
    { name: 'Remaining', value: (tasks?.total - tasks?.completed) || 0 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Here's your productivity overview for today
          </p>
        </div>

        {/* Streak badge */}
        {userStats?.streak_count > 0 && (
          <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-4 py-2 rounded-2xl border border-orange-200 dark:border-orange-800">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-sm font-bold leading-none">{userStats.streak_count} days</p>
              <p className="text-xs opacity-70">current streak</p>
            </div>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Goals"    value={goals?.total || 0}  icon="◎" color="brand" sub={`${goals?.active || 0} active`} />
        <StatCard label="Goals Done"     value={goals?.completed || 0} icon="✓" color="green" sub="all time" />
        <StatCard label="Tasks Today"    value={`${today?.completed || 0}/${today?.total || 0}`} icon="◈" color="amber" sub="completed" />
        <StatCard label="Productivity"   value={`${productivity_percentage || 0}%`} icon="↑" color="purple" sub="overall" />
      </div>

      {/* XP + Level bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${levelColor(userStats?.level)}`}>
              {userStats?.level || 'Beginner'}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {userStats?.xp_points || 0} XP total
            </span>
          </div>
          {xpInfo.next && (
            <span className="text-xs text-gray-400">{xpInfo.needed} XP to {xpInfo.next}</span>
          )}
        </div>
        <div className="progress-bar h-3">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-700"
            style={{ width: `${xpPct}%` }}
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Line chart: daily progress */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            14-day progress
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-800" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                interval={2}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--tw-bg-opacity)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="tasks_completed"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', r: 3 }}
                name="Tasks completed"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart: task breakdown */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Task breakdown
          </h2>
          {(tasks?.total || 0) === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No tasks yet — create some goals to get started!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v, '']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <Heatmap />

      {/* Bottom row: insights + notifications */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Smart insights */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            Smart insights
          </h2>
          {insights.length === 0 ? (
            <p className="text-sm text-gray-400">No insights yet — keep working on your goals!</p>
          ) : (
            <div className="space-y-2">
              {insights.map((ins, i) => (
                <InsightCard key={i} insight={ins} />
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            Reminders
          </h2>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400">No upcoming deadlines. You're all clear! ✅</p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className={`text-sm p-3 rounded-xl border ${
                    n.is_read
                      ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 text-gray-400'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {n.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
