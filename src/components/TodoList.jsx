import TodoItem from './TodoItem';

function TodoList({ todos, onToggleTodo, onDeleteTodo, filter, searchQuery }) {
  if (todos.length === 0) {
    let emptyTitle = 'No tasks found';
    let emptyDescription = 'Add a task above to start planning your day!';
    let emptyIcon = (
      <svg
        className="empty-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="2" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    );

    if (searchQuery) {
      emptyTitle = 'No matching tasks';
      emptyDescription = `No tasks match your search "${searchQuery}".`;
      emptyIcon = (
        <svg
          className="empty-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      );
    } else if (filter === 'active') {
      emptyTitle = 'All caught up!';
      emptyDescription = 'You have no active tasks pending. Great work!';
      emptyIcon = (
        <svg
          className="empty-icon empty-icon-success"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    } else if (filter === 'completed') {
      emptyTitle = 'No completed tasks yet';
      emptyDescription = 'Tasks you complete will show up here. Keep progressing!';
      emptyIcon = (
        <svg
          className="empty-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    }

    return (
      <div className="empty-state">
        <div className="empty-icon-wrapper">{emptyIcon}</div>
        <h3 className="empty-title">{emptyTitle}</h3>
        <p className="empty-description">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <ul className="todo-list" aria-label="Task list">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggleTodo={onToggleTodo}
          onDeleteTodo={onDeleteTodo}
        />
      ))}
    </ul>
  );
}

export default TodoList;
