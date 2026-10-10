function TodoFilter({ filter, onFilterChange, counts, searchQuery, onSearchChange }) {
  const filterTabs = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'active', label: 'Active', count: counts.active },
    { id: 'completed', label: 'Completed', count: counts.completed },
  ];

  return (
    <div className="filter-and-search-container">
      {/* Search Input */}
      <div className="search-input-wrapper">
        <svg
          className="search-icon"
          viewBox="0 0 20 20"
          fill="currentColor"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search private tasks..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
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

      {/* Filter Tabs */}
      <div className="todo-filter-container" role="tablist" aria-label="Task Filters">
        {filterTabs.map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`filter-btn ${isActive ? 'active' : ''}`}
              onClick={() => onFilterChange(tab.id)}
              aria-label={`Show ${tab.label} tasks (${tab.count})`}
            >
              <span className="filter-text">{tab.label}</span>
              <span className={`filter-badge ${isActive ? 'badge-active' : ''}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TodoFilter;
