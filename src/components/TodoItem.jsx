function TodoItem({ todo, onToggleTodo, onDeleteTodo }) {
  return (
    <li className={`todo-item ${todo.completed ? 'completed' : ''}`}>
      <label className="todo-content" htmlFor={`todo-check-${todo.id}`}>
        <input
          id={`todo-check-${todo.id}`}
          type="checkbox"
          className="todo-checkbox"
          checked={todo.completed}
          onChange={() => onToggleTodo(todo.id)}
          aria-label={`Mark "${todo.text}" as ${todo.completed ? 'incomplete' : 'complete'}`}
        />
        <span className="checkbox-custom" aria-hidden="true">
          <svg
            className="check-icon"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 11 8 15 16 6" />
          </svg>
        </span>
        <span className="todo-text">{todo.text}</span>
      </label>

      <button
        type="button"
        className="todo-delete-btn"
        onClick={() => onDeleteTodo(todo.id)}
        aria-label={`Delete "${todo.text}"`}
        title="Delete task"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="trash-icon"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>
    </li>
  );
}

export default TodoItem;
