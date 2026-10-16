import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  Eye,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { api } from '../../api';
import ConfirmModal from '../../components/ConfirmModal';

function AdminUserManagerPage() {
  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [role, setRole] = useState('team_member');
  const [isActive, setIsActive] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formNotice, setFormNotice] = useState('');

  // Table & Filters State
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState('');

  // Modals State
  const [viewingUser, setViewingUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('team_member');
  const [editDeptId, setEditDeptId] = useState('');
  const [editStatus, setEditStatus] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editModalError, setEditModalError] = useState('');

  const [deletingUserId, setDeletingUserId] = useState(null);
  const [deleteTargetName, setDeleteTargetName] = useState('');

  // Fetch departments for dropdown
  const loadDepartments = useCallback(async () => {
    try {
      const res = await api.getDepartments();
      setDepartments(res.departments || []);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  }, []);

  // Fetch users with filters
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setTableError('');
    try {
      const res = await api.getUsers({
        search,
        department: selectedDept,
        role: selectedRole,
        status: selectedStatus,
        page,
        limit: 8,
      });
      setUsers(res.users || []);
      setTotalPages(res.totalPages || 1);
      setTotalUsers(res.total || 0);
    } catch (err) {
      setTableError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedDept, selectedRole, selectedStatus, page]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Handle Create User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormNotice('');

    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      setFormError('Please fill in all required user fields.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    setFormSubmitting(true);
    try {
      await api.createUser({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        departmentId: departmentId || null,
        role,
        isActive,
      });

      setName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setDepartmentId('');
      setRole('team_member');
      setIsActive(true);
      setFormNotice('User account created successfully.');

      // Refresh list
      loadUsers();
    } catch (err) {
      setFormError(err.message || 'Failed to create user.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const openEditPage = (u) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditUsername(u.username);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditDeptId(u.department?.id || u.departmentId || '');
    setEditStatus(u.isActive !== false);
    setEditPassword('');
    setEditModalError('');
  };

  // Submit user edits
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSubmitting(true);
    setEditModalError('');

    try {
      const payload = {
        name: editName.trim(),
        username: editUsername.trim().toLowerCase(),
        email: editEmail.trim().toLowerCase(),
        role: editRole,
        departmentId: editDeptId || null,
        isActive: editStatus,
      };
      if (editPassword) payload.password = editPassword;

      await api.updateUser(editingUser.id, payload);
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      setEditModalError(err.message || 'Failed to update user.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Toggle User Active / Inactive
  const handleToggleStatus = async (userToToggle) => {
    try {
      const nextStatus = !userToToggle.isActive;
      await api.toggleUserStatus(userToToggle.id, nextStatus);
      loadUsers();
    } catch (err) {
      setTableError(err.message || 'Failed to change user status.');
    }
  };

  // Delete User Confirmation
  const confirmDeleteUser = async () => {
    if (!deletingUserId) return;
    try {
      await api.deleteUser(deletingUserId);
      setDeletingUserId(null);
      loadUsers();
    } catch (err) {
      setTableError(err.message || 'Failed to delete user.');
      setDeletingUserId(null);
    }
  };

  if (editingUser) {
    return (
      <div className="tf-page-container">
        <div className="tf-page-header">
          <div>
            <h2>Edit User</h2>
            <p>Update account details and access settings for {editingUser.name}.</p>
          </div>
          <button type="button" className="tf-btn tf-btn-secondary" onClick={() => setEditingUser(null)} disabled={editSubmitting}>
            Back to users
          </button>
        </div>
        <section className="tf-card tf-form-card">
          {editModalError && (
            <div className="tf-alert tf-alert-error" role="alert">
              <AlertCircle size={18} />
              <span>{editModalError}</span>
            </div>
          )}
          <form onSubmit={handleEditSubmit} className="tf-grid-form">
            <div className="tf-form-group">
              <label htmlFor="edit-user-name">Full Name</label>
              <input id="edit-user-name" type="text" className="tf-input" value={editName} onChange={(event) => setEditName(event.target.value)} required />
            </div>
            <div className="tf-form-group">
              <label htmlFor="edit-user-username">Username</label>
              <input id="edit-user-username" type="text" className="tf-input" value={editUsername} onChange={(event) => setEditUsername(event.target.value)} required />
            </div>
            <div className="tf-form-group">
              <label htmlFor="edit-user-email">Email</label>
              <input id="edit-user-email" type="email" className="tf-input" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} required />
            </div>
            <div className="tf-form-group">
              <label htmlFor="edit-user-department">Department</label>
              <select id="edit-user-department" className="tf-select" value={editDeptId} onChange={(event) => setEditDeptId(event.target.value)}>
                <option value="">-- None --</option>
                {departments.map((department) => (
                  <option key={department.id || department._id} value={department.id || department._id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="tf-form-group">
              <label htmlFor="edit-user-role">Role</label>
              <select id="edit-user-role" className="tf-select" value={editRole} onChange={(event) => setEditRole(event.target.value)}>
                <option value="team_member">Team Member</option>
                <option value="team_leader">Team Leader</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="tf-form-group">
              <label htmlFor="edit-user-status">Status</label>
              <select id="edit-user-status" className="tf-select" value={editStatus ? 'true' : 'false'} onChange={(event) => setEditStatus(event.target.value === 'true')}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="tf-form-group tf-full-width">
              <label htmlFor="edit-user-password">Reset Password (leave empty to keep current)</label>
              <input id="edit-user-password" type="password" className="tf-input" placeholder="Enter new password or leave blank" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} />
            </div>
            <div className="tf-form-actions-bottom tf-full-width">
              <button type="button" className="tf-btn tf-btn-secondary" onClick={() => setEditingUser(null)} disabled={editSubmitting}>
                Cancel
              </button>
              <button type="submit" className="tf-btn tf-btn-primary" disabled={editSubmitting}>
                {editSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  if (viewingUser) {
    const isViewingUserActive = viewingUser.isActive !== false;
    return (
      <div className="tf-page-container">
        <div className="tf-page-header">
          <div>
            <h2>User Profile Details</h2>
            <p>Review this account’s details and status.</p>
          </div>
          <button type="button" className="tf-btn tf-btn-secondary" onClick={() => setViewingUser(null)}>
            Back to users
          </button>
        </div>
        <section className="tf-card tf-form-card">
          <div className="tf-card-header">
            <div className="tf-card-title-row">
              <div className="tf-avatar tf-avatar-lg">
                {viewingUser.profileImage ? (
                  <img src={viewingUser.profileImage} alt={viewingUser.name} />
                ) : (
                  <span>{viewingUser.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <h3>{viewingUser.name}</h3>
                <code>{viewingUser.username}</code>
              </div>
            </div>
          </div>
          <div className="tf-modal-details-grid">
            <div><label>Email</label><span>{viewingUser.email}</span></div>
            <div><label>Username</label><span>{viewingUser.username}</span></div>
            <div><label>Role</label><span className="tf-capitalize">{viewingUser.role?.replace('_', ' ')}</span></div>
            <div><label>Department</label><span>{viewingUser.department?.name || 'Unassigned'}</span></div>
            <div>
              <label>Status</label>
              <span className={isViewingUserActive ? 'tf-badge-green' : 'tf-badge-red'}>
                {isViewingUserActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div>
              <label>Account Created</label>
              <span>{viewingUser.createdAt ? new Date(viewingUser.createdAt).toLocaleDateString() : '—'}</span>
            </div>
          </div>
          <div className="tf-form-actions-bottom">
            <button
              type="button"
              className="tf-btn tf-btn-primary"
              onClick={() => {
                openEditPage(viewingUser);
                setViewingUser(null);
              }}
            >
              <Edit2 size={16} /> Edit User
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="tf-page-container">
      {/* Page Header */}
      <div className="tf-page-header">
        <div>
          <h2>User Management</h2>
          <p>Create, inspect, configure roles, and administer system accounts.</p>
        </div>
      </div>

      {/* TOP: Create User Form Card */}
      <div className="tf-card tf-form-card">
        <div className="tf-card-header">
          <div className="tf-card-title-row">
            <UserPlus size={20} className="tf-accent-icon" />
            <h3>Create New User</h3>
          </div>
          <span className="tf-card-subtitle">
            Assign role and department credentials directly to MongoDB.
          </span>
        </div>

        {formError && (
          <div className="tf-alert tf-alert-error" role="alert">
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}
        {formNotice && (
          <div className="tf-alert tf-alert-success" role="status">
            <span>{formNotice}</span>
          </div>
        )}

        <form onSubmit={handleCreateUser} className="tf-grid-form">
          <div className="tf-form-group">
            <label htmlFor="create-name">Full Name *</label>
            <input
              id="create-name"
              type="text"
              className="tf-input"
              placeholder="e.g. Rachel Zane"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="create-username">Username *</label>
            <input
              id="create-username"
              type="text"
              className="tf-input"
              placeholder="e.g. rachel_zane"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="create-email">Email Address *</label>
            <input
              id="create-email"
              type="email"
              className="tf-input"
              placeholder="rachel@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="create-password">Temporary Password *</label>
            <input
              id="create-password"
              type="password"
              className="tf-input"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="create-department">Department</label>
            <select
              id="create-department"
              className="tf-select"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">-- No Department Assigned --</option>
              {departments.map((dept) => (
                <option key={dept.id || dept._id} value={dept.id || dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="tf-form-group">
            <label htmlFor="create-role">System Role *</label>
            <select
              id="create-role"
              className="tf-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="team_member">Team Member</option>
              <option value="team_leader">Team Leader</option>
            </select>
          </div>

          <div className="tf-form-group">
            <label htmlFor="create-status">Account Status</label>
            <select
              id="create-status"
              className="tf-select"
              value={isActive ? 'true' : 'false'}
              onChange={(e) => setIsActive(e.target.value === 'true')}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div className="tf-form-actions-bottom">
            <button
              type="submit"
              className="tf-btn tf-btn-primary"
              disabled={formSubmitting}
            >
              {formSubmitting ? (
                'Saving User…'
              ) : (
                <>
                  <UserPlus size={16} /> Create User Account
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* BOTTOM: Users List Section */}
      <div className="tf-card tf-table-card">
        <div className="tf-card-header tf-table-header-row">
          <div>
            <h3>All Registered Users ({totalUsers})</h3>
            <span className="tf-card-subtitle">
              Filter by department, role, or status and manage account states.
            </span>
          </div>
          <button
            type="button"
            className="tf-btn tf-btn-secondary tf-btn-sm"
            onClick={loadUsers}
            title="Refresh table"
          >
            <RefreshCw size={14} className={loading ? 'tf-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Search & Filters Bar */}
        <div className="tf-filter-bar">
          <div className="tf-search-box tf-admin-users-search">
            <Search size={20} className="tf-search-icon" />
            <input
              type="text"
              className="tf-input tf-search-input"
              placeholder="Search by name, username, or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="tf-filter-group">
            <select
              className="tf-select tf-filter-select"
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id || dept._id} value={dept.id || dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>

            <select
              className="tf-select tf-filter-select"
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="team_leader">Team Leader</option>
              <option value="team_member">Team Member</option>
            </select>

            <select
              className="tf-select tf-filter-select"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {tableError && (
          <div className="tf-alert tf-alert-error" role="alert">
            <AlertCircle size={18} />
            <span>{tableError}</span>
          </div>
        )}

        {/* Users Table */}
        <div className="tf-table-responsive">
          <table className="tf-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Username</th>
                <th>Department</th>
                <th>Role</th>
                <th>Status</th>
                <th className="tf-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="tf-table-loading">
                    <RefreshCw size={20} className="tf-spin" />
                    <span>Loading users from database…</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tf-table-empty">
                    <p>No matching users found.</p>
                    <span>Try clearing your search terms or filters.</span>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isUserActive = u.isActive !== false;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="tf-table-user-cell">
                          <div className="tf-avatar tf-avatar-sm">
                            {u.profileImage ? (
                              <img src={u.profileImage} alt={u.name} />
                            ) : (
                              <span>{u.name.slice(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <button type="button" className="tf-btn-link" onClick={() => setViewingUser(u)}>
                              {u.name}
                            </button>
                            <span className="tf-subtext">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <button type="button" className="tf-btn-link" onClick={() => setViewingUser(u)}>
                          {u.username}
                        </button>
                      </td>
                      <td>
                        {u.department?.name ? (
                          <span className="tf-dept-tag">{u.department.name}</span>
                        ) : (
                          <span className="tf-text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {u.role === 'admin' ? (
                          <span className="tf-badge tf-badge-purple">
                            <Shield size={12} /> Admin
                          </span>
                        ) : u.role === 'team_leader' ? (
                          <span className="tf-badge tf-badge-blue">Team Leader</span>
                        ) : (
                          <span className="tf-badge tf-badge-gray">Team Member</span>
                        )}
                      </td>
                      <td>
                        {isUserActive ? (
                          <span className="tf-badge tf-badge-green">
                            <CheckCircle size={12} /> Active
                          </span>
                        ) : (
                          <span className="tf-badge tf-badge-red">
                            <XCircle size={12} /> Inactive
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="tf-action-buttons">
                          <button
                            type="button"
                            className="tf-icon-action-btn"
                            title="View details"
                            onClick={() => setViewingUser(u)}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            className="tf-icon-action-btn"
                            title="Edit user"
                            onClick={() => openEditPage(u)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className={`tf-icon-action-btn ${isUserActive ? 'tf-btn-warn' : 'tf-btn-success'}`}
                            title={isUserActive ? 'Deactivate account' : 'Activate account'}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {isUserActive ? <XCircle size={16} /> : <CheckCircle size={16} />}
                          </button>
                          <button
                            type="button"
                            className="tf-icon-action-btn tf-btn-danger"
                            title="Delete user"
                            onClick={() => {
                              setDeletingUserId(u.id);
                              setDeleteTargetName(u.name);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="tf-pagination-bar">
            <span className="tf-pagination-info">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="tf-pagination-controls">
              <button
                type="button"
                className="tf-btn tf-btn-secondary tf-btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <button
                type="button"
                className="tf-btn tf-btn-secondary tf-btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={Boolean(deletingUserId)}
        title="Delete User Account"
        message={`Are you sure you want to delete user "${deleteTargetName}"? This action cannot be undone.`}
        confirmText="Yes, Delete User"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmDeleteUser}
        onCancel={() => setDeletingUserId(null)}
      />
    </div>
  );
}

export default AdminUserManagerPage;
