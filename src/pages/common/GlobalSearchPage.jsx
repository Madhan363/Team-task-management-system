import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { loadTaskWorkspace, getTaskAssignee, getTaskDate } from '../../services/taskWorkspace';

function GlobalSearchPage({ role }) {
  const [workspace, setWorkspace] = useState({ tasks: [], users: [], departments: [] });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [dueBefore, setDueBefore] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadTaskWorkspace(role)
      .then((data) => {
        if (active) setWorkspace(data);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Failed to load searchable data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [role]);

  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return workspace.tasks.filter((task) => {
      const assignee = getTaskAssignee(task);
      const searchable = [
        task.title,
        task.description,
        assignee?.name,
        task.assignedBy?.name,
        task.department?.name,
      ].join(' ').toLocaleLowerCase();
      const dueDate = getTaskDate(task.dueDate);
      return (!term || searchable.includes(term))
        && (!status || task.status === status)
        && (!priority || task.priority === priority)
        && (!assigneeId || assignee?.id === assigneeId)
        && (!departmentId || task.department?.id === departmentId)
        && (!dueBefore || (dueDate && dueDate <= new Date(`${dueBefore}T23:59:59`)));
    });
  }, [workspace.tasks, query, status, priority, dueBefore, assigneeId, departmentId]);

  const filteredUsers = workspace.users.filter((user) => {
    const term = query.trim().toLocaleLowerCase();
    return !term || `${user.name || ''} ${user.username || ''} ${user.email || ''}`
      .toLocaleLowerCase().includes(term);
  });
  const filteredDepartments = workspace.departments.filter((department) => (
    !query.trim() || department.name?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ));

  return (
    <div className="tf-page-container">
      <div className="tf-page-header">
        <div>
          <h2>Global Search & Filters</h2>
          <p>Search tasks, people, and departments you are authorized to access.</p>
        </div>
      </div>

      {error && <div className="tf-alert tf-alert-error" role="alert"><AlertCircle size={18} />{error}</div>}

      <section className="tf-card tf-workspace-card">
        <div className="tf-search-box tf-workspace-search">
          <Search size={20} className="tf-search-icon" />
          <input
            className="tf-input tf-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks, employees, departments, projects…"
            aria-label="Search tasks, employees, departments, and projects"
          />
        </div>
        <div className="tf-workspace-filters">
          <label>Status
            <select className="tf-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In progress</option>
              <option value="submitted_review">Submitted for review</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label>Priority
            <select className="tf-select" value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>Due by
            <input className="tf-input" type="date" value={dueBefore} onChange={(event) => setDueBefore(event.target.value)} />
          </label>
          <label>Assigned member
            <select className="tf-select" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">All members</option>
              {workspace.users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </label>
          <label>Department
            <select className="tf-select" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">All departments</option>
              {workspace.departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {role !== 'team_member' && (
        <div className="tf-workspace-result-grid">
          <section className="tf-card">
            <h3>Employees <span className="tf-workspace-count">{filteredUsers.length}</span></h3>
            {filteredUsers.length ? filteredUsers.map((user) => (
              <div className="tf-search-result" key={user.id}>
                <strong>{user.name}</strong>
                <span>{user.email || user.username || ''}</span>
              </div>
            )) : <p className="tf-text-muted">No matching employees.</p>}
          </section>
          <section className="tf-card">
            <h3>Departments <span className="tf-workspace-count">{filteredDepartments.length}</span></h3>
            {filteredDepartments.length ? filteredDepartments.map((department) => (
              <div className="tf-search-result" key={department.id}>
                <strong>{department.name}</strong>
                <span>{department.teamLeader?.name || ''}</span>
              </div>
            )) : <p className="tf-text-muted">No matching departments.</p>}
          </section>
        </div>
      )}

      <section className="tf-card tf-table-card">
        <div className="tf-card-header">
          <h3>Tasks & Projects <span className="tf-workspace-count">{loading ? '…' : results.length}</span></h3>
        </div>
        <div className="tf-table-responsive">
          <table className="tf-table">
            <thead><tr><th>Task / Project</th><th>Assigned Member</th><th>Department</th><th>Status</th><th>Priority</th><th>Deadline</th></tr></thead>
            <tbody>
              {loading ? <tr><td className="tf-table-empty" colSpan={6}>Loading searchable tasks…</td></tr>
                : results.length === 0 ? <tr><td className="tf-table-empty" colSpan={6}>No tasks match these search criteria.</td></tr>
                  : results.map((task) => (
                    <tr key={task.id}>
                      <td><strong>{task.title}</strong></td>
                      <td>{getTaskAssignee(task)?.name || '—'}</td>
                      <td>{task.department?.name || '—'}</td>
                      <td>{task.status?.replaceAll('_', ' ')}</td>
                      <td><span className={`tf-priority-tag tf-priority-${task.priority}`}>{task.priority}</span></td>
                      <td>{getTaskDate(task.dueDate)?.toLocaleDateString() || 'No deadline'}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default GlobalSearchPage;
