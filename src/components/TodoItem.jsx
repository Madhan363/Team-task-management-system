import { useState } from 'react';

function inputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function inputDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const localDate = inputDate(value);
  const localTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${localDate}T${localTime}`;
}

function TodoItem({
  todo,
  onToggleTodo,
  onDeleteTodo,
  onUpdateTodo,
  urgent = false,
  recommended = false,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const overdue = !todo.completed && todo.dueDate && new Date(todo.dueDate) < new Date();

  const startEditing = () => {
    setDraft({
      title: todo.title || todo.text,
      description: todo.description || '',
      category: todo.category || 'General',
      priority: todo.priority || 'medium',
      dueDate: inputDate(todo.dueDate),
      reminderAt: inputDateTime(todo.reminderAt),
    });
    setError('');
    setEditing(true);
  };

  const saveChanges = async (event) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      setError('Task title is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onUpdateTodo(todo.id, {
        title: draft.title.trim(),
        description: draft.description.trim(),
        category: draft.category.trim() || 'General',
        priority: draft.priority,
        dueDate: draft.dueDate ? new Date(`${draft.dueDate}T12:00:00`).toISOString() : null,
        reminderAt: draft.reminderAt ? new Date(draft.reminderAt).toISOString() : null,
      });
      setEditing(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (event) => {
    setDraft((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  return (
    <li className={`todo-item ${todo.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''} ${urgent ? 'urgent' : ''} ${recommended ? 'recommended-next' : ''}`}>
      {editing ? (
        <form className="task-edit-form" onSubmit={saveChanges}>
          <label className="task-field">
            Title
            <input
              name="title"
              maxLength={120}
              value={draft.title}
              onChange={updateDraft}
              required
            />
          </label>
          <label className="task-field">
            Description
            <textarea
              name="description"
              rows={2}
              maxLength={2000}
              value={draft.description}
              onChange={updateDraft}
            />
          </label>
          <div className="task-details-grid">
            <label className="task-field">
              Category
              <input name="category" maxLength={40} value={draft.category} onChange={updateDraft} />
            </label>
            <label className="task-field">
              Priority
              <select name="priority" value={draft.priority} onChange={updateDraft}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="task-field">
              Due date
              <input name="dueDate" type="date" value={draft.dueDate} onChange={updateDraft} />
            </label>
            <label className="task-field">
              Reminder
              <input
                name="reminderAt"
                type="datetime-local"
                value={draft.reminderAt}
                onChange={updateDraft}
              />
            </label>
          </div>
          {error && <p className="task-error" role="alert">{error}</p>}
          <div className="task-actions">
            <button type="submit" className="task-action-button" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="task-action-button secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="task-main">
            <div className="todo-content">
              {!todo.completed && (
                <input
                  type="checkbox"
                  className="todo-checkbox"
                  checked={false}
                  onChange={() => onToggleTodo(todo)}
                  aria-label={`Mark "${todo.title}" as complete`}
                />
              )}
              <span className="todo-text">{todo.title || todo.text}</span>
            </div>
            {todo.description && <p className="task-description">{todo.description}</p>}
            <div className="task-metadata">
              {urgent && <span className="task-chip urgent-chip">Urgent</span>}
              {recommended && <span className="task-chip suggested-chip">Suggested next</span>}
              <span className="task-chip category-chip">{todo.category || 'General'}</span>
              <span className={`task-chip priority-${todo.priority || 'medium'}`}>
                {todo.priority || 'medium'} priority
              </span>
              {todo.dueDate && (
                <span className={`task-chip ${overdue ? 'overdue-chip' : ''}`}>
                  {overdue ? 'Overdue · ' : 'Due · '}
                  {new Date(todo.dueDate).toLocaleDateString()}
                </span>
              )}
              {todo.reminderAt && (
                <span className="task-chip reminder-chip">
                  Reminder · {new Date(todo.reminderAt).toLocaleString()}
                </span>
              )}
              {todo.completed && (
                <span
                  className="task-chip completed-at-chip"
                  title={todo.completedAt ? new Date(todo.completedAt).toISOString() : undefined}
                >
                  {todo.completedAt
                    ? `Completed · ${new Date(todo.completedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                    })}`
                    : 'Completed · time not recorded'}
                </span>
              )}
            </div>
          </div>
          <div className="task-actions">
            <button
              type="button"
              className="task-action-button"
              onClick={startEditing}
              disabled={todo.completed}
              title={todo.completed ? 'Mark the task incomplete before editing it.' : undefined}
            >
              {todo.completed ? 'Completed' : 'Edit'}
            </button>
            <button
              type="button"
              className="todo-delete-btn"
              onClick={() => onDeleteTodo(todo.id)}
              aria-label={`Delete "${todo.title || todo.text}"`}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
}

export default TodoItem;
