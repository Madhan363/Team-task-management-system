import { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  ArrowLeft,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Play,
  Send,
  MessageSquare,
  Paperclip,
  Eye,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../api';
import SharedTaskWorkspace from '../common/SharedTaskWorkspace';

function MemberMyTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Active task details and action modals
  const [activeTask, setActiveTask] = useState(null);
  const [history, setHistory] = useState([]);
  const [responses, setResponses] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [commentModalTask, setCommentModalTask] = useState(null);
  const [submissionTask, setSubmissionTask] = useState(null);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submissionRequiresPdf, setSubmissionRequiresPdf] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentType, setCommentType] = useState('comment');
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getMyTasks({
        search,
        priority: priorityFilter,
        status: statusFilter,
      });
      setTasks(res.tasks || []);
    } catch (err) {
      setError(err.message || 'Failed to load your tasks.');
    } finally {
      setLoading(false);
    }
  }, [search, priorityFilter, statusFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Acknowledge Task Action
  const handleAcknowledge = async (taskId) => {
    setSubmittingAction(true);
    setError('');
    setNotice('');
    try {
      await api.acknowledgeTask(taskId);
      setNotice('Task successfully acknowledged! Your Team Leader was notified.');
      loadTasks();
    } catch (err) {
      setError(err.message || 'Failed to acknowledge task.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Start Task (Assigned -> In Progress)
  const handleStartTask = async (taskId) => {
    setSubmittingAction(true);
    setError('');
    setNotice('');
    try {
      await api.updateTaskStatus(taskId, 'in_progress', 'Started working on this task.');
      setNotice('Task status updated to In Progress.');
      loadTasks();
    } catch (err) {
      setError(err.message || 'Failed to start task.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit for Review (In Progress -> Submitted for Review)
  const handleSubmitForReview = (task, requirePdf = false) => {
    setSubmissionTask(task);
    setSubmissionFile(null);
    setSubmissionRequiresPdf(requirePdf);
    setSubmissionError('');
  };

  const submitForReview = async (event) => {
    event.preventDefault();
    if (!submissionTask) return;
    if (submissionRequiresPdf && !submissionFile) {
      setSubmissionError('Choose a PDF file to send to your Team Leader.');
      return;
    }

    setSubmittingAction(true);
    setSubmissionError('');
    try {
      let attachment = null;
      if (submissionFile) {
        attachment = {
          name: submissionFile.name,
          data: await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') resolve(reader.result);
              else reject(new Error('Could not read the selected PDF.'));
            };
            reader.onerror = () => reject(new Error('Could not read the selected PDF.'));
            reader.readAsDataURL(submissionFile);
          }),
        };
      }
      await api.updateTaskStatus(
        submissionTask.id,
        'submitted_review',
        'Submitted deliverable for Team Leader review.',
        attachment,
      );
      setSubmissionTask(null);
      setSubmissionFile(null);
      setSubmissionRequiresPdf(false);
      setNotice(attachment
        ? 'Task and PDF deliverable submitted for Team Leader review.'
        : 'Task submitted for review! Your Team Leader will evaluate the deliverable.');
      loadTasks();
    } catch (err) {
      setSubmissionError(err.message || 'Failed to submit task for review.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Comment / Clarification
  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!commentModalTask || !commentText.trim()) return;

    try {
      await api.addTaskResponse(commentModalTask.id, commentText.trim(), commentType);
      setCommentModalTask(null);
      setCommentText('');
      setNotice('Your comment/clarification was sent to your Team Leader.');
      loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to send comment.');
    }
  };

  // Show task details as a full-page view.
  const openDetails = async (task) => {
    setActiveTask(task);
    setHistory([]);
    setResponses([]);
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await api.getTaskHistory(task.id);
      setHistory(res.history || []);
      setResponses(res.responses || []);
    } catch (err) {
      setHistoryError(err.message || 'Failed to load task activity.');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="tf-page-container">
      <div className="tf-page-header">
        <div>
          <h2>My Assigned Tasks</h2>
          <p>
            Acknowledge assignments, advance execution status, add comments, and submit deliverables for review.
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

      {activeTask?.collaborationEnabled ? (
        <SharedTaskWorkspace
          task={activeTask}
          role="team_member"
          onClose={() => setActiveTask(null)}
          onUpdated={loadTasks}
        />
      ) : activeTask ? (
        <section className="tf-task-details-page">
          <div className="tf-page-header tf-task-details-header">
            <button
              type="button"
              className="tf-btn tf-btn-secondary"
              onClick={() => setActiveTask(null)}
            >
              <ArrowLeft size={16} /> Back to My Tasks
            </button>
            <div className="tf-modal-title-box">
              <span className={`tf-priority-tag tf-priority-${activeTask.priority}`}>
                {activeTask.priority}
              </span>
              <h2>{activeTask.title}</h2>
              {activeTask.project?.name && <small className="tf-task-project-label">Project: {activeTask.project.name}</small>}
            </div>
          </div>

          <div className="tf-card tf-task-details-card">
            <div className="tf-modal-details-grid">
              <div>
                <label>
                  {activeTask.assignedBy?.role === 'team_leader' ? 'Team Leader' : 'Assigned By'}
                </label>
                <span>{activeTask.assignedBy?.name || 'Team Leader'}</span>
              </div>
              <div>
                <label>Task Status</label>
                <span className={`tf-badge tf-status-${activeTask.status}`}>
                  {activeTask.status === 'submitted_review'
                    ? 'In Review'
                    : activeTask.status?.replace('_', ' ')}
                </span>
              </div>
              <div>
                <label>Acknowledgment</label>
                <span>
                  {activeTask.acknowledgmentStatus === 'acknowledged'
                    ? 'Acknowledged'
                    : 'Pending Acknowledgment'}
                </span>
              </div>
              <div>
                <label>Assigned Date</label>
                <span>
                  {activeTask.createdAt
                    ? new Date(activeTask.createdAt).toLocaleDateString()
                    : '—'}
                </span>
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
                <label>Project Description & Requirements</label>
                <p className="tf-task-desc-box">
                  {activeTask.description || 'No description provided.'}
                </p>
              </div>
            </div>

            {activeTask.attachments?.length > 0 && (
              <div className="tf-task-att-section">
                <label>Reference Materials & Attachments</label>
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

            <div className="tf-timeline-section">
              <h4>Audit History</h4>
              <div className="tf-timeline">
                {historyLoading ? (
                  <p className="tf-text-muted">Loading task activity…</p>
                ) : historyError ? (
                  <p className="tf-text-danger" role="alert">{historyError}</p>
                ) : history.length === 0 ? (
                  <p className="tf-text-muted">No timeline events recorded.</p>
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

            <div className="tf-comments-section">
              <h4>Discussion & Clarifications</h4>
              <div className="tf-responses-list">
                {historyLoading ? (
                  <p className="tf-text-muted">Loading responses…</p>
                ) : historyError ? (
                  <p className="tf-text-muted">Responses are unavailable because task activity failed to load.</p>
                ) : responses.length === 0 ? (
                  <p className="tf-text-muted">No comments or questions posted yet.</p>
                ) : (
                  responses.map((r) => (
                    <div key={r.id} className="tf-response-item">
                      <div className="tf-response-header">
                        <strong>{r.user?.name || 'User'}</strong>
                        <span className="tf-response-badge">{r.responseType}</span>
                        <span className="tf-response-time">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                      <p>{r.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
      <>
      {/* Filter Bar */}
      <div className="tf-card tf-table-card">
        <div className="tf-filter-bar">
          <div className="tf-search-box tf-member-tasks-search">
            <Search size={20} className="tf-search-icon" />
            <input
              type="text"
              className="tf-input tf-search-input"
              placeholder="Search your tasks…"
              aria-label="Search your assigned tasks"
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="submitted_review">Submitted for Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="tf-table-responsive">
          <table className="tf-table">
            <thead>
              <tr>
                <th>Task Title</th>
                <th>Assigned By</th>
                <th>Assigned Date</th>
                <th>Due Date</th>
                <th>Priority</th>
                <th>Ack Status</th>
                <th>Task Status</th>
                <th className="tf-th-actions">Available Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="tf-table-loading">
                    <RefreshCw size={20} className="tf-spin" />
                    <span>Loading your assignments…</span>
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="tf-table-empty">
                    <p>No tasks found.</p>
                    <span>When your Team Leader assigns you work, it will appear here.</span>
                  </td>
                </tr>
              ) : (
                tasks.map((t) => {
                  const isOverdue =
                    t.status !== 'completed' &&
                    t.dueDate &&
                    new Date(t.dueDate) < new Date();
                  const isPendingAck = t.acknowledgmentStatus === 'pending';

                  return (
                    <tr key={t.id}>
                      <td>
                        <button
                          type="button"
                          className="tf-task-title-link"
                          onClick={() => openDetails(t)}
                        >
                          {t.title}
                        </button>
                        {t.description && (
                          <p className="tf-table-desc-text">{t.description}</p>
                        )}
                        {t.attachments?.length > 0 && (
                          <div className="tf-table-att-count">
                            <Paperclip size={11} /> {t.attachments.length} attachment(s)
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="tf-leader-badge">
                          {t.assignedBy?.name || 'Team Leader'}
                        </span>
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
                        <div className="tf-action-buttons">
                          {/* 1. Acknowledge button if pending */}
                          {isPendingAck && (
                            <button
                              type="button"
                              className="tf-btn tf-btn-sm tf-btn-primary"
                              onClick={() => handleAcknowledge(t.id)}
                              disabled={submittingAction}
                              title="Acknowledge receipt of this task"
                            >
                              <CheckCircle size={14} /> Acknowledge
                            </button>
                          )}

                          {/* 2. Start Task button if assigned & acknowledged */}
                          {!isPendingAck && t.status === 'assigned' && (
                            <button
                              type="button"
                              className="tf-btn tf-btn-sm tf-btn-secondary"
                              onClick={() => handleStartTask(t.id)}
                              disabled={submittingAction}
                              title="Start working on this task"
                            >
                              <Play size={14} /> Start Task
                            </button>
                          )}

                          {/* 3. Submit for Review if in_progress */}
                          {!t.collaborationEnabled && t.status === 'in_progress' && (
                            <button
                              type="button"
                              className="tf-btn tf-btn-sm tf-btn-success"
                              onClick={() => handleSubmitForReview(t)}
                              disabled={submittingAction}
                              title="Submit deliverable for Team Leader review"
                            >
                              <Send size={14} /> Submit for Review
                            </button>
                          )}

                          {!t.collaborationEnabled && !isPendingAck && ['assigned', 'in_progress'].includes(t.status) && (
                            <button
                              type="button"
                              className="tf-btn tf-btn-sm tf-btn-success"
                              onClick={() => handleSubmitForReview(t, true)}
                              disabled={submittingAction}
                              title="Attach a PDF and send it to your Team Leader"
                            >
                              <Paperclip size={14} /> Send PDF
                            </button>
                          )}

                          {t.collaborationEnabled && (
                            <button
                              type="button"
                              className="tf-btn tf-btn-sm tf-btn-primary"
                              onClick={() => openDetails(t)}
                            >
                              Open Workspace
                            </button>
                          )}

                          {/* 4. Add Comment / Clarification */}
                          <button
                            type="button"
                            className="tf-icon-action-btn"
                            title="Add comment or clarification"
                            onClick={() => {
                              setCommentModalTask(t);
                              setCommentText('');
                              setCommentType('comment');
                            }}
                          >
                            <MessageSquare size={16} />
                          </button>

                          {/* 5. View Details */}
                          <button
                            type="button"
                            className="tf-icon-action-btn"
                            title="View details & timeline"
                            onClick={() => openDetails(t)}
                          >
                            <Eye size={16} />
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
      </>
      )}

      {/* COMMENT / CLARIFICATION MODAL */}
      {commentModalTask && (
        <div className="taskflow-modal-overlay" onClick={() => setCommentModalTask(null)}>
          <div className="taskflow-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="taskflow-modal-header">
              <h3>Post Response: {commentModalTask.title}</h3>
            </div>
            <form onSubmit={handleSendComment}>
              <div className="taskflow-modal-body">
                <div className="tf-form-group">
                  <label>Response Type</label>
                  <select
                    className="tf-select"
                    value={commentType}
                    onChange={(e) => setCommentType(e.target.value)}
                  >
                    <option value="comment">Progress Update / Comment</option>
                    <option value="clarification">Request Clarification / Question</option>
                  </select>
                </div>
                <div className="tf-form-group">
                  <label>Message</label>
                  <textarea
                    className="tf-textarea"
                    rows={4}
                    placeholder="Enter your progress update or request clarification from your Team Leader…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="taskflow-modal-actions">
                <button
                  type="button"
                  className="tf-btn tf-btn-secondary"
                  onClick={() => setCommentModalTask(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="tf-btn tf-btn-primary">
                  <Send size={14} /> Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {submissionTask && (
        <div className="taskflow-modal-overlay" onClick={() => !submittingAction && setSubmissionTask(null)}>
          <div className="taskflow-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="taskflow-modal-header">
              <h3>{submissionRequiresPdf ? 'Send PDF to Team Leader' : 'Submit for Review'}: {submissionTask.title}</h3>
            </div>
            <form onSubmit={submitForReview}>
              <div className="taskflow-modal-body">
                <p>{submissionRequiresPdf
                  ? 'Choose a PDF deliverable to send to your Team Leader for review.'
                  : 'Optionally attach a PDF deliverable for your Team Leader to review.'}</p>
                {submissionError && (
                  <div className="tf-alert tf-alert-error" role="alert">
                    <AlertCircle size={18} />
                    <span>{submissionError}</span>
                  </div>
                )}
                <div className="tf-form-group">
                  <label htmlFor="task-deliverable-pdf">PDF Deliverable</label>
                  <input
                    id="task-deliverable-pdf"
                    type="file"
                    className="tf-input"
                    accept="application/pdf,.pdf"
                    required={submissionRequiresPdf}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (file && (file.type !== 'application/pdf' || file.size > 1_048_576)) {
                        setSubmissionFile(null);
                        setSubmissionError('Choose a PDF file that is 1 MB or smaller.');
                        event.target.value = '';
                        return;
                      }
                      setSubmissionError('');
                      setSubmissionFile(file);
                    }}
                  />
                  <span className="tf-form-help">PDF only, up to 1 MB. You can submit without an attachment.</span>
                </div>
              </div>
              <div className="taskflow-modal-actions">
                <button
                  type="button"
                  className="tf-btn tf-btn-secondary"
                  onClick={() => setSubmissionTask(null)}
                  disabled={submittingAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tf-btn tf-btn-success"
                  disabled={submittingAction || (submissionRequiresPdf && !submissionFile)}
                >
                  <Send size={14} /> {submittingAction
                    ? 'Submitting…'
                    : submissionRequiresPdf ? 'Send PDF to Team Leader' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default MemberMyTasksPage;
