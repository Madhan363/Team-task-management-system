import { useState } from 'react';

function TodoForm({ onAddTodo }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onAddTodo(trimmed);
    setText('');
  };

  return (
    <form className="todo-form" onSubmit={handleSubmit}>
      <div className="todo-input-wrapper">
        <input
          type="text"
          className="todo-input"
          placeholder="What needs to be accomplished?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="New task description"
        />
        <button
          type="submit"
          className="todo-submit-btn"
          aria-label="Add task"
          disabled={!text.trim()}
        >
          <svg
            className="btn-icon"
            viewBox="0 0 20 20"
            fill="currentColor"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>Add Task</span>
        </button>
      </div>
    </form>
  );
}

export default TodoForm;
