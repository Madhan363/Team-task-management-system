import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  CheckCircle,
  XCircle,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UserPlus,
  X,
} from 'lucide-react';
import { api } from '../../api';

function LeaderTeamManagementPage() {
  const [members, setMembers] = useState([]);
  const [departmentName, setDepartmentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [loadingAvailableMembers, setLoadingAvailableMembers] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  const openAddMember = async () => {
    setShowAddMember(true);
    setSelectedMemberId('');
    setAddMemberError('');
    setLoadingAvailableMembers(true);
    try {
      const res = await api.getAvailableTeamMembers();
      setAvailableMembers(res.members || []);
    } catch (err) {
      setAddMemberError(err.message || 'Failed to load available accounts.');
    } finally {
      setLoadingAvailableMembers(false);
    }
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    if (!selectedMemberId) {
      setAddMemberError('Select a team member account to add.');
      return;
    }

    setAddingMember(true);
    setAddMemberError('');
    try {
      await api.addExistingTeamMember(selectedMemberId);
      setShowAddMember(false);
      await loadTeam();
    } catch (err) {
      setAddMemberError(err.message || 'Failed to add the team member.');
    } finally {
      setAddingMember(false);
    }
  };

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getTeamLeaderDashboard();
      setMembers(res.members || []);
      setDepartmentName(res.department?.name || '');
    } catch (err) {
      setError(err.message || 'Failed to load team members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  return (
    <div className="tf-page-container">
      {/* Header */}
      <div className="tf-page-header">
        <div>
          <h2>Team Management</h2>
          <p>
            Department: <strong>{departmentName || 'Your Authorized Team'}</strong> —
            Review workforce status, productivity metrics, and individual contributions.
          </p>
        </div>
        <div className="tf-header-actions">
          <button
            type="button"
            className="tf-btn tf-btn-primary"
            onClick={openAddMember}
          >
            <UserPlus size={16} /> Add Member
          </button>
          <button
            type="button"
            className="tf-btn tf-btn-secondary"
            onClick={loadTeam}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'tf-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="tf-alert tf-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Team Members List Card */}
      <div className="tf-card tf-table-card">
        <div className="tf-card-header tf-table-header-row">
          <div>
            <h3>Authorized Team Members ({members.length})</h3>
            <span className="tf-card-subtitle">
              Assigned directly to your department.
            </span>
          </div>
        </div>

        <div className="tf-table-responsive">
          <table className="tf-table">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Department</th>
                <th>Account Status</th>
                <th>Assigned Tasks</th>
                <th>Completed Tasks</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="tf-table-loading">
                    <RefreshCw size={20} className="tf-spin" />
                    <span>Loading department members…</span>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="tf-table-empty">
                    <p>No team members found in your department.</p>
                    <span>Use Add Member to add an existing unassigned account to your department.</span>
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="tf-table-user-cell">
                        <div className="tf-avatar tf-avatar-sm">
                          <span>{member.name.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <strong>{member.name}</strong>
                      </div>
                    </td>
                    <td>
                      <code>{member.username}</code>
                    </td>
                    <td>{member.email || '—'}</td>
                    <td>
                      <span className="tf-dept-tag">{departmentName || 'Engineering'}</span>
                    </td>
                    <td>
                      {member.isActive ? (
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
                      <span className="tf-counter-badge tf-counter-blue">
                        <ListTodo size={12} /> {member.assignedTasks || 0} tasks
                      </span>
                    </td>
                    <td>
                      <span className="tf-counter-badge tf-counter-green">
                        <CheckCircle2 size={12} /> {member.completedTasks || 0} completed
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showAddMember && (
          <div className="taskflow-modal-overlay" onClick={() => setShowAddMember(false)}>
            <div className="taskflow-modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="taskflow-modal-header">
                <h3>Add Existing Team Member</h3>
                <button
                  type="button"
                  className="tf-icon-action-btn"
                  onClick={() => setShowAddMember(false)}
                  aria-label="Close add member dialog"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleAddMember}>
                <div className="taskflow-modal-body">
                  <p>Select an active Team Member account that is not assigned to a department.</p>
                  {addMemberError && (
                    <div className="tf-alert tf-alert-error" role="alert">
                      <AlertCircle size={18} />
                      <span>{addMemberError}</span>
                    </div>
                  )}
                  <div className="tf-form-group">
                    <label htmlFor="existing-team-member">Available Accounts</label>
                    <select
                      id="existing-team-member"
                      className="tf-select"
                      value={selectedMemberId}
                      onChange={(event) => setSelectedMemberId(event.target.value)}
                      disabled={loadingAvailableMembers || availableMembers.length === 0}
                      required
                    >
                      <option value="">
                        {loadingAvailableMembers ? 'Loading accounts…' : '-- Select Team Member --'}
                      </option>
                      {availableMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.username}){member.email ? ` — ${member.email}` : ''}
                        </option>
                      ))}
                    </select>
                    {!loadingAvailableMembers && availableMembers.length === 0 && !addMemberError && (
                      <span className="tf-form-help">There are no unassigned active Team Member accounts available.</span>
                    )}
                  </div>
                </div>
                <div className="taskflow-modal-actions">
                  <button
                    type="button"
                    className="tf-btn tf-btn-secondary"
                    onClick={() => setShowAddMember(false)}
                    disabled={addingMember}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="tf-btn tf-btn-primary"
                    disabled={addingMember || loadingAvailableMembers || !selectedMemberId}
                  >
                    {addingMember ? 'Adding Member…' : 'Add to Department'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaderTeamManagementPage;
