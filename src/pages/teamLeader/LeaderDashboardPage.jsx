import { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  ListTodo,
  BellRing,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { api } from '../../api';

function LeaderDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getTeamLeaderDashboard();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load team leader metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = data?.stats || {
    totalTeamMembers: 0,
    activeTeamMembers: 0,
    tasksAssigned: 0,
    awaitingAcknowledgment: 0,
    tasksInProgress: 0,
    completedTasks: 0,
    overdueTasks: 0,
  };

  const charts = data?.charts || {};
  const completionChart = charts.completionBreakdown || [];
  const workloadChart = charts.memberWorkload || [];
  const recentTasks = data?.recentTasks || [];

  return (
    <div className="tf-page-container">
      {/* Header */}
      <div className="tf-page-header">
        <div>
          <h2>Team Leader Workspace</h2>
          <p>
            Department: <strong>{data?.department?.name || 'Assigned Department'}</strong> —
            Monitor member performance, assign tasks, and review submissions.
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
            <Users size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Team Members</span>
            <strong className="tf-stat-value">{stats.totalTeamMembers}</strong>
            <span className="tf-stat-hint">In your department</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-emerald">
            <UserCheck size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Active Members</span>
            <strong className="tf-stat-value">{stats.activeTeamMembers}</strong>
            <span className="tf-stat-hint">Ready for tasks</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-purple">
            <ListTodo size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Tasks Assigned</span>
            <strong className="tf-stat-value">{stats.tasksAssigned}</strong>
            <span className="tf-stat-hint">Department tasks</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-amber">
            <BellRing size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Awaiting Ack</span>
            <strong className="tf-stat-value">{stats.awaitingAcknowledgment}</strong>
            <span className="tf-stat-hint">Pending acknowledgment</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-cyan">
            <Clock size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Tasks In Progress</span>
            <strong className="tf-stat-value">{stats.tasksInProgress}</strong>
            <span className="tf-stat-hint">Actively worked on</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-green">
            <CheckCircle2 size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Completed Tasks</span>
            <strong className="tf-stat-value">{stats.completedTasks}</strong>
            <span className="tf-stat-hint">Approved & delivered</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-rose">
            <AlertTriangle size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Overdue Tasks</span>
            <strong className="tf-stat-value">{stats.overdueTasks}</strong>
            <span className="tf-stat-hint">Past scheduled due date</span>
          </div>
        </div>
      </div>

      {/* Analytical Charts */}
      <div className="tf-charts-grid">
        {/* Chart 1: Task Completion Breakdown */}
        <div className="tf-chart-card">
          <div className="tf-chart-header">
            <h3>Task Pipeline Status</h3>
            <span>Distribution of tasks across delivery stages</span>
          </div>
          <div className="tf-chart-box">
            {completionChart.length > 0 && completionChart.some((c) => c.value > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={completionChart}
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {completionChart.map((entry, index) => (
                      <Cell key={`pipe-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="tf-chart-empty">No department tasks yet</div>
            )}
          </div>
        </div>

        {/* Chart 2: Team Workload */}
        <div className="tf-chart-card">
          <div className="tf-chart-header">
            <h3>Team Workload Distribution</h3>
            <span>Assigned vs completed tasks per member</span>
          </div>
          <div className="tf-chart-box">
            {workloadChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={workloadChart} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="assignedTasks" name="Assigned" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completedTasks" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="tf-chart-empty">No team member workload data</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Department Tasks Preview */}
      <div className="tf-card tf-table-card">
        <div className="tf-card-header tf-table-header-row">
          <div>
            <h3>Recent Department Tasks</h3>
            <span className="tf-card-subtitle">Latest activity across your team members.</span>
          </div>
          <button
            type="button"
            className="tf-btn tf-btn-link"
            onClick={() => onNavigateTab?.('tasks')}
          >
            View all tasks →
          </button>
        </div>

        <div className="tf-table-responsive">
          <table className="tf-table">
            <thead>
              <tr>
                <th>Task Title</th>
                <th>Assigned Member</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Ack Status</th>
                <th>Stage Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tf-table-empty">
                    <p>No tasks assigned yet.</p>
                    <span>Use Assign Tasks in the sidebar to create your team&apos;s first assignment.</span>
                  </td>
                </tr>
              ) : (
                recentTasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.title}</strong>
                    </td>
                    <td>
                      {t.assignee?.name || t.assignedTo?.name || 'Unassigned'}
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
                        {t.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default LeaderDashboardPage;
