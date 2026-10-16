import { useState, useEffect, useCallback } from 'react';
import {
  BellRing,
  CheckCircle,
  Clock,
  HelpCircle,
  MessageSquare,
  Paperclip,
  RefreshCw,
  AlertCircle,
  CheckCheck,
  Send,
} from 'lucide-react';
import { api } from '../../api';

function MemberAcknowledgmentsPage({ onNavigateTab }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Clarification Modal
  const [clarifyingTask, setClarifyingTask] = useState(null);
  const [questionText, setQuestionText] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadPendingTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getMyTasks({ ack: 'pending' });
      // Only keep non-completed pending ack tasks
      const pending = (res.tasks || []).filter(
        (t) => t.acknowledgmentStatus === 'pending' && t.status !== 'completed',
      );
      setTasks(pending);
    } catch (err) {
      setError(err.message || 'Failed to load tasks awaiting acknowledgment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingTasks();
  }, [loadPendingTasks]);

  // Acknowledge Task
  const handleAcknowledge = async (taskId) => {
    setSubmittingAction(true);
    setError('');
    setNotice('');
    try {
      await api.acknowledgeTask(taskId);
      setNotice('Task acknowledged successfully! Acknowledgment timestamp recorded and Team Leader notified.');
      loadPendingTasks();
    } catch (err) {
      setError(err.message || 'Failed to acknowledge task.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Clarification Request
  const handleSendClarification = async (e) => {
    e.preventDefault();
    if (!clarifyingTask || !questionText.trim()) return;

    setSubmittingAction(true);
    try {
      await api.addTaskResponse(clarifyingTask.id, questionText.trim(), 'clarification');
      setNotice('Clarification request sent to your Team Leader.');
      setClarifyingTask(null);
      setQuestionText('');
      loadPendingTasks();
    } catch (err) {
      alert(err.message || 'Failed to send clarification request.');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="tf-page-container">
      <div className="tf-page-header">
        <div>
          <h2>Task Acknowledgments</h2>
          <p>
            Review newly assigned work and confirm receipt. Acknowledging establishes delivery accountability
            and notifies your Team Leader that work has commenced.
          </p>
        </div>
        <button
          type="button"
          className="tf-btn tf-btn-secondary"
          onClick={loadPendingTasks}
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
          <CheckCheck size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* Cards List for Pending Acknowledgments */}
      <div className="tf-ack-cards-container">
        {loading ? (
          <div className="tf-loading-box">
            <RefreshCw size={24} className="tf-spin" />
            <p>Loading pending assignments…</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="tf-card tf-empty-card">
            <CheckCircle size={48} className="tf-empty-success-icon" />
            <h3>All Caught Up!</h3>
            <p>You have acknowledged all tasks currently assigned to you.</p>
            <button
              type="button"
              className="tf-btn tf-btn-primary"
              onClick={() => onNavigateTab?.('tasks')}
            >
              Go to My Tasks
            </button>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="tf-card tf-ack-card">
              <div className="tf-ack-card-top">
                <div className="tf-ack-title-col">
                  <div className="tf-ack-badges-row">
                    <span className="tf-badge tf-badge-amber">
                      <Clock size={12} /> Acknowledgment Required
                    </span>
                    <span className={`tf-priority-tag tf-priority-${task.priority}`}>
                      {task.priority} Priority
                    </span>
                  </div>
                  <h3>{task.title}</h3>
                </div>

                <div className="tf-ack-assigned-info">
                  <span className="tf-subtext">Assigned by:</span>
                  <strong>{task.assignedBy?.name || 'Team Leader'}</strong>
                  <span className="tf-subtext">
                    {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>

              {task.description && (
                <div className="tf-ack-desc">
                  <p>{task.description}</p>
                </div>
              )}

              <div className="tf-ack-meta-row">
                <div className="tf-ack-due">
                  <span className="tf-subtext">Target Deadline:</span>
                  <strong>
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline specified'}
                  </strong>
                </div>

                {task.attachments?.length > 0 && (
                  <div className="tf-attachments-chips">
                    {task.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="tf-attachment-chip tf-att-link"
                      >
                        <Paperclip size={12} /> {att.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="tf-ack-actions-footer">
                <button
                  type="button"
                  className="tf-btn tf-btn-secondary"
                  onClick={() => {
                    setClarifyingTask(task);
                    setQuestionText('');
                  }}
                  disabled={submittingAction}
                >
                  <HelpCircle size={16} /> Request Clarification
                </button>

                <button
                  type="button"
                  className="tf-btn tf-btn-primary"
                  onClick={() => handleAcknowledge(task.id)}
                  disabled={submittingAction}
                >
                  <CheckCircle size={16} /> Acknowledge Task
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CLARIFICATION MODAL */}
      {clarifyingTask && (
        <div className="taskflow-modal-overlay" onClick={() => setClarifyingTask(null)}>
          <div className="taskflow-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="taskflow-modal-header">
              <h3>Request Clarification: {clarifyingTask.title}</h3>
            </div>
            <form onSubmit={handleSendClarification}>
              <div className="taskflow-modal-body">
                <p>
                  Submit a clarification question directly to{' '}
                  <strong>{clarifyingTask.assignedBy?.name || 'your Team Leader'}</strong>{' '}
                  before or alongside acknowledging this task.
                </p>
                <div className="tf-form-group">
                  <label htmlFor="clarify-msg">Question / Clarification Request *</label>
                  <textarea
                    id="clarify-msg"
                    className="tf-textarea"
                    rows={4}
                    placeholder="Describe what requirements, scope, or timeline details need clarification…"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="taskflow-modal-actions">
                <button
                  type="button"
                  className="tf-btn tf-btn-secondary"
                  onClick={() => setClarifyingTask(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tf-btn tf-btn-primary"
                  disabled={submittingAction}
                >
                  <Send size={14} /> Send Clarification Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemberAcknowledgmentsPage;
