import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../api';

const PAGE_SIZE = 25;
const ACTION_LABELS = {
  'user.created': 'User created',
  'user.updated': 'User updated',
  'user.activated': 'User activated',
  'user.deactivated': 'User deactivated',
  'user.deleted': 'User deleted',
  'department.created': 'Department created',
  'department.updated': 'Department updated',
  'department.deleted': 'Department deleted',
  'task.created': 'Task created',
  'task.acknowledged': 'Task acknowledged',
  'task.submitted': 'Task submitted',
  'task.review.approved': 'Task approved',
  'task.review.changes_requested': 'Task changes requested',
  'task.comment.added': 'Task comment added',
  'task.updated': 'Task updated',
  'task.deleted': 'Task deleted',
};

function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.getAuditLogs({ page, limit: PAGE_SIZE, ...(action ? { action } : {}) })
      .then((result) => {
        if (!active) return;
        setLogs(result.logs || []);
        setTotal(result.total || 0);
        setTotalPages(result.totalPages || 1);
        setError('');
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Failed to load audit logs.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [action, page]);

  const refresh = () => {
    setLoading(true);
    setError('');
    api.getAuditLogs({ page, limit: PAGE_SIZE, ...(action ? { action } : {}) })
      .then((result) => {
        setLogs(result.logs || []);
        setTotal(result.total || 0);
        setTotalPages(result.totalPages || 1);
      })
      .catch((requestError) => setError(requestError.message || 'Failed to load audit logs.'))
      .finally(() => setLoading(false));
  };

  return (
    <div className="tf-page-container">
      <div className="tf-page-header">
        <div>
          <h2>Audit Logs</h2>
          <p>Review recorded administrative and task workflow actions.</p>
        </div>
        <button type="button" className="tf-btn tf-btn-secondary" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'tf-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="tf-alert tf-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="tf-card tf-table-card">
        <div className="tf-filter-bar tf-audit-filter-bar">
          <label className="tf-filter-group">
            <span>Action</span>
            <select
              className="tf-select"
              value={action}
              onChange={(event) => {
                setPage(1);
                setAction(event.target.value);
              }}
            >
              <option value="">All actions</option>
              <option value="user.created">User created</option>
              <option value="user.updated">User updated</option>
              <option value="user.activated">User activated</option>
              <option value="user.deactivated">User deactivated</option>
              <option value="user.deleted">User deleted</option>
              <option value="department.created">Department created</option>
              <option value="department.updated">Department updated</option>
              <option value="department.deleted">Department deleted</option>
              <option value="task.created">Task created</option>
              <option value="task.acknowledged">Task acknowledged</option>
              <option value="task.submitted">Task submitted</option>
              <option value="task.review.approved">Task approved</option>
              <option value="task.review.changes_requested">Task changes requested</option>
              <option value="task.comment.added">Task comment added</option>
              <option value="task.updated">Task updated</option>
              <option value="task.deleted">Task deleted</option>
              <option value="meeting.room.created">Meeting room created</option>
              <option value="meeting.room.updated">Meeting room updated</option>
              <option value="meeting.room.participants_added">Room participants invited</option>
              <option value="meeting.room.participants_removed">Room access updated</option>
              <option value="meeting.room.announcement_added">Room announcement shared</option>
              <option value="meeting.created">Meeting scheduled</option>
              <option value="meeting.updated">Meeting updated</option>
              <option value="meeting.cancelled">Meeting cancelled</option>
              <option value="meeting.deleted">Meeting deleted</option>
            </select>
          </label>
          <span className="tf-card-subtitle">{total} recorded events</span>
        </div>

        <div className="tf-table-responsive">
          <table className="tf-table tf-audit-logs-table">
            <thead>
              <tr>
                <th>Date &amp; time</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="tf-table-empty">Loading audit events…</td></tr>
              ) : logs.length ? logs.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td>{entry.actor?.name || 'Deleted account'}</td>
                  <td>{entry.actorRole.replaceAll('_', ' ')}</td>
                  <td>
                    <span className="tf-audit-action">
                      {ACTION_LABELS[entry.action] || entry.action.replaceAll('.', ' ').replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td>{entry.resourceType}</td>
                  <td>{entry.summary}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="tf-table-empty">No audit events found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="tf-pagination-bar">
          <span>Page {page} of {totalPages}</span>
          <div>
            <button
              type="button"
              className="tf-btn tf-btn-secondary"
              onClick={() => {
                setLoading(true);
                setPage((current) => Math.max(1, current - 1));
              }}
              disabled={loading || page <= 1}
            >
              Previous
            </button>
            <button
              type="button"
              className="tf-btn tf-btn-secondary"
              onClick={() => {
                setLoading(true);
                setPage((current) => Math.min(totalPages, current + 1));
              }}
              disabled={loading || page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminAuditLogsPage;
