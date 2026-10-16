import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ListTodo,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  CheckCheck,
  RotateCcw,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  Paperclip,
  Send,
  Calendar,
  ArrowLeft,
} from 'lucide-react';
import { api } from '../../api';
import SharedTaskWorkspace from '../common/SharedTaskWorkspace';

function getWorkDistributionRows(task) {
  const contributions = task.contributions || [];
  const memberIds = new Set(contributions.map((item) => String(item.user?._id || item.user)));
  const assignedMembers = task.assignees?.length
    ? task.assignees
    : [task.assignee || task.assignedTo].filter(Boolean);
  const missingContributions = assignedMembers
    .filter((member) => !memberIds.has(String(member.id || member._id)))
    .map((member) => ({
      user: member.id || member._id,
      member: { name: member.name },
      responsibility: '',
      description: '',
      completionNotes: '',
      status: 'not_recorded',
      progress: null,
      updatedAt: null,
    }));
  return [...contributions, ...missingContributions];
}

function LeaderTaskTrackingPage() {
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [ackFilter, setAckFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Modals State
  const [activeTask, setActiveTask] = useState(null);
  const [selectedContributionId, setSelectedContributionId] = useState(null);
  const [history, setHistory] = useState([]);
  const [responses, setResponses] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewingTaskId, setReviewingTaskId] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRefreshInFlight = useRef(false);
  const workDistribution = activeTask ? getWorkDistributionRows(activeTask) : [];

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getTeamTasks({
        search,
        priority: priorityFilter,
        status: statusFilter,
      });
      setTasks(res.tasks || []);
    } catch (err) {
      setError(err.message || 'Failed to load tracked tasks.');
    } finally {
      setLoading(false);
    }
  }, [search, priorityFilter, statusFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!activeTask || activeTask.collaborationEnabled) return undefined;
    let active = true;
    const refreshTaskDetails = async () => {
      if (detailRefreshInFlight.current) return;
      detailRefreshInFlight.current = true;
      try {
        const result = await api.getTask(activeTask.id);
        if (active) {
          setActiveTask((current) => (current?.id === result.task.id ? result.task : current));
          setDetailError('');
        }
      } catch (refreshError) {
        if (active) setDetailError(refreshError.message || 'Task contributions could not be refreshed.');
      } finally {
        detailRefreshInFlight.current = false;
      }
    };
    const timer = window.setInterval(refreshTaskDetails, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeTask?.id, activeTask?.collaborationEnabled]);

  // Load Task History and Responses
  const openTaskDetails = async (task) => {
    setActiveTask(task);
    setSelectedContributionId(null);
    setDetailError('');
    setNewMessage('');
    setHistory([]);
    setResponses([]);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const res = await api.getTaskHistory(task.id);
      setHistory(res.history || []);
      setResponses(res.responses || []);
    } catch (err) {
      setHistoryError(err.message || 'Failed to load this task’s history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Add Comment / Response
  const handleSendResponse = async (e) => {
    e.preventDefault();
    if (!activeTask || !newMessage.trim()) return;

    try {
      await api.addTaskResponse(activeTask.id, newMessage.trim(), 'comment');
      setNewMessage('');
      // Refresh history & list
      const res = await api.getTaskHistory(activeTask.id);
      setHistory(res.history || []);
      setResponses(res.responses || []);
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to send comment.');
    }
  };

  // Handle Review (Approve or Request Changes)
  const handleReviewDecision = async (taskId, decision) => {
    setSubmittingAction(true);
    setError('');
    try {
      await api.reviewTask(taskId, decision, reviewComment.trim());
      setReviewingTaskId(null);
      setReviewComment('');
      setNotice(
        decision === 'approve'
          ? 'Task approved and marked as Completed!'
          : 'Changes requested. Task returned to In Progress.',
      );
      if (activeTask && activeTask.id === taskId) {
        setActiveTask(null);
      }
      loadTasks();
    } catch (err) {
      setError(err.message || 'Failed to process review.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Filter tasks locally by acknowledgment status if needed
  const filteredTasks = tasks.filter((t) => {
    if (ackFilter && ackFilter !== 'all') {
      if (t.acknowledgmentStatus !== ackFilter) return false;
    }
    return true;
  });

  return (
    <div className="tf-page-container">
      {!activeTask && (
        <>
      <div className="tf-page-header">
        <div>
          <h2>Task Tracking & Deliverable Review</h2>
          <p>
            Monitor individual assignments, track acknowledgments, and review submitted deliverables.
          </p>
        </div>
        <button
          type="button"
          className="tf-btn tf-btn-secondary"
          onClick={loadTasks}
        >
          <RefreshCw size={14} className={loading ? 'tf-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="tf-alert tf-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="tf-alert tf-alert-success" role="status">
          <span>{notice}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="tf-card tf-table-card">
        <div className="tf-filter-bar">
          <div className="tf-search-box tf-task-tracking-search">
            <Search size={20} className="tf-search-icon" />
            <input
              type="text"
              className="tf-input tf-search-input"
              placeholder="Search by task title or member name…"
              aria-label="Search tasks by title or assigned member name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="tf-filter-group">
            <select
              className="tf-select tf-filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="critical">Critical Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            <select
              className="tf-select tf-filter-select"
              value={ackFilter}
              onChange={(e) => setAckFilter(e.target.value)}
            >
              <option value="">All Acknowledgment States</option>
              <option value="pending">Pending Acknowledgment</option>
              <option value="acknowledged">Acknowledged</option>
            </select>

            <select
              className="tf-select tf-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Task Stages</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="submitted_review">Submitted for Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Task Tracking Table */}
        <div className="tf-table-responsive">
          <table className="tf-table">
            <thead>
              <tr>
                <th>Task Title</th>
                <th>Assigned Member</th>
                <th>Assigned Date</th>
                <th>Due Date</th>
                <th>Priority</th>
                <th>Acknowledgment</th>
                <th>Stage Status</th>
                <th>Last Updated</th>
                <th className="tf-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="tf-table-loading">
                    <RefreshCw size={20} className="tf-spin" />
                    <span>Loading tracked assignments…</span>
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="tf-table-empty">
                    <p>No department tasks found matching current filters.</p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const isOverdue =
                    t.status !== 'completed' &&
                    t.dueDate &&
                    new Date(t.dueDate) < new Date();

                  return (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.title}</strong>
                        {t.attachments?.length > 0 && (
                          <div className="tf-table-att-count">
                            <Paperclip size={11} /> {t.attachments.length} attachment(s)
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="tf-table-user-cell">
                          <div className="tf-avatar tf-avatar-sm">
                            <span>
                              {(t.assignee?.name || t.assignedTo?.name || 'U')
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <button
                              type="button"
                              className="tf-link-btn tf-member-task-link"
                              onClick={() => openTaskDetails(t)}
                              aria-label={`View ${t.assignee?.name || t.assignedTo?.name || 'unassigned member'} task and progress`}
                            >
                              {t.assignee?.name || t.assignedTo?.name || 'Unassigned'}
                            </button>
                            <span className="tf-subtext">{t.assignee?.username || 'user'}</span>
                            {t.collaborationEnabled && (
                              <span className="tf-subtext">Shared with {t.assignees?.length || 0} members</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {t.createdAt
                          ? new Date(t.createdAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        {t.dueDate ? (
                          <span className={isOverdue ? 'tf-text-danger tf-overdue-tag' : ''}>
                            {new Date(t.dueDate).toLocaleDateString()}
                            {isOverdue && ' (Overdue)'}
                          </span>
                        ) : (
                          'No deadline'
                        )}
                      </td>
                      <td>
                        <span className={`tf-priority-tag tf-priority-${t.priority}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td>
                        {t.acknowledgmentStatus === 'acknowledged' ? (
                          <span className="tf-badge tf-badge-green">
                            <CheckCircle size={12} /> Acknowledged
                          </span>
                        ) : (
                          <span className="tf-badge tf-badge-amber">
                            <Clock size={12} /> Pending Ack
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`tf-badge tf-status-${t.status}`}>
                          {t.status === 'submitted_review'
                            ? 'In Review'
                            : t.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {t.updatedAt
                          ? new Date(t.updatedAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        <div className="tf-action-buttons">
                          <button
                            type="button"
                            className="tf-icon-action-btn"
                            title="View details & timeline"
                            onClick={() => openTaskDetails(t)}
                          >
                            <Eye size={16} />
                          </button>

                          {/* Quick review action if submitted */}
                          {t.status === 'submitted_review' && (
                            <button
                              type="button"
                              className="tf-btn tf-btn-sm tf-btn-success"
                              onClick={() => {
                                setReviewingTaskId(t.id);
                                setReviewComment('');
                              }}
                              title="Review deliverable"
                            >
                              Review
                            </button>
                          )}
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
        </>
      )}

      {/* REVIEW DELIVERABLE MODAL */}
      {reviewingTaskId && (
        <div className="taskflow-modal-overlay" onClick={() => setReviewingTaskId(null)}>
          <div className="taskflow-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="taskflow-modal-header">
              <h3>Review Submitted Work</h3>
            </div>
            <div className="taskflow-modal-body">
              <p>
                Provide evaluation feedback for this deliverable. You can approve and mark it as
                officially Completed, or request changes (which returns the task to In Progress).
              </p>
              <div className="tf-form-group">
                <label>Feedback / Review Comments (Optional)</label>
                <textarea
                  className="tf-textarea"
                  rows={3}
                  placeholder="Enter constructive feedback or notes regarding the review decision…"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
              </div>
            </div>
            <div className="taskflow-modal-actions">
              <button
                type="button"
                className="tf-btn tf-btn-secondary"
                onClick={() => setReviewingTaskId(null)}
                disabled={submittingAction}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tf-btn tf-btn-warn"
                onClick={() => handleReviewDecision(reviewingTaskId, 'changes_requested')}
                disabled={submittingAction}
              >
                <RotateCcw size={16} /> Request Changes
              </button>
              <button
                type="button"
                className="tf-btn tf-btn-success"
                onClick={() => handleReviewDecision(reviewingTaskId, 'approve')}
                disabled={submittingAction}
              >
                <CheckCheck size={16} /> Approve as Completed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TASK DETAILS & TIMELINE */}
      {activeTask?.collaborationEnabled && (
        <SharedTaskWorkspace
          task={activeTask}
          role="team_leader"
          onClose={() => setActiveTask(null)}
          onUpdated={loadTasks}
        />
      )}

      {activeTask && !activeTask.collaborationEnabled && (
        <section className="tf-task-details-page">
            <div className="tf-page-header tf-task-details-header">
              <button
                type="button"
                className="tf-btn tf-btn-secondary"
                onClick={() => setActiveTask(null)}
              >
                <ArrowLeft size={16} /> Back to Task Tracking
              </button>
              <div className="tf-modal-title-box">
                <span className={`tf-priority-tag tf-priority-${activeTask.priority}`}>
                  {activeTask.priority}
                </span>
                <h2>{activeTask.title}</h2>
                {activeTask.project?.name && <small className="tf-task-project-label">Project: {activeTask.project.name}</small>}
              </div>
            </div>

            {detailError && <div className="tf-alert tf-alert-error" role="alert">{detailError}</div>}

            <div className="tf-card tf-task-details-card">
              <div className="tf-modal-details-grid">
                <div>
                  <label>Assigned Member</label>
                  <span>{activeTask.assignee?.name || activeTask.assignedTo?.name || 'Unassigned'}</span>
                </div>
                <div>
                  <label>Stage Status</label>
                  <span className={`tf-badge tf-status-${activeTask.status}`}>
                    {activeTask.status?.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <label>Acknowledgment Status</label>
                  <div className="tf-task-ack-detail">
                    <span>
                      {activeTask.acknowledgmentStatus === 'acknowledged'
                        ? 'Acknowledged'
                        : 'Pending'}
                    </span>
                    {activeTask.acknowledgedAt && (
                      <small>
                        {new Date(activeTask.acknowledgedAt).toLocaleString()}
                      </small>
                    )}
                  </div>
                </div>
                <div>
                  <label>Due Date</label>
                  <span>
                    {activeTask.dueDate
                      ? new Date(activeTask.dueDate).toLocaleDateString()
                      : 'No deadline'}
                  </span>
                </div>
                <div className="tf-full-width">
                  <label>Description & Requirements</label>
                  <p className="tf-task-desc-box">{activeTask.description || 'No description provided.'}</p>
                </div>
              </div>

              <div className="tf-task-att-section">
                <h3>Work Distribution</h3>
                <div className="tf-table-responsive">
                  <table className="tf-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Responsibility</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workDistribution.map((contribution) => (
                        <tr key={String(contribution.user)}>
                          <td>
                            <button
                              type="button"
                              className="tf-link-btn"
                              onClick={() => setSelectedContributionId((current) => (
                                current === String(contribution.user) ? null : String(contribution.user)
                              ))}
                              aria-expanded={selectedContributionId === String(contribution.user)}
                            >
                              {contribution.member?.name || 'Team member'}
                            </button>
                          </td>
                          <td>{contribution.responsibility || 'Not specified'}</td>
                          <td>{contribution.status?.replaceAll('_', ' ') || 'todo'}</td>
                          <td>{contribution.progress == null ? '—' : `${contribution.progress}%`}</td>
                          <td>{contribution.updatedAt ? new Date(contribution.updatedAt).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                      {!workDistribution.length && (
                        <tr>
                          <td colSpan={5} className="tf-table-empty">No members are assigned to this task.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {selectedContributionId && (() => {
                  const contribution = workDistribution.find(
                    (item) => String(item.user) === selectedContributionId,
                  );
                  return contribution ? (
                    <div className="tf-task-desc-box" aria-live="polite">
                      <strong>{contribution.member?.name || 'Team member'}’s contribution</strong>
                      <p>{contribution.status === 'not_recorded'
                        ? 'No individual contribution details have been recorded for this assignment yet.'
                        : contribution.description || 'No additional responsibility details.'}</p>
                      {contribution.completionNotes && <p><strong>Completion notes:</strong> {contribution.completionNotes}</p>}
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Attachments */}
              {activeTask.attachments?.length > 0 && (
                <div className="tf-task-att-section">
                  <label>Attachments & References</label>
                  <div className="tf-attachments-chips">
                    {activeTask.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="tf-attachment-chip tf-att-link"
                      >
                        <Paperclip size={12} /> {att.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="tf-task-att-section">
                <label>Submitted PDF Deliverables</label>
                {historyLoading ? (
                  <p className="tf-text-muted">Loading submitted files…</p>
                ) : responses.some((response) => response.attachments?.length > 0) ? (
                  <div className="tf-submitted-pdf-list">
                    {responses.flatMap((response) => (
                      (response.attachments || []).map((attachment, index) => (
                        <div className="tf-submitted-pdf" key={`${response.id}-${index}`}>
                          <div className="tf-submitted-pdf-header">
                            <div>
                              <strong>{attachment.name}</strong>
                              <span>
                                Submitted by {response.user?.name || 'Team Member'}
                                {response.createdAt && ` · ${new Date(response.createdAt).toLocaleString()}`}
                              </span>
                            </div>
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="tf-attachment-chip tf-att-link"
                            >
                              <Paperclip size={12} /> Open PDF
                            </a>
                          </div>
                          <iframe
                            className="tf-submitted-pdf-preview"
                            src={attachment.url}
                            title={`Submitted PDF: ${attachment.name}`}
                          />
                        </div>
                      ))
                    ))}
                  </div>
                ) : (
                  <p className="tf-text-muted">No PDF deliverables submitted for this task.</p>
                )}
              </div>

              {/* Review actions for submitted work */}
              {activeTask.status === 'submitted_review' && (
                <div className="tf-review-callout">
                  <div>
                    <strong>Work Submitted for Review</strong>
                    <p>Review the completed assignment and choose an action:</p>
                  </div>
                  <div className="tf-review-callout-buttons">
                    <button
                      type="button"
                      className="tf-btn tf-btn-sm tf-btn-warn"
                      onClick={() => {
                        setReviewComment('');
                        setReviewingTaskId(activeTask.id);
                      }}
                    >
                      <RotateCcw size={14} /> Request Changes
                    </button>
                    <button
                      type="button"
                      className="tf-btn tf-btn-sm tf-btn-success"
                      onClick={() => {
                        setReviewComment('');
                        setReviewingTaskId(activeTask.id);
                      }}
                    >
                      <CheckCheck size={14} /> Approve Work
                    </button>
                  </div>
                </div>
              )}

              {/* Activity History Timeline */}
              <div className="tf-timeline-section">
                <h4>Day-by-Day Task Progress</h4>
                <div className="tf-timeline">
                  {historyLoading ? (
                    <p className="tf-text-muted">Loading task progress…</p>
                  ) : historyError ? (
                    <p className="tf-text-danger" role="alert">{historyError}</p>
                  ) : history.length === 0 ? (
                    <p className="tf-text-muted">No historical events recorded.</p>
                  ) : (
                    history.map((h) => (
                      <div key={h.id} className="tf-timeline-item">
                        <div className="tf-timeline-dot" />
                        <div className="tf-timeline-content">
                          <div className="tf-timeline-header">
                            <strong>{h.changedBy?.name || 'System'}</strong>
                            <span className="tf-timeline-time">
                              {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}
                            </span>
                          </div>
                          {h.oldStatus && h.newStatus && (
                            <div className="tf-timeline-transition">
                              Stage: <code>{h.oldStatus}</code> → <code>{h.newStatus}</code>
                            </div>
                          )}
                          {h.comment && <p className="tf-timeline-comment">{h.comment}</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Communication / Comments Section */}
              <div className="tf-comments-section">
                <h4>Discussion & Feedback ({responses.length})</h4>
                <div className="tf-responses-list">
                  {responses.map((r) => (
                    <div key={r.id} className="tf-response-item">
                      <div className="tf-response-header">
                        <strong>{r.user?.name || 'User'}</strong>
                        <span className="tf-response-badge">{r.responseType}</span>
                        <span className="tf-response-time">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                      <p>{r.message}</p>
                      {r.attachments?.length > 0 && (
                        <div className="tf-attachments-chips">
                          {r.attachments.map((attachment, index) => (
                            <a
                              key={`${r.id}-${index}`}
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="tf-attachment-chip tf-att-link"
                            >
                              <Paperclip size={12} /> {attachment.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendResponse} className="tf-comment-form">
                  <input
                    type="text"
                    className="tf-input"
                    placeholder="Add leader comment, guidance, or response…"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <button type="submit" className="tf-btn tf-btn-primary tf-btn-sm">
                    <Send size={14} /> Send
                  </button>
                </form>
              </div>
            </div>
        </section>
      )}
    </div>
  );
}

export default LeaderTaskTrackingPage;
