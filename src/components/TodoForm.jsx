import { useState } from 'react';

const EMPTY_TASK = {
  title: '',
  description: '',
  category: 'General',
  priority: 'medium',
  dueDate: '',
  reminderAt: '',
};

function toIsoDate(value) {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}

function toIsoDateTime(value) {
  return value ? new Date(value).toISOString() : null;
}

function TodoForm({ onAddTodo }) {
  const [task, setTask] = useState(EMPTY_TASK);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updateField = (event) => {
    setTask((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!task.title.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onAddTodo({
        title: task.title.trim(),
        description: task.description.trim(),
        category: task.category.trim() || 'General',
        priority: task.priority,
        dueDate: toIsoDate(task.dueDate),
        reminderAt: toIsoDateTime(task.reminderAt),
        completed: false,
      });
      setTask(EMPTY_TASK);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="todo-form" onSubmit={handleSubmit}>
      <div className="todo-input-wrapper">
        <input
          type="text"
          className="todo-input"
          name="title"
          maxLength={120}
          placeholder="What needs to be done?"
          value={task.title}
          onChange={updateField}
          aria-label="New task title"
          required
        />
        <button type="submit" className="todo-submit-btn" disabled={!task.title.trim() || saving}>
          <span aria-hidden="true">+</span>
          <span>{saving ? 'Adding…' : 'Add Task'}</span>
        </button>
      </div>
      <details className="task-details">
        <summary>Add description, category, priority, or a reminder</summary>
        <div className="task-details-grid">
          <label className="task-field task-description-field">
            Description
            <textarea
              name="description"
              maxLength={2000}
              rows={2}
              value={task.description}
              onChange={updateField}
              placeholder="Add more context"
            />
          </label>
          <label className="task-field">
            Category
            <input name="category" maxLength={40} value={task.category} onChange={updateField} />
          </label>
          <label className="task-field">
            Priority
            <select name="priority" value={task.priority} onChange={updateField}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="task-field">
            Due date
            <input name="dueDate" type="date" value={task.dueDate} onChange={updateField} />
          </label>
          <label className="task-field">
            Reminder
            <input
              name="reminderAt"
              type="datetime-local"
              value={task.reminderAt}
              onChange={updateField}
            />
          </label>
        </div>
      </details>
      {error && <p className="task-error" role="alert">{error}</p>}
    </form>
  );
}

export default TodoForm;
