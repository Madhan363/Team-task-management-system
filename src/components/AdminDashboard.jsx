import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import LogoutButton from './LogoutButton';

const ROLE_LABELS = {
  admin: 'Admin',
  team_leader: 'Team Leader',
  team_member: 'Team Member',
  personal: 'Personal Account',
};

function AdminDashboard({ user, theme, onLogout, onPersonalTasks }) {
  const [dashboard, setDashboard] = useState({ users: [], teams: [], tasks: [], stats: null });
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('team_member');
  const [departmentId, setDepartmentId] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [departmentDescription, setDepartmentDescription] = useState('');
  const [departmentLeaderId, setDepartmentLeaderId] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setDashboard(await api.adminDashboard());
  }, []);

  useEffect(() => {
    let active = true;
    api.adminDashboard()
      .then((result) => {
        if (active) {
          setDashboard(result);
          setError('');
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });
    return () => { active = false; };
  }, []);

  const createUser = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.createManagedUser({ name, username, email, password, role, departmentId: departmentId || null });
      setName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('team_member');
      setDepartmentId('');
      await refresh();
      setNotice('Account created.');
    } catch (createError) {
      setError(createError.message);
    } finally {
      setBusy(false);
    }
  };

  const createDepartment = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.createDepartment({
        name: departmentName,
        description: departmentDescription,
        teamLeaderId: departmentLeaderId,
      });
      setDepartmentName('');
      setDepartmentDescription('');
      setDepartmentLeaderId('');
      await refresh();
      setNotice('Department created and Team Leader assigned.');
    } catch (createError) {
      setError(createError.message);
    } finally {
      setBusy(false);
    }
  };

  const updateDepartment = async (departmentIdToUpdate, changes) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.updateDepartment(departmentIdToUpdate, changes);
      await refresh();
      setNotice('Department updated.');
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteDepartment = async (department) => {
    if (!window.confirm(`Delete department "${department.name}"?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.deleteDepartment(department.id);
      await refresh();
      setNotice('Department deleted.');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  };

  const updateUser = async (userId, changes, successMessage) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.updateManagedUser(userId, changes);
      await refresh();
      setNotice(successMessage);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (account) => {
    if (!window.confirm(`Permanently delete ${account.name}'s account and personal tasks? Team ownership and assigned tasks must be reassigned first.`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.deleteManagedUser(account.id);
      await refresh();
      setNotice('Account deleted.');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  };

  const filteredUsers = dashboard.users.filter((account) => {
    const query = userQuery.trim().toLowerCase();
    const matchesQuery = !query || [account.name, account.username, account.email]
      .some((value) => value.toLowerCase().includes(query));
    return matchesQuery
      && (!departmentFilter || account.department?.id === departmentFilter)
      && (!roleFilter || account.role === roleFilter)
      && (!statusFilter || (statusFilter === 'active') === account.isActive);
  });
  const pageSize = 10;
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = filteredUsers.slice((userPage - 1) * pageSize, userPage * pageSize);
  const leaders = dashboard.users.filter((account) => account.role === 'team_leader' && account.isActive);

  return (
    <main className="app-shell app-shell-dashboard" data-theme={theme}>
      <section className="todo-card admin-dashboard" aria-labelledby="admin-title">
        <header className="app-header">
          <div className="account-bar">
            <div className="account-identity">
              <span className="account-avatar" aria-hidden="true">
                {user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <span><strong>{user.name}</strong><small>{user.username}</small></span>
            </div>
            <div className="account-actions">
              <button type="button" className="task-action-button" onClick={onPersonalTasks}>Personal tasks</button>
              <LogoutButton onLogout={onLogout} />
            </div>
          </div>
          <span className="app-eyebrow">SYSTEM MANAGEMENT</span>
          <h1 id="admin-title">Admin Dashboard</h1>
          <p>Manage accounts and roles, and monitor tasks, teams, and progress.</p>
        </header>

        {error && <p className="global-error" role="alert">{error}</p>}
        {notice && <p className="global-notice" role="status">{notice}</p>}

        {dashboard.stats && (
          <section className="admin-stat-grid" aria-label="System summary">
            <div><span>Users</span><strong>{dashboard.stats.users}</strong></div>
            <div><span>Active</span><strong>{dashboard.stats.activeUsers}</strong></div>
            <div><span>Inactive</span><strong>{dashboard.stats.inactiveUsers}</strong></div>
            <div><span>Teams</span><strong>{dashboard.stats.teams}</strong></div>
            <div><span>Departments</span><strong>{dashboard.departments?.length || 0}</strong></div>
            <div><span>Tasks</span><strong>{dashboard.stats.tasks}</strong></div>
            <div><span>Completed</span><strong>{dashboard.stats.completed}</strong></div>
            <div><span>Incomplete</span><strong>{dashboard.stats.incomplete}</strong></div>
            <div><span>Completion</span><strong>{dashboard.stats.completionPercent}%</strong></div>
          </section>
        )}

        {dashboard.stats && (
          <section className="admin-chart-grid" aria-label="System performance charts">
            <article className="admin-panel admin-chart">
              <h2>Active vs inactive users</h2>
              <AdminBar label="Active" value={dashboard.stats.activeUsers} total={dashboard.stats.users} />
              <AdminBar label="Inactive" value={dashboard.stats.inactiveUsers} total={dashboard.stats.users} />
            </article>
            <article className="admin-panel admin-chart">
              <h2>Completed vs incomplete tasks</h2>
              <AdminBar label="Completed" value={dashboard.stats.completed} total={dashboard.stats.tasks} />
              <AdminBar label="Incomplete" value={dashboard.stats.incomplete} total={dashboard.stats.tasks} />
            </article>
            <article className="admin-panel admin-chart">
              <h2>Tasks by department</h2>
              {(dashboard.departments || []).map((department) => (
                <AdminBar key={department.id} label={department.name} value={department.taskCount} total={dashboard.stats.tasks} />
              ))}
              {!dashboard.departments?.length && <p>No department task data.</p>}
            </article>
            <article className="admin-panel admin-chart">
              <h2>Task completion trend · last 7 days</h2>
              {(dashboard.stats.completionTrend || []).map((day) => (
                <AdminBar key={day.date} label={new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })} value={day.completed} total={Math.max(1, ...dashboard.stats.completionTrend.map((entry) => entry.completed))} />
              ))}
            </article>
          </section>
        )}

        <section className="admin-panel">
          <h2>Create account</h2>
          <form className="admin-create-form" onSubmit={createUser}>
            <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
            <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" required /></label>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
            <label>Initial password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={100} required /></label>
            <label>Role
              <select value={role} onChange={(event) => {
                setRole(event.target.value);
                if (event.target.value === 'team_leader') setDepartmentId('');
              }}>
                <option value="team_leader">Team Leader</option>
                <option value="team_member">Team Member</option>
              </select>
            </label>
            <label>Department
              <select value={departmentId} disabled={role === 'team_leader'} onChange={(event) => setDepartmentId(event.target.value)}>
                <option value="">No department</option>
                {(dashboard.departments || []).filter((department) => department.isActive)
                  .map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </label>
            <button type="submit" disabled={busy}>Create account</button>
          </form>
        </section>

        <section className="admin-panel">
          <h2>User accounts</h2>
          <div className="admin-filters">
            <label>Search<input value={userQuery} onChange={(event) => { setUserQuery(event.target.value); setUserPage(1); }} placeholder="Name, username, or email" /></label>
            <label>Department
              <select value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setUserPage(1); }}>
                <option value="">All departments</option>
                {(dashboard.departments || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </label>
            <label>Role
              <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setUserPage(1); }}>
                <option value="">All roles</option>
                {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Status
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setUserPage(1); }}>
                <option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <ul className="admin-user-list">
            {pagedUsers.map((account) => (
              <AdminUserRow
                key={account.id}
                account={account}
                departments={dashboard.departments || []}
                busy={busy}
                onSave={(changes) => updateUser(account.id, changes, 'Account updated.')}
                onDeactivate={() => updateUser(account.id, { isActive: false }, 'Account deactivated.')}
                onReactivate={() => updateUser(account.id, { isActive: true }, 'Account reactivated.')}
                onDelete={() => deleteUser(account)}
                onView={() => api.getManagedUser(account.id)}
              />
            ))}
            {!filteredUsers.length && <li>No accounts match the filters.</li>}
          </ul>
          <div className="admin-pagination">
            <span>{filteredUsers.length} account{filteredUsers.length === 1 ? '' : 's'} · Page {userPage} of {totalUserPages}</span>
            <button type="button" disabled={userPage <= 1} onClick={() => setUserPage((page) => page - 1)}>Previous</button>
            <button type="button" disabled={userPage >= totalUserPages} onClick={() => setUserPage((page) => page + 1)}>Next</button>
          </div>
        </section>

        <section className="admin-panel">
          <h2>Department Manager</h2>
          <div className="admin-department-overview">
            <span>Total departments <strong>{dashboard.departments?.length || 0}</strong></span>
            <span>Total users <strong>{dashboard.users.length}</strong></span>
            <span>Team Leaders <strong>{dashboard.users.filter((account) => account.role === 'team_leader').length}</strong></span>
            <span>Team Members <strong>{dashboard.users.filter((account) => account.role === 'team_member').length}</strong></span>
          </div>
          <form className="admin-create-form" onSubmit={createDepartment}>
            <label>Department name<input value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} maxLength={80} required /></label>
            <label>Description<input value={departmentDescription} onChange={(event) => setDepartmentDescription(event.target.value)} maxLength={500} /></label>
            <label>Assign Team Leader
              <select value={departmentLeaderId} onChange={(event) => setDepartmentLeaderId(event.target.value)} required>
                <option value="">Select a Team Leader</option>
                {leaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.name} ({leader.username})</option>)}
              </select>
            </label>
            <button type="submit" disabled={busy || !leaders.length}>Create department</button>
          </form>
          <ul className="admin-team-list">
            {(dashboard.departments || []).map((department) => (
              <DepartmentRow
                key={department.id}
                department={department}
                leaders={leaders}
                busy={busy}
                onSave={(changes) => updateDepartment(department.id, changes)}
                onDelete={() => deleteDepartment(department)}
                onStatusChange={(isActive) => updateDepartment(department.id, { isActive })}
              />
            ))}
            {!dashboard.departments?.length && <li>No departments found.</li>}
          </ul>
        </section>

        <section className="admin-panel">
          <h2>Teams and progress</h2>
          <ul className="admin-team-list">
            {dashboard.teams.map((team) => (
              <li key={team.id}>
                <strong>{team.name}</strong>
                <span>{team.department?.name || 'No department'} · Leader: {team.owner.name} · {team.memberCount} members</span>
              </li>
            ))}
            {!dashboard.teams.length && <li>No teams found.</li>}
          </ul>
        </section>

        <section className="admin-panel">
          <h2>All tasks</h2>
          <ul className="admin-task-list">
            {dashboard.tasks.map((task) => (
              <li key={`${task.kind}-${task.id}`}>
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.kind === 'team' ? `${task.teamName} · ${task.owner?.name || 'Unknown member'}` : `Personal · ${task.owner.name}`}</small>
                </span>
                <span className="admin-task-status">{task.status.replace('_', ' ')}</span>
                <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</span>
              </li>
            ))}
            {!dashboard.tasks.length && <li>No tasks found.</li>}
          </ul>
        </section>
      </section>
    </main>
  );
}

