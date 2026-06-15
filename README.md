# GoalFlow 🎯

A modern, production-ready goal tracking web app with gamification, smart insights, and drag-and-drop task management.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 Authentication | JWT-based signup/login with bcrypt hashing |
| 🎯 Goal Management | Create, edit, delete goals with priority & deadlines |
| ✅ Task System | Tasks with drag-and-drop reordering, status toggling |
| 📊 Progress Tracking | Auto-calculated completion %, animated progress bars |
| 📈 Dashboard | Stats, pie chart, 14-day line chart, smart insights |
| 🔥 Streaks | Daily login streaks with visual badge |
| ⚡ Gamification | XP points, leveling system (Beginner → Advanced → Pro → Legend) |
| 🌙 Dark Mode | System-aware dark/light theme toggle |
| 🔔 Notifications | Auto-generated deadline reminders |
| 🧠 Smart Insights | AI-like suggestions based on your progress |
| 📱 Responsive | Works on mobile and desktop |
| 🖱️ Drag & Drop | @dnd-kit powered task reordering |

---

## 🗂 Project Structure

```
goalflow/
├── backend/
│   ├── config/
│   │   └── database.js       # NeonDB connection + schema init
│   ├── middleware/
│   │   └── auth.js           # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js           # Signup, login, /me
│   │   ├── goals.js          # CRUD + smart insights
│   │   ├── tasks.js          # CRUD + XP + reorder
│   │   └── dashboard.js      # Stats, charts, notifications
│   ├── server.js             # Express app entry point
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── auth/
    │   │   ├── common/
    │   │   │   ├── Layout.jsx       # Sidebar + top nav
    │   │   │   ├── Modal.jsx        # Accessible modal
    │   │   │   └── ProgressBar.jsx  # Animated progress bar
    │   │   ├── goals/
    │   │   │   ├── GoalCard.jsx     # Goal summary card
    │   │   │   └── GoalForm.jsx     # Create/edit form
    │   │   └── tasks/
    │   │       └── TaskItem.jsx     # Draggable task row
    │   ├── context/
    │   │   ├── AuthContext.jsx      # Global user auth state
    │   │   └── ThemeContext.jsx     # Dark/light mode
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── SignupPage.jsx
    │   │   ├── DashboardPage.jsx    # Main dashboard
    │   │   ├── GoalsPage.jsx        # Goals list + filters
    │   │   └── GoalDetailPage.jsx   # Goal + tasks (drag/drop)
    │   ├── utils/
    │   │   ├── api.js               # Axios with interceptors
    │   │   └── helpers.js           # Date, color, XP helpers
    │   ├── App.jsx                  # Router + providers
    │   └── main.jsx
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## 🗄 Database Schema (NeonDB / PostgreSQL)

```sql
-- users: auth + gamification
users (id, name, email, password_hash, xp_points, level, streak_count, last_active_date)

-- goals: user's goals
goals (id, user_id, title, description, deadline, priority, status, completion_percentage)

-- tasks: belong to goals
tasks (id, goal_id, user_id, title, description, status, due_date, position, xp_reward)

-- daily_tracker: streak + productivity history
daily_tracker (id, user_id, date, tasks_completed, xp_earned)

-- notifications: deadline reminders
notifications (id, user_id, type, message, is_read, related_goal_id)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- A [NeonDB](https://neon.tech) account (free tier works)
- npm or yarn

### 1. Clone the project

```bash
git clone <your-repo-url> goalflow
cd goalflow
```

### 2. Set up the backend

```bash
cd backend
npm install

# Copy and configure .env
cp .env.example .env
```

Edit `backend/.env`:
```env
PORT=5000
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/goalflow?sslmode=require
JWT_SECRET=your_long_random_secret_here
CLIENT_URL=http://localhost:3000
```

**Getting your NeonDB connection string:**
1. Go to [neon.tech](https://neon.tech) → New Project
2. Copy the connection string from your dashboard
3. Paste it as `DATABASE_URL`

### 3. Start the backend

```bash
cd backend
npm run dev
# API running on http://localhost:5000
# Database schema auto-created on first start
```

### 4. Set up the frontend

```bash
cd frontend
npm install
npm run dev
# App running on http://localhost:3000
```

### 5. Open the app

Visit [http://localhost:3000](http://localhost:3000) → Sign up → Start tracking! 🎉

---

## 📡 API Reference

### Auth
```
POST /api/auth/signup    { name, email, password }
POST /api/auth/login     { email, password }
GET  /api/auth/me        (Bearer token)
```

### Goals
```
GET    /api/goals                   List all goals
POST   /api/goals                   Create goal
GET    /api/goals/:id               Get goal + tasks
PUT    /api/goals/:id               Update goal
DELETE /api/goals/:id               Delete goal
GET    /api/goals/insights/smart    Smart insights
```

### Tasks
```
GET    /api/tasks                   Today's tasks
GET    /api/tasks/all               All tasks (filterable)
POST   /api/tasks                   Create task
PATCH  /api/tasks/:id/status        Update status (awards XP)
PUT    /api/tasks/:id               Full update
DELETE /api/tasks/:id               Delete task
PUT    /api/tasks/reorder/batch     Drag-and-drop reorder
```

### Dashboard
```
GET   /api/dashboard/stats          Overall stats
GET   /api/dashboard/daily-chart    14-day progress data
GET   /api/dashboard/notifications  Deadline reminders
PATCH /api/dashboard/notifications/:id/read  Mark read
```

---

## 🎮 Gamification System

| Level | XP Required |
|---|---|
| Beginner | 0 – 499 XP |
| Advanced | 500 – 1,999 XP |
| Pro | 2,000 – 4,999 XP |
| Legend | 5,000+ XP |

Each completed task awards **+10 XP** by default.

---

## 🔧 Environment Variables

| Variable | Description |
|---|---|
| `PORT` | API server port (default: 5000) |
| `DATABASE_URL` | NeonDB PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs (keep private!) |
| `JWT_EXPIRES_IN` | Token expiry (default: 7d) |
| `CLIENT_URL` | Frontend URL for CORS |

---

## 🚢 Deployment

### Backend (Railway / Render / Fly.io)
1. Set environment variables in dashboard
2. Deploy as Node.js app
3. Entry point: `node server.js`

### Frontend (Vercel / Netlify)
1. Build command: `npm run build`
2. Output directory: `dist`
3. Set `VITE_API_URL` if needed (update `utils/api.js` base URL)

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, @dnd-kit, react-hot-toast
- **Backend**: Node.js, Express, PostgreSQL (NeonDB), JWT, bcryptjs
- **Database**: NeonDB (serverless PostgreSQL)

---

Built with ❤️ for productive people.
