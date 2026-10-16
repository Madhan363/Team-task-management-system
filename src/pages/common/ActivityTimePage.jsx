import { useCallback, useEffect, useState } from 'react';
import { Activity, Clock3, RefreshCw } from 'lucide-react';
import { api } from '../../api';

function formatDuration(value) {
  const totalSeconds = Math.max(0, Math.floor(value || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatDate(value) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function ActivityTimePage({ role }) {
  const [report, setReport] = useState(null);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadReport = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      setReport(await api.getActivityReport(period));
    } catch (loadError) {
      setError(loadError.message || 'Failed to load activity report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReport(), 0);
    return () => window.clearTimeout(timer);
  }, [loadReport]);

  const totals = report?.totals;
  const cards = [
    ['Today · Active application time', totals?.todayActiveSeconds, Activity],
    ['Today · Total session duration', totals?.todaySessionSeconds, Clock3],
    ['This week · Active application time', totals?.weekActiveSeconds, Activity],
    ['This week · Total session duration', totals?.weekSessionSeconds, Clock3],
    ['This month · Active application time', totals?.monthActiveSeconds, Activity],
    ['This month · Total session duration', totals?.monthSessionSeconds, Clock3],
  ];
  const isScopedViewer = role === 'admin' || role === 'team_leader';

  return (
    <div className="tf-page-container tf-activity-page">
      <div className="tf-page-header tf-activity-header">
        <div>
          <h2>Employee Activity Time</h2>
          <p>
            Active application time is estimated from in-app interactions. Session duration is signed-in wall-clock time;
            neither metric measures productivity.
          </p>
        </div>
        <div className="tf-activity-controls">
          <label>
            <span>History range</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </label>
          <button type="button" className="tf-btn tf-btn-secondary" onClick={() => loadReport(false)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'tf-activity-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="tf-alert tf-alert-error" role="alert">{error}</div>}

      <div className="tf-activity-notice" role="note">
        Tracking is limited to application interactions. No keystrokes, screenshots, or activity outside this application are recorded.
        Inactivity is capped at {Math.floor((report?.inactivityThresholdSeconds || 300) / 60)} minutes. Times and daily boundaries are shown in UTC.
      </div>

      <section className="tf-activity-summary-grid" aria-label="Activity time summary">
        {cards.map(([label, value, Icon]) => (
          <article className="tf-card tf-activity-summary-card" key={label}>
            <div className="tf-activity-summary-icon"><Icon size={18} /></div>
            <div>
              <span>{label}</span>
              <strong>{loading ? '—' : formatDuration(value)}</strong>
            </div>
          </article>
        ))}
      </section>

      {isScopedViewer && (
        <section className="tf-card tf-table-card">
          <div className="tf-card-header">
            <h3>{role === 'admin' ? 'Employee Activity Overview' : 'Department Activity Overview'}</h3>
          </div>
          <div className="tf-table-responsive">
            <table className="tf-table">
              <thead>
                <tr>
                  <th>Employee</th><th>Role</th><th>Department</th>
                  <th>Today active</th><th>Week active</th><th>Month active</th>
                  <th>Today session duration</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="tf-table-empty">Loading activity…</td></tr>
                  : !report?.users?.length ? <tr><td colSpan={7} className="tf-table-empty">No employee activity records found.</td></tr>
                    : report.users.map((person) => (
                      <tr key={person.id}>
                        <td><strong>{person.name}</strong><span className="tf-subtext">{person.username}</span></td>
                        <td>{person.role.replaceAll('_', ' ')}</td>
                        <td>{person.department || '—'}</td>
                        <td>{formatDuration(person.todayActiveSeconds)}</td>
                        <td>{formatDuration(person.weekActiveSeconds)}</td>
                        <td>{formatDuration(person.monthActiveSeconds)}</td>
                        <td>{formatDuration(person.todaySessionSeconds)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="tf-card tf-table-card">
        <div className="tf-card-header"><h3>Daily Totals · {period === 'today' ? 'Today' : period === 'week' ? 'This week' : 'This month'}</h3></div>
        <div className="tf-table-responsive">
          <table className="tf-table">
            <thead><tr><th>Date (UTC)</th><th>Active application time</th><th>Total session duration</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={3} className="tf-table-empty">Loading daily totals…</td></tr>
                : !report?.daily?.length ? <tr><td colSpan={3} className="tf-table-empty">No activity recorded for this range.</td></tr>
                  : [...report.daily].reverse().map((day) => (
                    <tr key={day.date}>
                      <td>{formatDate(day.date)}</td>
                      <td>{formatDuration(day.activeSeconds)}</td>
                      <td>{formatDuration(day.sessionDurationSeconds)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tf-card tf-table-card">
        <div className="tf-card-header"><h3>Login Sessions · {period === 'today' ? 'Today' : period === 'week' ? 'This week' : 'This month'}</h3></div>
        <div className="tf-table-responsive">
          <table className="tf-table">
            <thead>
              <tr>{isScopedViewer && <th>Employee</th>}<th>Login time</th><th>Last in-app activity</th><th>Logout / estimated end</th><th>Session duration</th><th>Active time</th><th>Status</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={isScopedViewer ? 7 : 6} className="tf-table-empty">Loading sessions…</td></tr>
                : !report?.sessions?.length ? <tr><td colSpan={isScopedViewer ? 7 : 6} className="tf-table-empty">No login sessions found for this range.</td></tr>
                  : report.sessions.map((session) => (
                    <tr key={session.id}>
                      {isScopedViewer && <td>{session.userName}</td>}
                      <td>{new Date(session.startedAt).toLocaleString()}</td>
                      <td>{session.lastActivityAt ? new Date(session.lastActivityAt).toLocaleString() : '—'}</td>
                      <td>{session.endedAt ? new Date(session.endedAt).toLocaleString() : session.estimatedEnd ? new Date(session.effectiveEndedAt).toLocaleString() : 'Still open'}</td>
                      <td>{formatDuration(session.durationSeconds)}</td>
                      <td>{formatDuration(session.activeSeconds)}</td>
                      <td>{session.status}{session.estimatedEnd ? ' · estimated' : ''}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>
      {report && <p className="tf-activity-as-of">Report generated {new Date(report.asOf).toLocaleString()} · UTC reporting basis</p>}
    </div>
  );
}

export default ActivityTimePage;
