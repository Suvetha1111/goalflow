/**
 * Shared helper utilities
 */

// Format date nicely
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Days until deadline
export const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Color for deadline urgency
export const deadlineColor = (dateStr) => {
  const days = daysUntil(dateStr);
  if (days === null) return 'text-gray-400';
  if (days < 0)  return 'text-red-600 dark:text-red-400';
  if (days <= 3) return 'text-red-500 dark:text-red-400';
  if (days <= 7) return 'text-amber-500 dark:text-amber-400';
  return 'text-gray-500 dark:text-gray-400';
};

// Progress bar color based on completion %
export const progressColor = (pct) => {
  if (pct >= 100) return 'bg-green-500';
  if (pct >= 70)  return 'bg-blue-500';
  if (pct >= 40)  return 'bg-amber-500';
  return 'bg-red-400';
};

// XP to next level
export const xpToNextLevel = (xp) => {
  if (xp < 500)  return { next: 'Advanced', needed: 500 - xp, total: 500, current: xp };
  if (xp < 2000) return { next: 'Pro',      needed: 2000 - xp, total: 1500, current: xp - 500 };
  if (xp < 5000) return { next: 'Legend',   needed: 5000 - xp, total: 3000, current: xp - 2000 };
  return { next: null, needed: 0, total: 1, current: 1 };
};

// Level badge color
export const levelColor = (level) => {
  const map = {
    Beginner: 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800',
    Advanced: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30',
    Pro:      'text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-900/30',
    Legend:   'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30',
  };
  return map[level] || map.Beginner;
};

// Truncate long strings
export const truncate = (str, len = 60) =>
  str?.length > len ? str.slice(0, len) + '…' : str || '';
