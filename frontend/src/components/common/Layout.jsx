/**
 * Layout — persistent sidebar + top nav shell
 */
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { levelColor, xpToNextLevel } from '../../utils/helpers';

const NAV = [
  { to: '/dashboard', icon: '◈', label: 'Dashboard' },
  { to: '/goals',     icon: '◎', label: 'Goals' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const xpInfo = xpToNextLevel(user?.xp_points || 0);
  const xpPct  = Math.round((xpInfo.current / xpInfo.total) * 100);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shrink-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0">
            GF
          </div>
          {sidebarOpen && (
            <span className="font-semibold text-gray-900 dark:text-white tracking-tight">
              GoalFlow
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? '◁' : '▷'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <span className="text-lg w-5 text-center">{icon}</span>
              {sidebarOpen && label}
            </NavLink>
          ))}
        </nav>

        {/* User panel */}
        {sidebarOpen && user && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800">
            {/* XP Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${levelColor(user.level)}`}>
                  {user.level}
                </span>
                <span className="text-xs text-gray-400">{user.xp_points} XP</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill bg-brand-500"
                  style={{ width: `${Math.min(xpPct, 100)}%` }}
                />
              </div>
              {xpInfo.next && (
                <p className="text-xs text-gray-400 mt-1">{xpInfo.needed} XP to {xpInfo.next}</p>
              )}
            </div>

            {/* User info */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-semibold text-sm">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-6 gap-4 shrink-0">
          {/* Streak */}
          {user?.streak_count > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full text-sm font-medium">
              🔥 {user.streak_count} day streak
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center text-sm"
              aria-label="Toggle dark mode"
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
