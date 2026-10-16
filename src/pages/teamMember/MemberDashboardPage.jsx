import { useState, useEffect } from 'react';
import {
  CheckSquare,
  BellRing,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../api';
import TeamMemberAIAssistant from '../../components/TeamMemberAIAssistant';

function MemberDashboardPage({ onNavigateTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getTeamMemberDashboard();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load member dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = data?.stats || {
    myTotalTasks: 0,
    tasksAwaitingMyAcknowledgment: 0,
    tasksInProgress: 0,
    tasksSubmittedForReview: 0,
    completedTasks: 0,
    overdueTasks: 0,
  };

  const urgentTasks = data?.urgentTasks || [];
  const recentTasks = data?.recentTasks || [];

  return (
    <div className="tf-page-container">
      {/* Header */}
      <div className="tf-page-header">
        <div>
          <h2>My Workspace & Tasks Overview</h2>
          <p>
            Track your personal assignments, acknowledge newly delegated work, and report deliverables.
          </p>
        </div>
        <div className="tf-header-actions">
          <button
            type="button"
            className="tf-btn tf-btn-secondary"
            onClick={loadData}
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

      {/* Summary Cards */}
      <div className="tf-stats-grid">
        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-blue">
            <CheckSquare size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">My Total Tasks</span>
            <strong className="tf-stat-value">{stats.myTotalTasks}</strong>
            <span className="tf-stat-hint">Assigned to you</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-amber">
            <BellRing size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Awaiting Ack</span>
            <strong className="tf-stat-value">{stats.tasksAwaitingMyAcknowledgment}</strong>
            <span className="tf-stat-hint">Requires confirmation</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-cyan">
            <Clock size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Tasks In Progress</span>
            <strong className="tf-stat-value">{stats.tasksInProgress}</strong>
            <span className="tf-stat-hint">Currently active</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-purple">
            <Send size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">In Review</span>
            <strong className="tf-stat-value">{stats.tasksSubmittedForReview}</strong>
            <span className="tf-stat-hint">Leader evaluation</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-green">
            <CheckCircle2 size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Completed Tasks</span>
            <strong className="tf-stat-value">{stats.completedTasks}</strong>
            <span className="tf-stat-hint">Approved by leader</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-rose">
            <AlertTriangle size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Overdue Tasks</span>
            <strong className="tf-stat-value">{stats.overdueTasks}</strong>
            <span className="tf-stat-hint">Past due date</span>
          </div>
        </div>
      </div>

      {/* Acknowledgment Callout if pending */}
      {stats.tasksAwaitingMyAcknowledgment > 0 && (
        <div className="tf-alert tf-alert-warn tf-ack-banner">
          <div>
            <strong>You have {stats.tasksAwaitingMyAcknowledgment} task(s) awaiting your acknowledgment!</strong>
            <p>Confirming receipt lets your Team Leader know you have begun review.</p>
          </div>
          <button
            type="button"
            className="tf-btn tf-btn-sm tf-btn-primary"
            onClick={() => onNavigateTab?.('acknowledgments')}
          >
            Review & Acknowledge Now <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Tasks Needing Attention */}
      <div className="tf-card tf-table-card">
        <div className="tf-card-header tf-table-header-row">
          <div>
            <h3>Upcoming & Urgent Tasks</h3>
            <span className="tf-card-subtitle">Prioritized by deadline urgency.</span>
          </div>
          <button
            type="button"
            className="tf-btn tf-btn-link"
            onClick={() => onNavigateTab?.('tasks')}
          >
            View all my tasks →
          </button>
        </div>

        <div className="tf-table-responsive">
          <table className="tf-table">
            <thead>
              <tr>
                <th>Task Title</th>
                <th>Assigned By</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Ack Status</th>
                <th>Stage Status</th>
              </tr>
            </thead>
            <tbody>
              {urgentTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tf-table-empty">
                    <p>No pending urgent tasks right now!</p>
                    <span>Great job keeping up with all your deliverables.</span>
                  </td>
                </tr>
              ) : (
                urgentTasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.title}</strong>
                    </td>
                    <td>
                      {t.assignedBy?.name || 'Team Leader'}
                    </td>
                    <td>
                      <span className={`tf-priority-tag tf-priority-${t.priority}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No deadline'}
                    </td>
                    <td>
                      {t.acknowledgmentStatus === 'acknowledged' ? (
                        <span className="tf-badge tf-badge-green">Acknowledged</span>
                      ) : (
                        <span className="tf-badge tf-badge-amber">Pending Ack</span>
                      )}
                    </td>
                    <td>
                      <span className={`tf-badge tf-status-${t.status}`}>
                        {t.status === 'submitted_review'
                          ? 'In Review'
                          : t.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <TeamMemberAIAssistant />
    </div>
  );
}

export default MemberDashboardPage;
