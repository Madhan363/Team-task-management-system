function TodoFilter({
  filter,
  onFilterChange,
  counts,
  searchQuery,
  onSearchChange,
  sortMode,
  onSortModeChange,
}) {
  const tabs = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'active', label: 'Active', count: counts.active },
    { id: 'completed', label: 'Completed', count: counts.completed },
  ];

  return (
    <div className="filter-and-search-container">
      <div className="search-input-wrapper">
        <input
          type="search"
          className="search-input"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search tasks"
        />
        {searchQuery && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>

      <div className="filter-controls">
        <div className="todo-filter-container" role="tablist" aria-label="Task filters">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`filter-btn ${filter === tab.id ? 'active' : ''}`}
              onClick={() => onFilterChange(tab.id)}
            >
              <span>{tab.label}</span>
              <span className="filter-badge">{tab.count}</span>
            </button>
          ))}
        </div>
        <label className="task-sort-control">
          <span>Sort by</span>
          <select value={sortMode} onChange={(event) => onSortModeChange(event.target.value)}>
            <option value="recommended">Recommended</option>
            <option value="deadline">Deadline</option>
            <option value="priority">Priority</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export default TodoFilter;