function AdminBar({ label, value, total }) {
  const percentage = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="admin-chart-row">
      <span>{label}</span>
      <div className="admin-chart-track" role="img" aria-label={`${label}: ${value}`}>
        <span style={{ width: `${percentage}%` }} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function AdminUserRow({ account, departments, busy, onSave, onDeactivate, onReactivate, onDelete, onView }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [username, setUsername] = useState(account.username);
  const [email, setEmail] = useState(account.email);
  const [role, setRole] = useState(account.role);
  const [departmentId, setDepartmentId] = useState(account.department?.id || '');
  const [details, setDetails] = useState(null);

  const save = async (event) => {
    event.preventDefault();
    await onSave({ name, username, email, role, departmentId: departmentId || null });
    setEditing(false);
  };

  return (
    <li className={`admin-user-row${account.isActive ? '' : ' inactive'}`}>
      {editing ? (
        <form className="admin-user-edit" onSubmit={save}>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
          <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" required /></label>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Role
            <select value={role} onChange={(event) => {
              setRole(event.target.value);
              if (event.target.value === 'team_leader') setDepartmentId('');
            }}>
              <option value="team_leader">Team Leader</option>
              <option value="team_member">Team Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>Department
            <select value={departmentId} disabled={role === 'team_leader'} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">No department</option>
              {departments.filter((department) => department.isActive)
                .map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy}>Save</button>
          <button type="button" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
        </form>
      ) : (
        <>
          <div className="admin-user-summary">
            <strong>{account.name}</strong>
            <span className="admin-user-username">{account.username}</span>
            <span className="admin-user-email">{account.email}</span>
            <small>
              {ROLE_LABELS[account.role] || account.role} · {account.isActive ? 'Active' : 'Inactive'}
              {' · '}{account.department?.name || 'No department'}
              {' · '}Personal tasks {account.personalProgress.completed}/{account.personalProgress.total}
              {' · '}Team tasks {account.teamProgress.completed}/{account.teamProgress.total}
            </small>
            {details && <small>{details.personalTasks.length} personal tasks · {details.teamTasks.length} team tasks</small>}
          </div>
          <div className="admin-row-actions">
            <button type="button" onClick={async () => setDetails(await onView())} disabled={busy}>View</button>
            <button type="button" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
            {account.isActive
              ? <button type="button" onClick={onDeactivate} disabled={busy}>Deactivate</button>
              : <button type="button" onClick={onReactivate} disabled={busy}>Reactivate</button>}
            <button type="button" onClick={onDelete} disabled={busy || account.role === 'admin'}>Delete</button>
          </div>
        </>
      )}
    </li>
  );
}

function DepartmentRow({ department, leaders, busy, onSave, onDelete, onStatusChange }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description);
  const [teamLeaderId, setTeamLeaderId] = useState(department.teamLeader.id);

  const save = async (event) => {
    event.preventDefault();
    await onSave({ name, description, teamLeaderId });
    setEditing(false);
  };

  return (
    <li className="admin-department-row">
      {editing ? (
        <form className="admin-user-edit" onSubmit={save}>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
          <label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></label>
          <label>Team Leader
            <select value={teamLeaderId} onChange={(event) => setTeamLeaderId(event.target.value)}>
              {leaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.name}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy}>Save</button>
          <button type="button" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
        </form>
      ) : (
        <>
          <span><strong>{department.name}</strong><small>{department.description || 'No description'} · Leader: {department.teamLeader.name} · {department.userCount} users · {department.isActive ? 'Active' : 'Inactive'}</small></span>
          <div className="admin-row-actions">
            <button type="button" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
            <button type="button" onClick={() => onStatusChange(!department.isActive)} disabled={busy}>
              {department.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button type="button" onClick={onDelete} disabled={busy}>Delete</button>
          </div>
        </>
      )}
    </li>
  );
}

export default AdminDashboard;
