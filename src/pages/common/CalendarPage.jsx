import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, RefreshCw } from 'lucide-react';
import { getTaskAssignee, getTaskDate, loadTaskWorkspace } from '../../services/taskWorkspace';

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function taskScheduleDate(task) {
  return getTaskDate(task.dueDate) || getTaskDate(task.startDate) || getTaskDate(task.createdAt);
}

function mondayOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function CalendarPage({ role }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));

  const loadTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadTaskWorkspace(role);
      setTasks(data.tasks);
    } catch (err) {
      setError(err.message || 'Failed to load calendar tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [role]);

  const calendarDays = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = mondayOfWeek(first);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [visibleMonth]);

  const tasksByDay = useMemo(() => {
    const result = new Map();
    tasks.forEach((task) => {
      const scheduled = taskScheduleDate(task);
      if (!scheduled) return;
      const key = dateKey(scheduled);
      result.set(key, [...(result.get(key) || []), task]);
    });
    return result;
  }, [tasks]);

  const selectedDayTasks = tasksByDay.get(selectedDay) || [];
  const upcomingTasks = useMemo(() => tasks
    .filter((task) => task.status !== 'completed')
    .map((task) => ({ task, date: taskScheduleDate(task) }))
    .filter(({ date }) => date && dateKey(date) >= dateKey(new Date()))
    .sort((a, b) => a.date - b.date)
    .slice(0, 8), [tasks]);

  return (
    <div className="tf-page-container">
      <div className="tf-page-header">
        <div>
          <h2>Calendar</h2>
          <p>Review task deadlines, weekly schedules, and upcoming work.</p>
        </div>
        <button type="button" className="tf-btn tf-btn-secondary" onClick={loadTasks} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'tf-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="tf-alert tf-alert-error" role="alert"><AlertCircle size={18} />{error}</div>}

      <div className="tf-workspace-result-grid">
        <section className="tf-card tf-calendar-card">
          <div className="tf-calendar-heading">
            <h3><CalendarDays size={18} />{visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
            <div className="tf-header-actions">
              <button type="button" className="tf-icon-action-btn" aria-label="Previous month" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ArrowLeft size={16} /></button>
              <button type="button" className="tf-icon-action-btn" aria-label="Next month" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ArrowRight size={16} /></button>
            </div>
          </div>
          <div className="tf-calendar-grid tf-calendar-weekdays">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <strong key={day}>{day}</strong>)}
          </div>
          <div className="tf-calendar-grid">
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const dayTasks = tasksByDay.get(key) || [];
              return (
                <button
                  type="button"
                  key={key}
                  className={`tf-calendar-day ${day.getMonth() === visibleMonth.getMonth() ? '' : 'tf-calendar-outside'} ${selectedDay === key ? 'tf-calendar-selected' : ''}`}
                  onClick={() => setSelectedDay(key)}
                >
                  <span>{day.getDate()}</span>
                  {dayTasks.length > 0 && <small>{dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}</small>}
                  {dayTasks.slice(0, 2).map((task) => <i key={task.id} className={`tf-calendar-dot tf-priority-${task.priority}`} title={task.title} />)}
                </button>
              );
            })}
          </div>
          <div className="tf-calendar-day-tasks">
            <h4>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h4>
            {loading ? <p className="tf-text-muted">Loading schedule…</p>
              : selectedDayTasks.length === 0 ? <p className="tf-text-muted">No tasks scheduled for this day.</p>
                : selectedDayTasks.map((task) => (
                  <div className="tf-search-result" key={task.id}>
                    <strong>{task.title}</strong>
                    <span>{getTaskAssignee(task)?.name || 'Unassigned'} · {task.status?.replaceAll('_', ' ')}</span>
                  </div>
                ))}
          </div>
        </section>

        <section className="tf-card tf-upcoming-card">
          <h3>Upcoming Deadlines</h3>
          {loading ? <p className="tf-text-muted">Loading upcoming tasks…</p>
            : upcomingTasks.length === 0 ? <p className="tf-text-muted">No upcoming deadlines.</p>
              : upcomingTasks.map(({ task, date }) => (
                <div className="tf-upcoming-task" key={task.id}>
                  <div><strong>{task.title}</strong><span>{getTaskAssignee(task)?.name || 'Unassigned'}</span></div>
                  <time>{date.toLocaleDateString()}</time>
                </div>
              ))}
          <h3 className="tf-week-heading">This Week</h3>
          {Array.from({ length: 7 }, (_, index) => {
            const day = mondayOfWeek(new Date());
            day.setDate(day.getDate() + index);
            const dayTasks = tasksByDay.get(dateKey(day)) || [];
            return (
              <div className="tf-week-row" key={dateKey(day)}>
                <span>{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</span>
                <strong>{dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}</strong>
              </div>
            );
          })}
        </section>
      </div>

    </div>
  );
}

export default CalendarPage;
