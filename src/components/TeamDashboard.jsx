import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import LogoutButton from './LogoutButton';

function TeamDashboard({ role, user, theme, onLogout, onPersonalTasks }) {
  const [dashboard, setDashboard] = useState({ teams: [], tasks: [], notifications: [] });
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberUsername, setMemberUsername] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const result = role === 'leader'
      ? await api.leaderTeamDashboard()
      : await api.memberTeamDashboard();
    setDashboard({
      teams: result.teams || [],
      tasks: result.tasks || [],
      notifications: result.notifications || [],
      stats: result.stats || null,
    });
    setSelectedTeamId((current) => (
      result.teams?.some((team) => team.id === current) ? current : result.teams?.[0]?.id || ''
    ));
  }, [role]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = role === 'leader'
          ? await api.leaderTeamDashboard()
          : await api.memberTeamDashboard();
        if (active) {
          setDashboard({
            teams: result.teams || [],
            tasks: result.tasks || [],
            notifications: result.notifications || [],
            stats: result.stats || null,
          });
          setSelectedTeamId(result.teams?.[0]?.id || '');
          setError('');
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    };
    load();
    const interval = role === 'leader' ? window.setInterval(load, 10_000) : undefined;
    return () => {
      active = false;
      if (interval) window.clearInterval(interval);
    };
  }, [role]);

  const selectedTeam = dashboard.teams.find((team) => team.id === selectedTeamId) || null;
  const visibleTasks = role === 'leader'
    ? dashboard.tasks.filter((task) => task.teamId === selectedTeamId)
    : dashboard.tasks;
  const unreadCount = dashboard.notifications.filter((notification) => !notification.read).length;

  const perform = async (operation, successMessage) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
      await refresh();
      if (successMessage) setNotice(successMessage);
    } catch (operationError) {
      setError(operationError.message);
    } finally {
      setBusy(false);
    }
  };

  const createTeam = (event) => {
    event.preventDefault();
    perform(async () => {
      const { team } = await api.createTeam({ name: teamName, description: teamDescription });
      setTeamName('');
      setTeamDescription('');
      await refresh();
      setSelectedTeamId(team.id);
    }, 'Team created.');
  };

  const addMember = (event) => {
    event.preventDefault();
    if (!selectedTeam) return;
    perform(async () => {
      await api.addTeamMember(selectedTeam.id, memberEmail);
      setMemberEmail('');
    }, 'Member added to the team.');
  };

  const createMember = (event) => {
    event.preventDefault();
    perform(async () => {
      await api.createTeamMember({
        name: memberName,
        username: memberUsername,
        email: memberEmail,
        password: memberPassword,
      });
      setMemberName('');
      setMemberUsername('');
      setMemberEmail('');
      setMemberPassword('');
    }, 'Team Member account created in your department.');
  };

  const assignTask = (event) => {
    event.preventDefault();
    if (!selectedTeam) return;
    perform(async () => {
      await api.createTeamTask(selectedTeam.id, {
        title: taskTitle,
        description: taskDescription,
        priority: taskPriority,
        dueDate: taskDueDate || null,
        assigneeId,
      });
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('medium');
      setTaskDueDate('');
      setAssigneeId('');
    }, 'Task assigned.');
  };

  const updateStatus = (taskId, status) => {
    perform(() => api.updateTeamTaskStatus(taskId, status), 'Task started.');
  };

  const acknowledge = (taskId) => {
    perform(() => api.acknowledgeTeamTask(taskId), 'Task acknowledged. Your team leader has been notified.');
  };

  const markRead = (notificationId) => {
    perform(() => api.markTeamNotificationRead(notificationId));
  };
  const submitTask = (taskId) => {
    perform(() => api.submitTeamTask(taskId), 'Task submitted for leader review.');
  };
  const reviewTask = (taskId, decision, comment) => {
    perform(() => api.reviewTeamTask(taskId, decision, comment), decision === 'approve'
      ? 'Task approved and completed.'
      : 'Changes requested from the team member.');
  };
  const addResponse = (taskId, message, responseType) => (
    perform(() => api.addTeamTaskResponse(taskId, message, responseType), 'Your response was sent.')
  );

  return (
    <main className="app-shell app-shell-dashboard" data-theme={theme}>
      <section className="todo-card team-dashboard" aria-labelledby="team-dashboard-title">
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
          <span className="app-eyebrow">{role === 'leader' ? 'TEAM LEADER' : 'TEAM MEMBER'}</span>
          <h1 id="team-dashboard-title">{role === 'leader' ? 'Team Leader Dashboard' : 'My Assigned Tasks'}</h1>
          <p>
            {role === 'leader'
              ? 'Assign work to individual members and track acknowledgements.'
              : 'Review tasks assigned to you and acknowledge when you understand them.'}
          </p>
        </header>

        {error && <p className="global-error" role="alert">{error}</p>}
        {notice && <p className="global-notice" role="status">{notice}</p>}

        {dashboard.stats && (
          <section className="team-stat-grid" aria-label="Team task summary">
            {Object.entries(role === 'leader'
              ? {
                'Team members': dashboard.stats.members,
                'Tasks assigned': dashboard.stats.assigned,
                'Awaiting acknowledgement': dashboard.stats.awaitingAcknowledgement,
                'In progress': dashboard.stats.inProgress,
                'Submitted for review': dashboard.stats.submitted,
                Completed: dashboard.stats.completed,
                Overdue: dashboard.stats.overdue,
              }
              : {
                'My tasks': dashboard.stats.total,
                'Awaiting acknowledgement': dashboard.stats.awaitingAcknowledgement,
                'In progress': dashboard.stats.inProgress,
                'Submitted for review': dashboard.stats.submitted,
                Completed: dashboard.stats.completed,
                Overdue: dashboard.stats.overdue,
              }).map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </section>
        )}

        {role === 'leader' ? (
          <>
            <section className="team-panel">
              <h2>Create a team</h2>
              <form className="team-form-grid" onSubmit={createTeam}>
                <label>Team name<input value={teamName} onChange={(event) => setTeamName(event.target.value)} maxLength={80} required /></label>
                <label>Description<input value={teamDescription} onChange={(event) => setTeamDescription(event.target.value)} maxLength={500} /></label>
                <button type="submit" disabled={busy}>Create team</button>
              </form>
            </section>

            {dashboard.teams.length > 0 && (
              <>
                <label className="team-selector">
                  Selected team
                  <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
                    {dashboard.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                </label>

                {selectedTeam && (
                  <>
                    <section className="team-panel">
                      <h2>{selectedTeam.name} members</h2>
                      <ul className="team-member-list">
                        {selectedTeam.members.map((member) => (
                          <li key={member.id}><span>{member.name}</span><small>{member.email}</small></li>
                        ))}
                        {!selectedTeam.members.length && <li>No members added yet.</li>}
                      </ul>
                      <form className="team-form-grid" onSubmit={addMember}>
                        <label>Existing member email<input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} required /></label>
                        <button type="submit" disabled={busy}>Add member</button>
                      </form>
                      <p className="team-empty">Members must already have a registered account with this email.</p>
                    </section>

                    {selectedTeam.members.length > 0 && (
                      <section className="team-panel">
                        <h2>Assign an individual task</h2>
                        <form className="team-form-grid" onSubmit={assignTask}>
                          <label>Task title<input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} maxLength={120} required /></label>
                          <label>Description<textarea value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} maxLength={2000} /></label>
                          <label>Assign to
                            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} required>
                              <option value="">Select one member</option>
                              {selectedTeam.members.map((member) => (
                                <option key={member.id} value={member.id}>{member.name} ({member.email})</option>
                              ))}
                            </select>
                          </label>
                          <label>Priority
                            <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}>
                              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                            </select>
                          </label>
                          <label>Due date<input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} /></label>
                          <button type="submit" disabled={busy}>Assign task</button>
                        </form>
                      </section>
                    )}
                  </>
                )}
              </>
            )}

            <section className="team-panel">
              <h2>Create a Team Member</h2>
              <p className="team-empty">New member accounts are automatically assigned the Team Member role and your department.</p>
              <form className="team-form-grid" onSubmit={createMember}>
                <label>Full name<input value={memberName} onChange={(event) => setMemberName(event.target.value)} maxLength={80} required /></label>
                <label>Username<input value={memberUsername} onChange={(event) => setMemberUsername(event.target.value)} minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" required /></label>
                <label>Email<input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} maxLength={254} required /></label>
                <label>Initial password<input type="password" value={memberPassword} onChange={(event) => setMemberPassword(event.target.value)} minLength={8} maxLength={100} required /></label>
                <button type="submit" disabled={busy}>Create Team Member</button>
              </form>
            </section>

            <section className="team-panel">
              <h2>Team tasks</h2>
              <TeamTaskList
                tasks={visibleTasks}
                role={role}
                onAcknowledge={acknowledge}
                onStatusChange={updateStatus}
                onSubmit={submitTask}
                onReview={reviewTask}
                onResponse={addResponse}
                busy={busy}
              />
            </section>
            <section className="team-panel">
              <h2>Notifications {unreadCount > 0 && <span className="team-unread-count">{unreadCount} unread</span>}</h2>
              <ul className="team-notifications">
                {dashboard.notifications.map((notification) => (
                  <li key={notification.id} className={notification.read ? '' : 'unread'}>
                    <span>{notification.message}<small>{new Date(notification.createdAt).toLocaleString()}</small></span>
                    {!notification.read && (
                      <button type="button" onClick={() => markRead(notification.id)} disabled={busy}>Mark read</button>
                    )}
                  </li>
                ))}
                {!dashboard.notifications.length && <li>No acknowledgements yet.</li>}
              </ul>
            </section>
            {dashboard.stats && (
              <section className="team-panel">
                <h2>Team workload</h2>
                <div className="team-workload-chart">
                  {selectedTeam?.members.map((member) => {
                    const assignedTasks = visibleTasks.filter((task) => task.assignee.id === member.id);
                    const completedTasks = assignedTasks.filter((task) => task.status === 'completed').length;
                    return (
                      <div key={member.id}>
                        <span>{member.name}</span>
                        <div className="team-workload-track"><span style={{
                          width: `${assignedTasks.length ? (completedTasks / assignedTasks.length) * 100 : 0}%`,
                        }} /></div>
                        <small>{completedTasks}/{assignedTasks.length} complete</small>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <section className="team-panel">
              <h2>Tasks assigned to you</h2>
              <TeamTaskList
                tasks={visibleTasks}
                role={role}
                onAcknowledge={acknowledge}
                onStatusChange={updateStatus}
                onSubmit={submitTask}
                onReview={reviewTask}
                onResponse={addResponse}
                busy={busy}
              />
            </section>
            <section className="team-panel">
              <h2>Notifications</h2>
              <ul className="team-notifications">
                {dashboard.notifications.map((notification) => (
                  <li key={notification.id} className={notification.read ? '' : 'unread'}>
                    <span>{notification.message}<small>{new Date(notification.createdAt).toLocaleString()}</small></span>
                    {!notification.read && <button type="button" onClick={() => markRead(notification.id)} disabled={busy}>Mark read</button>}
                  </li>
                ))}
                {!dashboard.notifications.length && <li>No notifications yet.</li>}
              </ul>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function TeamTaskList({ tasks, role, onAcknowledge, onStatusChange, onSubmit, onReview, onResponse, busy }) {
  if (!tasks.length) return <p className="team-empty">No tasks to show.</p>;
  return (
    <ul className="team-task-list">
      {tasks.map((task) => (
        <TeamTaskCard
          key={task.id}
          task={task}
          role={role}
          onAcknowledge={onAcknowledge}
          onStatusChange={onStatusChange}
          onSubmit={onSubmit}
          onReview={onReview}
          onResponse={onResponse}
          busy={busy}
        />
      ))}
    </ul>
  );
}

function TeamTaskCard({ task, role, onAcknowledge, onStatusChange, onSubmit, onReview, onResponse, busy }) {
  const [responseMessage, setResponseMessage] = useState('');
  const [responseType, setResponseType] = useState('comment');
  const [reviewComment, setReviewComment] = useState('');
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState('');

  const loadHistory = async () => {
    try {
      setHistory(await api.getTeamTaskHistory(task.id));
      setHistoryError('');
    } catch (error) {
      setHistoryError(error.message);
    }
  };
  const sendResponse = (event) => {
    event.preventDefault();
    onResponse(task.id, responseMessage, responseType);
    setResponseMessage('');
  };
  const sendReview = (decision) => {
    onReview(task.id, decision, reviewComment);
    setReviewComment('');
  };

  return (
    <li className="team-task-card">
      <div className="team-task-heading">
        <h3>{task.title}</h3>
        <span className={`team-status team-status-${task.status}`}>{task.status.replace('_', ' ')}</span>
      </div>
      {task.description && <p>{task.description}</p>}
      <div className="team-task-meta">
        {role === 'leader' && <span>Assigned to <strong>{task.assignee.name}</strong> · {task.assignee.email}</span>}
        {role === 'member' && <span>Team: <strong>{task.teamName}</strong> · Assigned by {task.assignedBy?.name || 'Team Leader'}</span>}
        <span>Priority: {task.priority}</span>
        <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}</span>
        <span>Assigned: {new Date(task.assignedAt).toLocaleDateString()}</span>
      </div>
      {role === 'leader' ? (
        <>
          <p className={task.acknowledgedAt ? 'team-acknowledged' : 'team-awaiting'}>
            {task.acknowledgedAt
              ? `Acknowledged ${new Date(task.acknowledgedAt).toLocaleString()}`
              : 'Awaiting member acknowledgement'}
          </p>
          {task.status === 'submitted_review' && (
            <div className="team-task-actions">
              <label>Review note<textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={2000} /></label>
              <button type="button" onClick={() => sendReview('approve')} disabled={busy}>Approve and complete</button>
              <button type="button" onClick={() => sendReview('changes')} disabled={busy || !reviewComment.trim()}>Request changes</button>
            </div>
          )}
        </>
      ) : (
        <div className="team-task-actions">
          {!task.acknowledgedAt && (
            <button type="button" onClick={() => onAcknowledge(task.id)} disabled={busy}>Acknowledge Task</button>
          )}
          {task.acknowledgedAt && task.status === 'assigned' && (
            <button type="button" onClick={() => onStatusChange(task.id, 'in_progress')} disabled={busy}>Start Task</button>
          )}
          {task.status === 'in_progress' && (
            <button type="button" onClick={() => onSubmit(task.id)} disabled={busy}>Submit for Review</button>
          )}
          {task.acknowledgedAt && <p className="team-acknowledged">Acknowledged {new Date(task.acknowledgedAt).toLocaleString()}</p>}
        </div>
      )}
      {task.status !== 'completed' && (
        <form className="team-response-form" onSubmit={sendResponse}>
          <label>{role === 'member' ? 'Comment or clarification' : 'Comment'}
            <textarea value={responseMessage} onChange={(event) => setResponseMessage(event.target.value)} maxLength={2000} required />
          </label>
          {role === 'member' && (
            <select value={responseType} onChange={(event) => setResponseType(event.target.value)} aria-label="Response type">
              <option value="comment">Comment</option><option value="clarification">Clarification request</option>
            </select>
          )}
          <button type="submit" disabled={busy}>Send</button>
        </form>
      )}
      <button type="button" className="team-history-toggle" onClick={loadHistory}>View task history and comments</button>
      {historyError && <p className="global-error" role="alert">{historyError}</p>}
      {history && (
        <div className="team-task-history">
          {[...history.history.map((item) => ({ ...item, kind: 'history' })),
            ...history.responses.map((item) => ({ ...item, kind: 'response' }))]
            .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt))
            .map((item) => (
              <p key={`${item.kind}-${item.id}`}>
                <strong>{item.actor || item.author}</strong> {item.kind === 'history'
                  ? `${item.oldStatus || 'created'} → ${item.newStatus}${item.comment ? ` · ${item.comment}` : ''}`
                  : `(${item.responseType}) ${item.message}`}
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </p>
            ))}
          {!history.history.length && !history.responses.length && <p>No task history yet.</p>}
        </div>
      )}
    </li>
  );
}

export default TeamDashboard;
