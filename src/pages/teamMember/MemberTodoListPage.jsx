import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckSquare, RefreshCw } from 'lucide-react';
import { api } from '../../api';
import TodoFilter from '../../components/TodoFilter';
import TodoForm from '../../components/TodoForm';
import TodoList from '../../components/TodoList';

async function getPersonalTasks() {
  const result = await api.getPersonalTasks();
  return result.tasks || [];
}

function MemberTodoListPage() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('recommended');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getPersonalTasks()
      .then((personalTasks) => {
        if (active) setTasks(personalTasks);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Failed to load your Todo List.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    setError('');
    try {
      setTasks(await getPersonalTasks());
    } catch (requestError) {
      setError(requestError.message || 'Failed to load your Todo List.');
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async (todo) => {
    setSaving(true);
    setError('');
    try {
      const result = await api.createTask(todo);
      setTasks((current) => [result.task, ...current]);
    } catch (requestError) {
      setError(requestError.message || 'Could not add this task.');
      throw requestError;
    } finally {
      setSaving(false);
    }
  };

  const toggleTodo = async (todo) => {
    setSaving(true);
    setError('');
    try {
      const result = await api.updateTask(todo.id, { completed: !todo.completed });
      setTasks((current) => current.map((task) => task.id === todo.id ? result.task : task));
    } catch (requestError) {
      setError(requestError.message || 'Could not update this task.');
    } finally {
      setSaving(false);
    }
  };

  const updateTodo = async (taskId, changes) => {
    setSaving(true);
    setError('');
    try {
      const result = await api.updateTask(taskId, changes);
      setTasks((current) => current.map((task) => task.id === taskId ? result.task : task));
    } catch (requestError) {
      setError(requestError.message || 'Could not save this task.');
      throw requestError;
    } finally {
      setSaving(false);
    }
  };

  const deleteTodo = async (taskId) => {
    setSaving(true);
    setError('');
    try {
      await api.deleteTask(taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch (requestError) {
      setError(requestError.message || 'Could not delete this task.');
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => ({
    all: tasks.length,
    active: tasks.filter((task) => !task.completed).length,
    completed: tasks.filter((task) => task.completed).length,
  }), [tasks]);

  const visibleTasks = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filtered = tasks.filter((task) => {
      const matchesFilter = filter === 'all'
        || (filter === 'active' && !task.completed)
        || (filter === 'completed' && task.completed);
      const matchesSearch = !normalizedSearch
        || `${task.title} ${task.description} ${task.category}`.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });

    const priorityRank = { high: 3, medium: 2, low: 1 };
    return filtered.sort((a, b) => {
      if (sortMode === 'deadline') {
        if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
        return a.dueDate ? -1 : b.dueDate ? 1 : 0;
      }
      if (sortMode === 'priority') return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      const priorityDifference = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
      if (priorityDifference) return priorityDifference;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      return a.dueDate ? -1 : b.dueDate ? 1 : 0;
    });
  }, [filter, searchQuery, sortMode, tasks]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const urgentTaskIds = new Set(tasks
    .filter((task) => !task.completed && task.dueDate && new Date(task.dueDate) < today)
    .map((task) => task.id));
  const recommendedTaskId = visibleTasks.find((task) => !task.completed)?.id;

  return (
    <div className="tf-page-container">
      <div className="tf-page-header">
        <div>
          <h2>My Todo List</h2>
          <p>Keep track of your personal tasks separately from assignments from your Team Leader.</p>
        </div>
        <button
          type="button"
          className="tf-btn tf-btn-secondary"
          onClick={() => {
            setLoading(true);
            setError('');
            loadTasks();
          }}
          disabled={loading || saving}
        >
          <RefreshCw size={14} className={loading ? 'tf-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="tf-alert tf-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="tf-card tf-member-todo-card" aria-label="Personal todo tasks">
        <div className="tf-card-header">
          <div className="tf-card-title-row">
            <CheckSquare size={20} />
            <h3>Personal tasks</h3>
          </div>
          <span className="tf-card-subtitle">
            {counts.active} active · {counts.completed} completed
          </span>
        </div>

        <TodoForm onAddTodo={addTodo} />
        <TodoFilter
          filter={filter}
          onFilterChange={setFilter}
          counts={counts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
        />

        {loading ? (
          <div className="tf-loading-box" role="status">
            <RefreshCw size={22} className="tf-spin" />
            <p>Loading your personal tasks…</p>
          </div>
        ) : (
          <TodoList
            todos={visibleTasks}
            onToggleTodo={toggleTodo}
            onDeleteTodo={deleteTodo}
            onUpdateTodo={updateTodo}
            filter={filter}
            searchQuery={searchQuery}
            urgentTaskIds={urgentTaskIds}
            recommendedTaskId={recommendedTaskId}
          />
        )}
      </section>
    </div>
  );
}

export default MemberTodoListPage;
