import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCheck, CheckCircle, MessageSquare, Paperclip, RefreshCw, Send } from 'lucide-react';
import { api } from '../../api';

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, data: reader.result });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function createResponsibilityDrafts(contributions = []) {
  return Object.fromEntries(contributions.map((item) => [String(item.user), {
    responsibility: item.responsibility || '',
    description: item.description || '',
  }]));
}

function SharedTaskWorkspace({ task: initialTask, role, onClose, onUpdated }) {
  const [task, setTask] = useState(initialTask);
  const [currentUserId, setCurrentUserId] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [activity, setActivity] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [chatError, setChatError] = useState('');
  const [contributionForm, setContributionForm] = useState({});
  const [responsibilityDrafts, setResponsibilityDrafts] = useState({});
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionSummary, setSubmissionSummary] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState([]);
  const [reviewComment, setReviewComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const missingTaskHandled = useRef(false);

  const handleMissingTask = useCallback((requestError) => {
    if (requestError.status !== 404) return false;
    if (!missingTaskHandled.current) {
      missingTaskHandled.current = true;
      onUpdated?.();
      onClose();
    }
    return true;
  }, [onClose, onUpdated]);

  const refreshTask = useCallback(async () => {
    const result = await api.getTask(initialTask.id);
    setTask(result.task);
    setCurrentUserId(result.currentUserId || '');
    setResponsibilityDrafts(createResponsibilityDrafts(result.task.contributions));
    const own = (result.task.contributions || []).find((item) => String(item.user) === String(result.currentUserId));
    if (own) {
      setContributionForm({
        responsibility: own.responsibility || '',
        description: own.description || '',
        status: own.status || 'todo',
        progress: own.progress || 0,
        completionNotes: own.completionNotes || '',
      });
    }
  }, [initialTask.id]);

  const refreshTaskSnapshot = useCallback(async () => {
    try {
      const result = await api.getTask(initialTask.id);
      setTask(result.task);
    } catch (err) {
      if (!handleMissingTask(err)) setError(err.message || 'Could not refresh task contributions.');
    }
  }, [handleMissingTask, initialTask.id]);

  const refreshChat = useCallback(async () => {
    try {
      const result = await api.getTaskChat(initialTask.id);
      setMessages(result.messages || []);
      setChatError('');
    } catch (err) {
      if (!handleMissingTask(err)) {
        setChatError(err.message || 'Could not refresh task chat.');
      }
    }
  }, [handleMissingTask, initialTask.id]);

  useEffect(() => {
    let active = true;
    api.getTask(initialTask.id).then((result) => {
      if (!active) return;
      setTask(result.task);
      setCurrentUserId(result.currentUserId || '');
      setResponsibilityDrafts(createResponsibilityDrafts(result.task.contributions));
      const own = (result.task.contributions || []).find((item) => String(item.user) === String(result.currentUserId));
      if (own) {
        setContributionForm({
          responsibility: own.responsibility || '',
          description: own.description || '',
          status: own.status || 'todo',
          progress: own.progress || 0,
          completionNotes: own.completionNotes || '',
        });
      }
    }).catch((err) => {
      if (active && !handleMissingTask(err)) setError(err.message || 'Could not load shared task.');
    });
    api.getTaskChat(initialTask.id).then((result) => {
      if (active) {
        setMessages(result.messages || []);
        setChatError('');
      }
    }).catch((err) => {
      if (active && !handleMissingTask(err)) setChatError(err.message || 'Could not refresh task chat.');
    }).finally(() => {
      if (active) setChatLoading(false);
    });
    api.getTaskHistory(initialTask.id).then((result) => {
      if (active) setActivity(result.history || []);
    }).catch((err) => {
      if (active && !handleMissingTask(err)) setError(err.message || 'Could not load task activity.');
    });
    const timer = window.setInterval(() => {
      refreshTaskSnapshot();
      refreshChat();
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [handleMissingTask, initialTask.id, refreshChat, refreshTaskSnapshot]);

  const overallProgress = useMemo(() => {
    const contributions = task.contributions || [];
    return contributions.length
      ? Math.round(contributions.reduce((total, item) => total + Number(item.progress || 0), 0) / contributions.length)
      : 0;
  }, [task.contributions]);
  const allContributionsDone = (task.contributions || []).length > 0
    && task.contributions.every((item) => item.status === 'done');
  const latestSubmission = task.submissions?.[task.submissions.length - 1];
  const overdue = task.status !== 'completed' && task.dueDate && new Date(task.dueDate) < new Date();
  const isLeader = ['team_leader', 'admin'].includes(role);
  const myContribution = (task.contributions || []).find((item) => String(item.user) === String(currentUserId));
  const isAssignedMember = role === 'team_member'
    && (task.assignees || []).some((member) => String(member.id) === String(currentUserId));

  const runAction = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await refreshTask();
      const historyResult = await api.getTaskHistory(task.id);
      setActivity(historyResult.history || []);
      if (onUpdated) onUpdated();
    } catch (err) {
      if (!handleMissingTask(err)) setError(err.message || 'The action could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!messageText.trim()) return;
    await runAction(async () => {
      await api.sendTaskChat(task.id, messageText.trim());
      setMessageText('');
      await refreshChat();
    });
  };

  const saveContribution = (event) => {
    event.preventDefault();
    runAction(() => api.updateTaskContribution(task.id, {
      ...contributionForm,
      progress: Number(contributionForm.progress),
    }));
  };

  const acknowledgeAssignment = () => runAction(() => api.acknowledgeTask(task.id));

  const updateAssignment = (memberId) => {
    const draft = responsibilityDrafts[String(memberId)] || {};
    runAction(() => api.updateTaskContributionAssignment(task.id, memberId, {
      responsibility: draft.responsibility || '',
      description: draft.description || '',
    }));
  };

  const submitTeamWork = async (event) => {
    event.preventDefault();
    if (!allContributionsDone && !window.confirm('Some contributions are unfinished. Submit the current work anyway?')) return;
    await runAction(async () => {
      const attachments = await Promise.all(submissionFiles.map(readFile));
      await api.submitSharedTask(task.id, {
        notes: submissionNotes,
        summary: submissionSummary,
        attachments,
        confirmIncomplete: !allContributionsDone,
      });
      setSubmissionNotes('');
      setSubmissionSummary('');
      setSubmissionFiles([]);
    });
  };

  const reviewSubmission = (decision) => runAction(() => api.reviewTask(task.id, decision, reviewComment.trim()));

  return (
    <section className="tf-task-details-page">
      <div className="tf-page-header tf-task-details-header">
        <button type="button" className="tf-btn tf-btn-secondary" onClick={onClose}>
          <ArrowLeft size={16} /> Back to Tasks
        </button>
        <div className="tf-modal-title-box">
          <span className={`tf-priority-tag tf-priority-${task.priority}`}>{task.priority}</span>
          <h2>{task.title}</h2>
          {task.project?.name && <small className="tf-task-project-label">Project: {task.project.name}</small>}
        </div>
      </div>

      {error && <div className="tf-alert tf-alert-error" role="alert">{error}</div>}
      <div className="tf-card tf-task-details-card">
        <div className="tf-modal-details-grid">
          <div><label>Shared task status</label><span className={`tf-badge tf-status-${task.status}`}>{task.status?.replaceAll('_', ' ')}</span></div>
          <div><label>Due date</label><span className={overdue ? 'tf-text-danger tf-overdue-tag' : ''}>{task.dueDate ? `${new Date(task.dueDate).toLocaleDateString()}${overdue ? ' (Overdue)' : ''}` : 'No deadline'}</span></div>
          <div><label>Overall contribution progress</label><span>{overallProgress}%</span></div>
          <div><label>Submission readiness</label><span>{allContributionsDone ? 'Ready for Submission' : 'Work in Progress'}</span></div>
          {isAssignedMember && (
            <div>
              <label>Assignment acknowledgment</label>
              {task.acknowledgmentStatus === 'acknowledged' ? (
                <span>
                  Acknowledged{task.acknowledgedAt ? ` on ${new Date(task.acknowledgedAt).toLocaleString()}` : ''}
                </span>
              ) : (
                <button type="button" className="tf-btn tf-btn-primary tf-btn-sm" onClick={acknowledgeAssignment} disabled={busy}>
                  <CheckCircle size={14} /> {busy ? 'Saving…' : 'Acknowledge assignment'}
                </button>
              )}
            </div>
          )}
          <div className="tf-full-width"><label>Task details</label><p className="tf-task-desc-box">{task.description || 'No description provided.'}</p></div>
        </div>
        {(task.attachments || []).length > 0 && (
          <div className="tf-task-att-section">
            <label>Reference files</label>
            <div className="tf-attachments-chips">
              {task.attachments.map((file) => (
                <a className="tf-attachment-chip tf-att-link" href={file.url} download={file.name} key={`${file.name}-${file.url}`}>
                  <Paperclip size={13} /> {file.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="tf-card tf-task-details-card">
        <h3>Task Activity</h3>
        <div className="tf-task-chat-messages">
          {activity.map((entry) => (
            <article className="tf-task-chat-message" key={entry.id}>
              <strong>{entry.changedBy?.name || 'System'}</strong>
              <small>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}</small>
              <p>{entry.comment || `${entry.oldStatus || '—'} → ${entry.newStatus || '—'}`}</p>
            </article>
          ))}
          {activity.length === 0 && <p className="tf-text-muted">No task activity recorded yet.</p>}
        </div>
      </div>

      <div className="tf-card tf-task-details-card">
        <h3>Work Distribution</h3>
        <div className="tf-table-responsive">
          <table className="tf-table">
            <thead><tr><th>Member</th><th>Responsibility</th><th>Status</th><th>Progress</th><th>Updated</th></tr></thead>
            <tbody>
              {(task.contributions || []).map((item) => (
                <tr key={String(item.user)}>
                  <td>{item.member?.name || 'Team member'}</td>
                  <td>
                    {isLeader ? (
                      <div className="tf-contribution-assignment-editor">
                        <input
                          className="tf-input"
                          aria-label={`${item.member?.name || 'Member'} responsibility`}
                          maxLength={300}
                          value={responsibilityDrafts[String(item.user)]?.responsibility || ''}
                          onChange={(event) => setResponsibilityDrafts({
                            ...responsibilityDrafts,
                            [String(item.user)]: {
                              ...responsibilityDrafts[String(item.user)],
                              responsibility: event.target.value,
                            },
                          })}
                        />
                        <textarea
                          className="tf-textarea"
                          aria-label={`${item.member?.name || 'Member'} responsibility description`}
                          rows={2}
                          maxLength={2000}
                          value={responsibilityDrafts[String(item.user)]?.description || ''}
                          onChange={(event) => setResponsibilityDrafts({
                            ...responsibilityDrafts,
                            [String(item.user)]: {
                              ...responsibilityDrafts[String(item.user)],
                              description: event.target.value,
                            },
                          })}
                        />
                        <button type="button" className="tf-btn tf-btn-secondary tf-btn-sm" disabled={busy} onClick={() => updateAssignment(item.user)}>
                          Save Assignment
                        </button>
                      </div>
                    ) : (item.responsibility || item.description || 'Not specified')}
                  </td>
                  <td>{item.status?.replaceAll('_', ' ')}</td>
                  <td>{item.progress}%</td>
                  <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {myContribution && (
          <form className="tf-grid-form" onSubmit={saveContribution}>
            <div className="tf-form-group">
              <label htmlFor="own-responsibility">My responsibility</label>
              <input id="own-responsibility" className="tf-input" maxLength={300} value={contributionForm.responsibility || ''} onChange={(event) => setContributionForm({ ...contributionForm, responsibility: event.target.value })} />
            </div>
            <div className="tf-form-group">
              <label htmlFor="own-description">Responsibility details</label>
              <textarea id="own-description" className="tf-textarea" rows={2} maxLength={2000} value={contributionForm.description || ''} onChange={(event) => setContributionForm({ ...contributionForm, description: event.target.value })} />
            </div>
            <div className="tf-form-group">
              <label htmlFor="own-status">My status</label>
              <select id="own-status" className="tf-select" value={contributionForm.status || 'todo'} onChange={(event) => setContributionForm({ ...contributionForm, status: event.target.value })}>
                <option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="in_review">In Review</option><option value="done">Done</option>
              </select>
            </div>
            <div className="tf-form-group">
              <label htmlFor="own-progress">Progress (0–100%)</label>
              <input id="own-progress" className="tf-input" type="number" min="0" max="100" value={contributionForm.progress || 0} onChange={(event) => setContributionForm({ ...contributionForm, progress: event.target.value })} />
            </div>
            <div className="tf-form-group">
              <label htmlFor="own-notes">Completion notes</label>
              <textarea id="own-notes" className="tf-textarea" rows={2} maxLength={2000} value={contributionForm.completionNotes || ''} onChange={(event) => setContributionForm({ ...contributionForm, completionNotes: event.target.value })} />
            </div>
            <div className="tf-form-actions-bottom">
              <button type="submit" className="tf-btn tf-btn-primary" disabled={busy}>Save My Contribution</button>
            </div>
          </form>
        )}

      </div>

      {(task.submissions || []).length > 0 && (
        <div className="tf-card tf-task-details-card">
          <h3>Submission History</h3>
          {task.submissions.map((submission) => (
            <article className="tf-task-chat-message" key={submission.id || submission.version}>
              <strong>Version {submission.version} · {submission.decision?.replaceAll('_', ' ')}</strong>
              <small>{submission.submitter?.name || 'Team Member'} · {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : ''}</small>
              {submission.notes && <p>{submission.notes}</p>}
              {(submission.attachments || []).map((file) => (
                <a className="tf-attachment-chip tf-att-link" href={file.url} download={file.name} key={`${submission.version}-${file.name}`}>
                  <Paperclip size={13} /> {file.name}
                </a>
              ))}
              {submission.reviewComment && <p>Review: {submission.reviewComment}</p>}
            </article>
          ))}
        </div>
      )}

      <div className="tf-card tf-task-details-card">
        <div className="tf-card-title-row"><MessageSquare size={18} /><h3>Team Discussion</h3></div>
        {chatError && <p className="tf-text-danger">{chatError}</p>}
        <div className="tf-task-chat-messages" aria-live="polite">
          {messages.map((item) => (
            <article className="tf-task-chat-message" key={item.id}>
              <strong>{item.sender?.name || 'Team member'}</strong>
              <small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</small>
              <p>{item.message}</p>
            </article>
          ))}
          {chatLoading && <p className="tf-text-muted">Loading messages…</p>}
          {!chatLoading && !chatError && messages.length === 0 && <p className="tf-text-muted">No messages yet. Start coordinating here.</p>}
        </div>
        <form className="tf-task-chat-form" onSubmit={sendMessage}>
          <textarea className="tf-textarea" rows={2} maxLength={2000} value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Message your task team…" />
          <button className="tf-btn tf-btn-primary" type="submit" disabled={busy || !messageText.trim()}><Send size={15} /> Send</button>
        </form>
      </div>

      {myContribution && (
        <div className="tf-card tf-task-details-card">
          <h3>Submit Team Work</h3>
          {latestSubmission?.decision === 'pending' && <p className="tf-text-amber">A submission is awaiting Team Leader review.</p>}
          <form className="tf-grid-form" onSubmit={submitTeamWork}>
            <div className="tf-form-group tf-full-width">
              <label htmlFor="submission-summary">Contribution summary</label>
              <textarea id="submission-summary" className="tf-textarea" rows={3} maxLength={8000} value={submissionSummary} onChange={(event) => setSubmissionSummary(event.target.value)} placeholder="Leave blank to include the member work distribution summary." />
            </div>
            <div className="tf-form-group tf-full-width">
              <label htmlFor="submission-notes">Final notes</label>
              <textarea id="submission-notes" className="tf-textarea" rows={3} maxLength={4000} value={submissionNotes} onChange={(event) => setSubmissionNotes(event.target.value)} />
            </div>
            <div className="tf-form-group tf-full-width">
              <label htmlFor="submission-files">PDF or supporting files (up to three, 1 MB total)</label>
              <input id="submission-files" className="tf-input" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" onChange={(event) => setSubmissionFiles(Array.from(event.target.files || []))} />
            </div>
            <div className="tf-form-actions-bottom">
              <button className="tf-btn tf-btn-primary" type="submit" disabled={busy || latestSubmission?.decision === 'pending'}><Paperclip size={15} /> Submit to Team Leader</button>
            </div>
          </form>
        </div>
      )}

      {isLeader && latestSubmission && (
        <div className="tf-card tf-task-details-card">
          <div className="tf-card-title-row"><CheckCheck size={18} /><h3>Team Leader Review — Version {latestSubmission.version}</h3></div>
          <p>Submitted by {latestSubmission.submitter?.name || 'Team Member'} on {new Date(latestSubmission.submittedAt).toLocaleString()}</p>
          {latestSubmission.summary && <p className="tf-task-desc-box">{latestSubmission.summary}</p>}
          {latestSubmission.notes && <p><strong>Final notes:</strong> {latestSubmission.notes}</p>}
          {(latestSubmission.attachments || []).map((file) => (
            <a className="tf-attachment-chip tf-att-link" key={file.name} href={file.url} download={file.name}><Paperclip size={13} /> Download {file.name}</a>
          ))}
          {latestSubmission.decision === 'pending' ? (
            <>
              <label htmlFor="review-comment">Review comments</label>
              <textarea id="review-comment" className="tf-textarea" rows={3} maxLength={2000} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} />
              <div className="tf-action-buttons">
                <button type="button" className="tf-btn tf-btn-primary" disabled={busy} onClick={() => reviewSubmission('approve')}>Acknowledge and Complete</button>
                <button type="button" className="tf-btn tf-btn-secondary" disabled={busy || !reviewComment.trim()} onClick={() => reviewSubmission('changes_requested')}><RefreshCw size={14} /> Request Changes</button>
              </div>
            </>
          ) : (
            <p>Review decision: {latestSubmission.decision.replaceAll('_', ' ')}{latestSubmission.reviewComment ? ` — ${latestSubmission.reviewComment}` : ''}</p>
          )}
        </div>
      )}
    </section>
  );
}

export default SharedTaskWorkspace;
