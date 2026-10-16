import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  ListTodo,
  User as UserIcon,
  Building2,
  FolderGit2,
  ArrowRight,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api';

function GlobalSearchTopbar({ role, onSelectTab }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState({ tasks: [], users: [], departments: [], projects: [] });
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const searchSequenceRef = useRef(0);

  // Flattened array of results for keyboard arrow navigation
  const flatItems = [
    ...results.tasks.map((item) => ({ ...item, category: 'task' })),
    ...results.users.map((item) => ({ ...item, category: 'user' })),
    ...results.departments.map((item) => ({ ...item, category: 'department' })),
    ...results.projects.map((item) => ({ ...item, category: 'project' })),
  ];

  // Debounced API search
  const performSearch = useCallback(async (searchTerm, requestSequence) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setResults({ tasks: [], users: [], departments: [], projects: [] });
      setTotalCount(0);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.searchGlobal(trimmed, { limit: 5 });
      if (requestSequence !== searchSequenceRef.current) return;
      setResults(response.results || { tasks: [], users: [], departments: [], projects: [] });
      setTotalCount(response.totalCount || 0);
      setSelectedIndex(-1);
    } catch (err) {
      if (requestSequence !== searchSequenceRef.current) return;
      console.error('Global search error:', err);
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      if (requestSequence === searchSequenceRef.current) setLoading(false);
    }
  }, []);

  // Handle input change with 250ms debounce
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);
    setSelectedIndex(-1);
    setError('');
    const requestSequence = ++searchSequenceRef.current;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value.trim()) {
      setResults({ tasks: [], users: [], departments: [], projects: [] });
      setTotalCount(0);
      setLoading(false);
      setError('');
      return;
    }

    setResults({ tasks: [], users: [], departments: [], projects: [] });
    setTotalCount(0);
    setLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      performSearch(value, requestSequence);
    }, 250);
  };

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    searchSequenceRef.current += 1;
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen || flatItems.length === 0) {
      if (e.key === 'Enter') {
        handleViewAll(e);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flatItems.length) {
        handleSelectItem(flatItems[selectedIndex]);
      } else {
        handleViewAll(e);
      }
    }
  };

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleClear = () => {
    searchSequenceRef.current += 1;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setQuery('');
    setResults({ tasks: [], users: [], departments: [], projects: [] });
    setTotalCount(0);
    setError('');
    setLoading(false);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleSelectItem = (item) => {
    setIsOpen(false);
    setQuery('');

    switch (item.category) {
      case 'task':
        onSelectTab?.('tasks');
        break;
      case 'user':
        if (role === 'admin') {
          onSelectTab?.('users');
        } else if (role === 'team_leader') {
          onSelectTab?.('team');
        } else {
          onSelectTab?.('search');
        }
        break;
      case 'department':
        if (role === 'admin') {
          onSelectTab?.('departments');
        } else {
          onSelectTab?.('search');
        }
        break;
      case 'project':
        if (role === 'admin' || role === 'team_leader') {
          onSelectTab?.('team');
        } else {
          onSelectTab?.('tasks');
        }
        break;
      default:
        onSelectTab?.('search');
    }
  };

  const handleViewAll = (e) => {
    e?.preventDefault();
    setIsOpen(false);
    onSelectTab?.('search');
  };

  const hasAnyResults = totalCount > 0;
  let currentIndexTracker = 0;

  return (
    <div className="tf-topbar-search-container" ref={containerRef}>
      <div className={`tf-topbar-search-box ${isOpen ? 'focused' : ''}`}>
        <Search size={16} className="tf-topbar-search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          className="tf-topbar-search-input"
          placeholder="Search tasks, users, departments…"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          aria-label="Search tasks, users, departments, and projects"
          aria-expanded={isOpen}
          role="combobox"
          aria-autocomplete="list"
          aria-controls="tf-topbar-search-results"
          aria-activedescendant={selectedIndex >= 0 ? `tf-global-search-option-${selectedIndex}` : undefined}
          aria-busy={loading}
        />

        {loading && (
          <Loader2 size={15} className="tf-topbar-search-spinner tf-spin" />
        )}

        {query && (
          <button
            type="button"
            className="tf-topbar-search-clear"
            onClick={handleClear}
            title="Clear search"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}

      </div>

      {/* Auto-suggest Results Dropdown */}
      {isOpen && query.trim() && (
        <div id="tf-topbar-search-results" className="tf-topbar-search-dropdown" role="listbox">
          {error && (
            <div className="tf-search-dropdown-error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {loading && !hasAnyResults && !error && (
            <div className="tf-search-dropdown-loading">
              <Loader2 size={16} className="tf-spin" />
              <span>Searching across workspace…</span>
            </div>
          )}

          {!loading && !hasAnyResults && !error && (
            <div className="tf-search-dropdown-empty">
              <span>No results matching <strong>"{query}"</strong>.</span>
              <button
                type="button"
                className="tf-btn tf-btn-sm tf-btn-secondary"
                onClick={handleViewAll}
              >
                Open Full Search & Filter View
              </button>
            </div>
          )}

          {hasAnyResults && (
            <div className="tf-search-dropdown-sections">
              {/* 1. TASKS */}
              {results.tasks.length > 0 && (
                <div className="tf-search-dropdown-group">
                  <div className="tf-search-group-title">
                    <ListTodo size={13} />
                    <span>Tasks ({results.tasks.length})</span>
                  </div>
                  <ul className="tf-search-dropdown-list">
                    {results.tasks.map((task) => {
                      const itemIndex = currentIndexTracker++;
                      const isSelected = selectedIndex === itemIndex;
                      const isDone = task.status === 'completed';
                      return (
                        <li
                          key={`task-${task.id}`}
                          id={`tf-global-search-option-${itemIndex}`}
                          className={`tf-search-dropdown-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectItem({ ...task, category: 'task' })}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="tf-search-item-left">
                            {isDone ? (
                              <CheckCircle2 size={15} className="tf-text-success" />
                            ) : (
                              <Clock size={15} className="tf-text-muted" />
                            )}
                            <div className="tf-search-item-info">
                              <strong className="tf-search-item-title">{task.title}</strong>
                              <small className="tf-search-item-meta">
                                {task.department?.name ? `${task.department.name} · ` : ''}
                                {task.assignee?.name ? `Assignee: ${task.assignee.name} · ` : ''}
                                {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}
                              </small>
                            </div>
                          </div>
                          <div className="tf-search-item-badges">
                            <span className={`tf-badge tf-badge-${task.priority || 'medium'}`}>
                              {task.priority || 'medium'}
                            </span>
                            <span className={`tf-badge tf-status-badge status-${task.status || 'assigned'}`}>
                              {(task.status || 'assigned').replace('_', ' ')}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* 2. USERS */}
              {results.users.length > 0 && (
                <div className="tf-search-dropdown-group">
                  <div className="tf-search-group-title">
                    <UserIcon size={13} />
                    <span>Users ({results.users.length})</span>
                  </div>
                  <ul className="tf-search-dropdown-list">
                    {results.users.map((u) => {
                      const itemIndex = currentIndexTracker++;
                      const isSelected = selectedIndex === itemIndex;
                      return (
                        <li
                          key={`user-${u.id}`}
                          id={`tf-global-search-option-${itemIndex}`}
                          className={`tf-search-dropdown-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectItem({ ...u, category: 'user' })}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="tf-search-item-left">
                            <span className="tf-search-avatar">
                              {(u.name || u.username || 'U').slice(0, 2).toUpperCase()}
                            </span>
                            <div className="tf-search-item-info">
                              <strong className="tf-search-item-title">{u.name}</strong>
                              <small className="tf-search-item-meta">
                                @{u.username} · {u.email}
                                {u.department?.name ? ` · ${u.department.name}` : ''}
                              </small>
                            </div>
                          </div>
                          <span className="tf-role-badge">
                            {(u.role || 'member').replace('_', ' ')}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* 3. DEPARTMENTS */}
              {results.departments.length > 0 && (
                <div className="tf-search-dropdown-group">
                  <div className="tf-search-group-title">
                    <Building2 size={13} />
                    <span>Departments ({results.departments.length})</span>
                  </div>
                  <ul className="tf-search-dropdown-list">
                    {results.departments.map((dept) => {
                      const itemIndex = currentIndexTracker++;
                      const isSelected = selectedIndex === itemIndex;
                      return (
                        <li
                          key={`dept-${dept.id}`}
                          id={`tf-global-search-option-${itemIndex}`}
                          className={`tf-search-dropdown-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectItem({ ...dept, category: 'department' })}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="tf-search-item-left">
                            <Building2 size={16} className="tf-text-primary" />
                            <div className="tf-search-item-info">
                              <strong className="tf-search-item-title">{dept.name}</strong>
                              <small className="tf-search-item-meta">
                                {dept.teamLeader?.name ? `Leader: ${dept.teamLeader.name} · ` : ''}
                                {dept.description ? dept.description.slice(0, 60) : 'Department organization'}
                              </small>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* 4. PROJECTS / TEAMS */}
              {results.projects.length > 0 && (
                <div className="tf-search-dropdown-group">
                  <div className="tf-search-group-title">
                    <FolderGit2 size={13} />
                    <span>Projects ({results.projects.length})</span>
                  </div>
                  <ul className="tf-search-dropdown-list">
                    {results.projects.map((project) => {
                      const itemIndex = currentIndexTracker++;
                      const isSelected = selectedIndex === itemIndex;
                      return (
                        <li
                          key={`proj-${project.id}`}
                          id={`tf-global-search-option-${itemIndex}`}
                          className={`tf-search-dropdown-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectItem({ ...project, category: 'project' })}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="tf-search-item-left">
                            <FolderGit2 size={16} className="tf-text-amber" />
                            <div className="tf-search-item-info">
                              <strong className="tf-search-item-title">{project.name}</strong>
                              <small className="tf-search-item-meta">
                                {project.department?.name ? `${project.department.name} · ` : ''}
                                {project.memberCount} member{project.memberCount === 1 ? '' : 's'}
                              </small>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Footer View All Link */}
          <div className="tf-search-dropdown-footer">
            <button
              type="button"
              className="tf-search-view-all-btn"
              onClick={handleViewAll}
            >
              <span>View all results in Global Search</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GlobalSearchTopbar;
