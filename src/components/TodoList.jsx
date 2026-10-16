import TodoItem from './TodoItem';

function TodoList({
  todos,
  onToggleTodo,
  onDeleteTodo,
  onUpdateTodo,
  filter,
  searchQuery,
  urgentTaskIds,
  recommendedTaskId,
}) {
  if (todos.length === 0) {
    let message = 'Add a task above to get started.';
    if (searchQuery.trim()) {
      message = `No tasks match "${searchQuery.trim()}".`;
    } else if (filter === 'active') {
      message = 'You have no active tasks.';
    } else if (filter === 'completed') {
      message = 'Completed tasks will appear here.';
    }

    return (
      <div className="empty-state">
        <h2 className="empty-title">No tasks to show</h2>
        <p className="empty-description">{message}</p>
      </div>
    );
  }

  return (
    <ul className="todo-list" aria-label="Tasks">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggleTodo={onToggleTodo}
          onDeleteTodo={onDeleteTodo}
          onUpdateTodo={onUpdateTodo}
          urgent={urgentTaskIds.has(todo.id)}
          recommended={!todo.completed && todo.id === recommendedTaskId}
        />
      ))}
    </ul>
  );
}

export default TodoList;
