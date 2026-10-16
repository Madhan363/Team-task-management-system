import { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Building2,
  ListTodo,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  FileText,
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
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { api } from '../../api';

function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [completedTasksLoading, setCompletedTasksLoading] = useState(false);
  const [completedTasksError, setCompletedTasksError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.getAdminDashboard();
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load admin metrics.');
    } finally {
      setLoading(false);
    }
  };

  const loadCompletedTasks = async () => {
    setCompletedTasksLoading(true);
    setCompletedTasksError('');
    try {
      const result = await api.getTeamTasks({ status: 'completed' });
      setCompletedTasks(result.tasks || []);
    } catch (err) {
      setCompletedTasksError(err.message || 'Failed to load completed tasks.');
    } finally {
      setCompletedTasksLoading(false);
    }
  };

  const handleCompletedTasksClick = () => {
    if (showCompletedTasks) {
      setShowCompletedTasks(false);
      return;
    }
    setShowCompletedTasks(true);
    loadCompletedTasks();
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = data?.stats || {
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    totalDepartments: 0,
    totalTasks: 0,
    completedTasks: 0,
    incompleteTasks: 0,
  };

  const charts = data?.charts || {};
  const userChart = charts.userStatusChart || [];
  const taskChart = charts.taskStatusChart || [];
  const deptChart = charts.departmentDistributionChart || [];
  const trendChart = charts.completionTrends || [];

  return (
    <div className="tf-page-container">
      {/* Page Header */}
      <div className="tf-page-header">
        <div>
          <h2>System Overview & Analytics</h2>
          <p>Real-time metrics and operational statistics across all departments and accounts.</p>
        </div>
        <button
          type="button"
          className="tf-btn tf-btn-secondary"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'tf-spin' : ''} /> Refresh Metrics
        </button>
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
            <span className="tf-stat-label">Total Users</span>
            <strong className="tf-stat-value">{stats.totalUsers}</strong>
            <span className="tf-stat-hint">Registered accounts</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-emerald">
            <UserCheck size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Active Users</span>
            <strong className="tf-stat-value">{stats.activeUsers}</strong>
            <span className="tf-stat-hint">Authorized & active</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-rose">
            <UserX size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Inactive Users</span>
            <strong className="tf-stat-value">{stats.inactiveUsers}</strong>
            <span className="tf-stat-hint">Deactivated accounts</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-purple">
            <Building2 size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Total Departments</span>
            <strong className="tf-stat-value">{stats.totalDepartments}</strong>
            <span className="tf-stat-hint">Organizational units</span>
          </div>
        </div>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-cyan">
            <ListTodo size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Total Tasks</span>
            <strong className="tf-stat-value">{stats.totalTasks}</strong>
            <span className="tf-stat-hint">Across all departments</span>
          </div>
        </div>

        <button
          type="button"
          className="tf-stat-card tf-stat-card-action"
          onClick={handleCompletedTasksClick}
          aria-expanded={showCompletedTasks}
          aria-controls="admin-completed-tasks"
        >
          <div className="tf-stat-icon-wrapper tf-stat-green">
            <CheckCircle2 size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Completed Tasks</span>
            <strong className="tf-stat-value">{stats.completedTasks}</strong>
            <span className="tf-stat-hint">{showCompletedTasks ? 'Click to hide task list' : 'Click to view completed tasks'}</span>
          </div>
        </button>

        <div className="tf-stat-card">
          <div className="tf-stat-icon-wrapper tf-stat-amber">
            <Clock size={22} />
          </div>
          <div className="tf-stat-content">
            <span className="tf-stat-label">Incomplete Tasks</span>
            <strong className="tf-stat-value">{stats.incompleteTasks}</strong>
            <span className="tf-stat-hint">Assigned / In Progress / Review</span>
          </div>
        </div>
      </div>

      {showCompletedTasks && (
        <section className="tf-card tf-table-card tf-admin-completed-tasks" id="admin-completed-tasks">
          <div className="tf-card-header">
            <div>
              <h3>Completed Tasks</h3>
              <p>Tasks approved and completed across all departments.</p>
            </div>
            <div className="tf-admin-completed-actions">
              <button
                type="button"
                className="tf-btn tf-btn-secondary"
                onClick={loadCompletedTasks}
                disabled={completedTasksLoading}
              >
                <RefreshCw size={14} className={completedTasksLoading ? 'tf-spin' : ''} /> Refresh
              </button>
              <button
                type="button"
                className="tf-btn tf-btn-secondary"
                onClick={() => setShowCompletedTasks(false)}
              >
                <ArrowLeft size={14} /> Back to Overview
              </button>
            </div>
          </div>
          {completedTasksError && (
            <div className="tf-alert tf-alert-error" role="alert">
              <AlertCircle size={18} />
              <span>{completedTasksError}</span>
            </div>
          )}
          <div className="tf-table-responsive">
            <table className="tf-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Assigned Member</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Completed Date</th>
                </tr>
              </thead>
              <tbody>
                {completedTasksLoading ? (
                  <tr>
                    <td colSpan={5} className="tf-table-empty">Loading completed tasks…</td>
                  </tr>
                ) : completedTasksError ? (
                  <tr>
                    <td colSpan={5} className="tf-table-empty">Completed tasks could not be loaded.</td>
                  </tr>
                ) : completedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="tf-table-empty">No completed tasks found.</td>
                  </tr>
                ) : completedTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <strong>{task.title}</strong>
                      {task.description && <p className="tf-table-desc-text">{task.description}</p>}
                    </td>
                    <td>{task.assignee?.name || task.assignedTo?.name || 'Unassigned'}</td>
                    <td>{task.department?.name || '—'}</td>
                    <td><span className={`tf-priority-tag tf-priority-${task.priority}`}>{task.priority}</span></td>
                    <td>{task.completedAt ? new Date(task.completedAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Analytics Charts Grid */}
      <div className="tf-charts-grid">
        {/* Chart 1: Active vs Inactive Users */}
        <div className="tf-chart-card">
          <div className="tf-chart-header">
            <h3>Active vs. Inactive Users</h3>
            <span>Account operational status</span>
          </div>
          <div className="tf-chart-box">
            {userChart.length > 0 && userChart.some((u) => u.value > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={userChart}
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {userChart.map((entry, index) => (
                      <Cell key={`user-cell-${index}`} fill={entry.color} />
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
              <div className="tf-chart-empty">No user account data recorded</div>
            )}
          </div>
        </div>

        {/* Chart 2: Completed vs Incomplete Tasks */}
        <div className="tf-chart-card">
          <div className="tf-chart-header">
            <h3>Task Status Breakdown</h3>
            <span>Completion and stage distribution</span>
          </div>
          <div className="tf-chart-box">
            {taskChart.length > 0 && taskChart.some((t) => t.value > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={taskChart}
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {taskChart.map((entry, index) => (
                      <Cell key={`task-cell-${index}`} fill={entry.color} />
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
              <div className="tf-chart-empty">No task records found</div>
            )}
          </div>
        </div>

        {/* Chart 3: Task distribution by Department */}
        <div className="tf-chart-card tf-chart-wide">
          <div className="tf-chart-header">
            <h3>Task Distribution by Department</h3>
            <span>Total assigned vs. completed tasks per department</span>
          </div>
          <div className="tf-chart-box">
            {deptChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={deptChart} margin={{ top: 15, right: 25, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="department" stroke="#64748b" />
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
                  <Bar dataKey="totalTasks" name="Total Tasks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completedTasks" name="Completed Tasks" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="tf-chart-empty">No department tasks to display</div>
            )}
          </div>
        </div>

        {/* Chart 4: Task Completion Trends */}
        <div className="tf-chart-card tf-chart-wide">
          <div className="tf-chart-header">
            <h3>Task Velocity & Completion Trends (Last 7 Days)</h3>
            <span>Tasks created vs. tasks completed</span>
          </div>
          <div className="tf-chart-box">
            {trendChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendChart} margin={{ top: 15, right: 25, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" />
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
                  <Area
                    type="monotone"
                    dataKey="created"
                    name="Tasks Created"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#createdGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Tasks Completed"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#completedGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="tf-chart-empty">No trend data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
