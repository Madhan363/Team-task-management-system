import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Users,
  Briefcase,
  ShieldCheck,
  PlusCircle,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../api';
import ConfirmModal from '../../components/ConfirmModal';

function AdminDepartmentManagerPage() {
  // Department Creation Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamLeaderId, setTeamLeaderId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formNotice, setFormNotice] = useState('');

  // Department List & Stats
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState({
    totalDepartments: 0,
    totalUsers: 0,
    totalTeamLeaders: 0,
    totalTeamMembers: 0,
  });
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState('');

  // Modals State
  const [viewingDept, setViewingDept] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLeaderId, setEditLeaderId] = useState('');
  const [editStatus, setEditStatus] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editModalError, setEditModalError] = useState('');

  const [deletingDeptId, setDeletingDeptId] = useState(null);
  const [deleteTargetName, setDeleteTargetName] = useState('');

  // Load Departments and Potential Leaders
  const loadData = useCallback(async () => {
    setLoading(true);
    setTableError('');
    try {
      const [deptRes, usersRes] = await Promise.all([
        api.getDepartments(),
        api.getUsers({ limit: 100 }),
      ]);

      setDepartments(deptRes.departments || []);
      if (deptRes.stats) {
        setStats(deptRes.stats);
      }

      // Filter available users with team_leader role (or any active user who can be leader)
      const allUsers = usersRes.users || [];
      const leaders = allUsers.filter((u) => u.isActive && (u.role === 'team_leader' || u.role === 'admin'));
      setTeamLeaders(leaders.length > 0 ? leaders : allUsers.filter((u) => u.isActive));
    } catch (err) {
      setTableError(err.message || 'Failed to load department data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Create Department
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormNotice('');

    if (!name.trim()) {
      setFormError('Please enter a department name.');
      return;
    }
    if (!teamLeaderId) {
      setFormError('Please select a Team Leader to assign to this department.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createDepartment({
        name: name.trim(),
        description: description.trim(),
        teamLeaderId,
      });

      setName('');
      setDescription('');
      setTeamLeaderId('');
      setFormNotice('Department created successfully and Team Leader assigned.');
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to create department.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (dept) => {
    setEditingDept(dept);
    setEditName(dept.name);
    setEditDescription(dept.description || '');
    setEditLeaderId(dept.teamLeader?.id || dept.teamLeader?._id || '');
    setEditStatus(dept.isActive !== false);
    setEditModalError('');
  };

  // Submit Edit Modal
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingDept) return;
    setEditSubmitting(true);
    setEditModalError('');

    try {
      await api.updateDepartment(editingDept.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        teamLeaderId: editLeaderId,
        isActive: editStatus,
      });
      setEditingDept(null);
      loadData();
    } catch (err) {
      setEditModalError(err.message || 'Failed to update department.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Toggle Department Status
  const handleToggleStatus = async (dept) => {
    try {
      const nextStatus = !dept.isActive;
      await api.updateDepartment(dept.id, { isActive: nextStatus });
      loadData();
    } catch (err) {
      setTableError(err.message || 'Failed to change department status.');
    }
  };

  // Delete Department Confirmation
  const confirmDelete = async () => {
    if (!deletingDeptId) return;
    try {
      await api.deleteDepartment(deletingDeptId);
      setDeletingDeptId(null);
      loadData();
    } catch (err) {
      setTableError(err.message || 'Failed to delete department.');
      setDeletingDeptId(null);
    }
  };

  return (
    <div className="tf-page-container">
      {/* Page Header */}
      <div className="tf-page-header">
        <div>
          <h2>Department Management</h2>
          <p>Organize teams, assign department leaders, and structure workforce allocation.</p>
        </div>
      </div>

      {/* TOP: Department Overview Stats */}
      <div className="tf-stats-grid tf-dept-stats">
        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-purple">
            <Building2 size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Total Departments</span>
            <strong className="tf-stat-value">{stats.totalDepartments}</strong>
            <span className="tf-stat-hint">Active units</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-blue">
            <Users size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Total Users</span>
            <strong className="tf-stat-value">{stats.totalUsers}</strong>
            <span className="tf-stat-hint">Workforce total</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-emerald">
            <ShieldCheck size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Total Team Leaders</span>
            <strong className="tf-stat-value">{stats.totalTeamLeaders}</strong>
            <span className="tf-stat-hint">Management accounts</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-cyan">
            <Briefcase size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Total Team Members</span>
            <strong className="tf-stat-value">{stats.totalTeamMembers}</strong>
            <span className="tf-stat-hint">Assigned contributors</span>
          </div>
        </div>
      </div>

      {/* Create Department Form Card */}
      <div className="tf-card tf-form-card">
        <div className="tf-card-header">
          <div className="tf-card-title-row">
            <PlusCircle size={20} className="tf-accent-icon" />
            <h3>Create New Department</h3>
          </div>
          <span className="tf-card-subtitle">
            Define department name and appoint an authorized Team Leader.
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

        <form onSubmit={handleCreate} className="tf-grid-form">
          <div className="tf-form-group">
            <label htmlFor="dept-name">Department Name *</label>
            <input
              id="dept-name"
              type="text"
              className="tf-input"
              placeholder="e.g. Mobile Application Engineering"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="dept-leader">Assign Team Leader *</label>
            <select
              id="dept-leader"
              className="tf-select"
              value={teamLeaderId}
              onChange={(e) => setTeamLeaderId(e.target.value)}
              required
            >
              <option value="">-- Select Team Leader --</option>
              {teamLeaders.map((leader) => (
                <option key={leader.id} value={leader.id}>
                  {leader.name} ({leader.username})
                </option>
              ))}
            </select>
          </div>

          <div className="tf-form-group tf-full-width">
            <label htmlFor="dept-desc">Department Description</label>
            <textarea
              id="dept-desc"
              className="tf-textarea"
              rows={2}
              placeholder="Brief overview of department scope, goals, and responsibilities…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="tf-form-actions-bottom">
            <button
              type="submit"
              className="tf-btn tf-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating Department…' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>

      {/* Departments List Table Card */}
      <div className="tf-card tf-table-card">
        <div className="tf-card-header tf-table-header-row">
          <div>
            <h3>Departments Overview ({departments.length})</h3>
            <span className="tf-card-subtitle">
              Manage status, view assigned user counts, or reconfigure leadership.
            </span>
          </div>
          <button
            type="button"
            className="tf-btn tf-btn-secondary tf-btn-sm"
            onClick={loadData}
          >
            <RefreshCw size={14} className={loading ? 'tf-spin' : ''} /> Refresh
          </button>
        </div>

        {tableError && (
          <div className="tf-alert tf-alert-error" role="alert">
            <AlertCircle size={18} />
            <span>{tableError}</span>
          </div>
        )}

        <div className="tf-table-responsive">
          <table className="tf-table">
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Description</th>
                <th>Assigned Team Leader</th>
                <th>Total Users</th>
                <th>Department Status</th>
                <th className="tf-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="tf-table-loading">
                    <RefreshCw size={20} className="tf-spin" />
                    <span>Loading departments from database…</span>
                  </td>
                </tr>
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tf-table-empty">
                    <p>No departments created yet.</p>
                    <span>Use the form above to establish your first department.</span>
                  </td>
                </tr>
              ) : (
                departments.map((dept) => {
                  const isDeptActive = dept.isActive !== false;
                  return (
                    <tr key={dept.id}>
                      <td>
                        <div className="tf-dept-name-cell">
                          <Building2 size={18} className="tf-dept-icon" />
                          <strong>{dept.name}</strong>
                        </div>
                      </td>
                      <td>
                        <p className="tf-table-desc-text">
                          {dept.description || <span className="tf-text-muted">No description</span>}
                        </p>
                      </td>
                      <td>
                        {dept.teamLeader ? (
                          <div className="tf-leader-badge">
                            <strong>{dept.teamLeader.name}</strong>
                            <span className="tf-subtext">{dept.teamLeader.username}</span>
                          </div>
                        ) : (
                          <span className="tf-badge tf-badge-amber">Unassigned</span>
                        )}
                      </td>
                      <td>
                        <span className="tf-counter-badge">
                          <Users size={12} /> {dept.userCount || 0} users
                        </span>
                      </td>
                      <td>
                        {isDeptActive ? (
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
                            onClick={() => setViewingDept(dept)}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            className="tf-icon-action-btn"
                            title="Edit department"
                            onClick={() => openEditModal(dept)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className={`tf-icon-action-btn ${isDeptActive ? 'tf-btn-warn' : 'tf-btn-success'}`}
                            title={isDeptActive ? 'Deactivate department' : 'Activate department'}
                            onClick={() => handleToggleStatus(dept)}
                          >
                            {isDeptActive ? <XCircle size={16} /> : <CheckCircle size={16} />}
                          </button>
                          <button
                            type="button"
                            className="tf-icon-action-btn tf-btn-danger"
                            title="Delete department"
                            onClick={() => {
                              setDeletingDeptId(dept.id);
                              setDeleteTargetName(dept.name);
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
      </div>

      {/* VIEW DETAILS MODAL */}
      {viewingDept && (
        <div className="taskflow-modal-overlay" onClick={() => setViewingDept(null)}>
          <div className="taskflow-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="taskflow-modal-header">
              <h3>Department Details: {viewingDept.name}</h3>
            </div>
            <div className="taskflow-modal-body">
              <div className="tf-modal-details-grid">
                <div>
                  <label>Department Name</label>
                  <span>{viewingDept.name}</span>
                </div>
                <div>
                  <label>Team Leader</label>
                  <span>{viewingDept.teamLeader?.name || 'Unassigned'}</span>
                </div>
                <div>
                  <label>Status</label>
                  <span className={viewingDept.isActive ? 'tf-badge-green' : 'tf-badge-red'}>
                    {viewingDept.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div>
                  <label>Assigned Users</label>
                  <span>{viewingDept.userCount || 0} members</span>
                </div>
                <div className="tf-full-width">
                  <label>Description</label>
                  <p>{viewingDept.description || 'No description provided.'}</p>
                </div>
              </div>
            </div>
            <div className="taskflow-modal-actions">
              <button
                type="button"
                className="tf-btn tf-btn-secondary"
                onClick={() => setViewingDept(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingDept && (
        <div className="taskflow-modal-overlay" onClick={() => setEditingDept(null)}>
          <div className="taskflow-modal-card tf-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="taskflow-modal-header">
              <h3>Edit Department: {editingDept.name}</h3>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="taskflow-modal-body">
                {editModalError && (
                  <div className="tf-alert tf-alert-error" role="alert">
                    <AlertCircle size={18} />
                    <span>{editModalError}</span>
                  </div>
                )}
                <div className="tf-grid-form">
                  <div className="tf-form-group">
                    <label>Department Name</label>
                    <input
                      type="text"
                      className="tf-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="tf-form-group">
                    <label>Assigned Team Leader</label>
                    <select
                      className="tf-select"
                      value={editLeaderId}
                      onChange={(e) => setEditLeaderId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Team Leader --</option>
                      {teamLeaders.map((leader) => (
                        <option key={leader.id} value={leader.id}>
                          {leader.name} ({leader.username})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="tf-form-group">
                    <label>Status</label>
                    <select
                      className="tf-select"
                      value={editStatus ? 'true' : 'false'}
                      onChange={(e) => setEditStatus(e.target.value === 'true')}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                  <div className="tf-form-group tf-full-width">
                    <label>Description</label>
                    <textarea
                      className="tf-textarea"
                      rows={3}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="taskflow-modal-actions">
                <button
                  type="button"
                  className="tf-btn tf-btn-secondary"
                  onClick={() => setEditingDept(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tf-btn tf-btn-primary"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Saving…' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={Boolean(deletingDeptId)}
        title="Delete Department"
        message={`Deleting "${deleteTargetName}" will not delete any user accounts, and is blocked while users or active tasks remain assigned. To keep this department and replace its Team Leader, cancel and use Edit Department to select another leader.`}
        confirmText="Yes, Delete Department"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingDeptId(null)}
      />
    </div>
  );
}

export default AdminDepartmentManagerPage;
