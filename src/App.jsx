import { useState, useEffect, useMemo } from 'react';
import { api } from './api';
import ProfileDirectory from './components/ProfileDirectory';
import TodoTour from './components/TodoTour';
import TodoForm from './components/TodoForm';
import TodoFilter from './components/TodoFilter';
import TodoList from './components/TodoList';
import './App.css';

function App() {
  const [activeUser, setActiveUser] = useState(null);
  const [todos, setTodos] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [appError, setAppError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    const restoreSession = async () => {
      try {
        const { user } = await api.session();
        const { tasks } = await api.listTasks();
        if (isCurrent) {
          setActiveUser(user);
          setTodos(tasks);
        }
      } catch (error) {
        const isExpectedSignedOut = error.message === 'Please sign in to continue.'
          || error.message === 'Session expired. Please sign in again.'
          || error.message === 'Session is no longer valid. Please sign in again.';
        if (isCurrent && !isExpectedSignedOut) setAppError(error.message);
      } finally {
        if (isCurrent) setIsInitializing(false);
      }
    };
    restoreSession();
    return () => {
      isCurrent = false;
    };
  }, []);

  const handleLogin = async (username, password) => {
    const { user } = await api.login(username, password);
    const { tasks } = await api.listTasks();
    setActiveUser(user);
    setTodos(tasks);
    setAppError('');
  };

  const handleRegister = async (newUser) => {
    const { user } = await api.register(newUser);
    const { tasks } = await api.listTasks();
    setActiveUser(user);
    setTodos(tasks);
    setAppError('');
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setActiveUser(null);
      setTodos([]);
      setAppError('');
      setSearchQuery('');
      setFilter('all');
    } catch (error) {
      setAppError(error.message);
    }
  };

  const handleAddTodo = async (text) => {
    try {
      const { task } = await api.createTask(text);
      setTodos((previousTodos) => [task, ...previousTodos]);
      setAppError('');
    } catch (error) {
      setAppError(error.message);
    }
  };

  const handleToggleTodo = async (id) => {
    const currentTask = todos.find((task) => task.id === id);
    if (!currentTask) return;
    try {
      const { task } = await api.updateTask(id, !currentTask.completed);
      setTodos((previousTodos) => previousTodos.map((item) => (item.id === id ? task : item)));
      setAppError('');
    } catch (error) {
      setAppError(error.message);
    }
  };

  const handleDeleteTodo = async (id) => {
    try {
      await api.deleteTask(id);
      setTodos((previousTodos) => previousTodos.filter((task) => task.id !== id));
      setAppError('');
    } catch (error) {
      setAppError(error.message);
    }
  };

  const handleClearCompleted = async () => {
    try {
      await api.clearCompletedTasks();
      setTodos((previousTodos) => previousTodos.filter((task) => !task.completed));
      setAppError('');
    } catch (error) {
      setAppError(error.message);
    }
  };

  // Avatar gradient helper
  const getThemeGradient = (themeId) => {
    const map = {
      aurora: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
      cyber: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
      emerald: 'linear-gradient(135deg, #10b981, #06b6d4)',
      amber: 'linear-gradient(135deg, #f59e0b, #ef4444)',
      sapphire: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    };
    return map[themeId] || map.aurora;
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Statistics calculation
  const totalCount = todos.length;
  const completedCount = todos.filter((t) => t.completed).length;
  const pendingCount = totalCount - completedCount;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Filtered & searched todos
  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      // 1. Filter tab
      if (filter === 'active' && todo.completed) return false;
      if (filter === 'completed' && !todo.completed) return false;

      // 2. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        return todo.text.toLowerCase().includes(query);
      }
      return true;
    });
  }, [todos, filter, searchQuery]);

  if (window.location.pathname === '/tour') {
    return <TodoTour />;
  }

  if (isInitializing) {
    return <main className="directory-container" aria-live="polite">Connecting to your workspace…</main>;
  }

  if (!activeUser) {
    return (
      <ProfileDirectory
        onLogin={handleLogin}
        onRegister={handleRegister}
        globalError={appError}
      />
    );
  }

  // Screen 2: Authenticated Private To-Do Dashboard
  return (
    <div className="dashboard-wrapper">
      {/* Aurora Ambient Background Orbs */}
      <div className="ambient-orb orb-1" aria-hidden="true" />
      <div className="ambient-orb orb-2" aria-hidden="true" />
      <div className="ambient-orb orb-3" aria-hidden="true" />

      <main className="dashboard-card">
        {appError && <div className="form-error-alert" role="alert">{appError}</div>}
        {/* User Session Bar */}
        <div className="dashboard-user-bar">
          <div className="active-user-info">
            <div
              className="user-avatar-badge"
              style={{ background: getThemeGradient(activeUser.theme) }}
            >
              {getInitials(activeUser.name)}
            </div>
            <div className="user-identity">
              <span className="user-greeting">Authenticated Session</span>
              <div className="user-name-line">
                <strong className="user-full-name">{activeUser.name}</strong>
                <span className="user-handle">@{activeUser.username}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-lock-profile"
            onClick={handleLogout}
            title="Lock your profile and return to directory"
            aria-label="Lock profile and return to directory"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Lock & Sign Out</span>
          </button>
        </div>

        {/* Full Screen Dashboard Grid */}
        <div className="dashboard-content-grid">
          {/* Left Panel: Header, Stats & Progress */}
          <aside className="dashboard-sidebar">
            <header className="dashboard-header">
              <div className="brand-pill">
                <span className="pulse-dot" />
                <span>PRIVATE TASK VAULT</span>
              </div>
              <h1 className="dashboard-title">
                My <span className="gradient-text">Tasks</span>
              </h1>
              <p className="dashboard-subtitle">
                Private workspace for {activeUser.name}. Visible only to you.
              </p>
            </header>

            {/* Live Metrics Grid */}
            <section className="stats-section" aria-label="Task metrics">
              <div className="stat-card">
                <span className="stat-value">{totalCount}</span>
                <span className="stat-label">Total</span>
              </div>
              <div className="stat-card stat-pending">
                <span className="stat-value">{pendingCount}</span>
                <span className="stat-label">Pending</span>
              </div>
              <div className="stat-card stat-completed">
                <span className="stat-value">{completedCount}</span>
                <span className="stat-label">Completed</span>
              </div>
            </section>

            {/* Animated Progress Bar */}
            {totalCount > 0 && (
              <div className="progress-container" aria-label="Completion progress">
                <div className="progress-header">
                  <span className="progress-text">Completion Rate</span>
                  <span className="progress-percentage">{completionRate}%</span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuenow={completionRate}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>
            )}
          </aside>

          {/* Right Panel: Tasks Management & List */}
          <section className="dashboard-main-panel">
            {/* Add Task Input Form */}
            <TodoForm onAddTodo={handleAddTodo} />

            {/* Filter Navigation and Search Bar */}
            <TodoFilter
              filter={filter}
              onFilterChange={setFilter}
              counts={{ all: totalCount, active: pendingCount, completed: completedCount }}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />

            {/* Task List / Contextual Empty State */}
            <TodoList
              todos={filteredTodos}
              onToggleTodo={handleToggleTodo}
              onDeleteTodo={handleDeleteTodo}
              filter={filter}
              searchQuery={searchQuery}
            />

            {/* Footer with Clear Completed */}
            {totalCount > 0 && (
              <footer className="dashboard-footer">
                <span className="footer-status">
                  {pendingCount === 0
                    ? '🎉 All caught up! Every task completed.'
                    : `${pendingCount} ${pendingCount === 1 ? 'task' : 'tasks'} remaining`}
                </span>
                {completedCount > 0 && (
                  <button
                    type="button"
                    className="btn-clear-completed"
                    onClick={handleClearCompleted}
                    aria-label="Clear all completed tasks"
                  >
                    Clear completed ({completedCount})
                  </button>
                )}
              </footer>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
