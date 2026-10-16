import { useState, useEffect, useCallback } from 'react';
import {
  History,
  CheckCircle,
  Clock,
  RotateCcw,
  MessageSquare,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../api';

function MemberTaskHistoryPage() {
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [history, setHistory] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');

  // Load user's tasks
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getMyTasks();
      const myTasks = res.tasks || [];
      setTasks(myTasks);
      if (myTasks.length > 0 && !selectedTaskId) {
        setSelectedTaskId(myTasks[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load task history.');
    } finally {
      setLoading(false);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Load history for selected task
  useEffect(() => {
    if (!selectedTaskId) return;
    let active = true;
    setHistoryLoading(true);
    api.getTaskHistory(selectedTaskId)
      .then((res) => {
        if (active) {
          setHistory(res.history || []);
          setResponses(res.responses || []);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => { active = false; };
  }, [selectedTaskId]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="tf-page-container">
      <div className="tf-page-header">
        <div>
          <h2>Task Audit Trail & Activity History</h2>
          <p>
            Chronological log of state transitions, acknowledgment timestamps, leader reviews, and deliverable iterations.
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

      <div className="tf-history-layout">
        {/* Left Column: Task Selector */}
        <div className="tf-card tf-history-sidebar">
          <div className="tf-card-header">
            <h3>Select Task</h3>
            <span className="tf-card-subtitle">{tasks.length} tasks recorded</span>
          </div>

          <div className="tf-history-task-list">
            {tasks.length === 0 ? (
              <p className="tf-text-muted tf-p-4">No tasks found.</p>
            ) : (
              tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={`tf-history-task-btn ${selectedTaskId === task.id ? 'tf-active' : ''}`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="tf-task-btn-title">{task.title}</div>
                  <div className="tf-task-btn-meta">
                    <span className={`tf-priority-tag tf-priority-${task.priority}`}>
                      {task.priority}
                    </span>
                    <span className={`tf-badge tf-status-${task.status}`}>
                      {task.status?.replace('_', ' ')}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Timeline & Discussion Feed */}
        <div className="tf-card tf-history-main">
          {selectedTask ? (
            <>
              <div className="tf-card-header tf-table-header-row">
                <div>
                  <h3>{selectedTask.title}</h3>
                  <span className="tf-card-subtitle">
                    Assigned by {selectedTask.assignedBy?.name || 'Leader'} • Status: {selectedTask.status?.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {historyLoading ? (
                <div className="tf-loading-box">
                  <RefreshCw size={24} className="tf-spin" />
                  <p>Loading audit timeline…</p>
                </div>
              ) : (
                <div className="tf-history-body">
                  <div className="tf-timeline-section">
                    <h4>Timeline Transitions</h4>
                    <div className="tf-timeline">
                      {history.length === 0 ? (
                        <p className="tf-text-muted">No historical transitions recorded for this task.</p>
                      ) : (
                        history.map((item) => (
                          <div key={item.id} className="tf-timeline-item">
                            <div className="tf-timeline-dot" />
                            <div className="tf-timeline-content">
                              <div className="tf-timeline-header">
                                <strong>{item.changedBy?.name || 'User'}</strong>
                                <span className="tf-timeline-time">
                                  {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                                </span>
                              </div>
                              {item.oldStatus && item.newStatus && (
                                <div className="tf-timeline-transition">
                                  State changed: <code>{item.oldStatus}</code> → <code>{item.newStatus}</code>
                                </div>
                              )}
                              {item.comment && (
                                <p className="tf-timeline-comment">{item.comment}</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Feedback / Discussion */}
                  <div className="tf-comments-section tf-mt-6">
                    <h4>Communication Thread ({responses.length})</h4>
                    <div className="tf-responses-list">
                      {responses.length === 0 ? (
                        <p className="tf-text-muted">No comments posted yet.</p>
                      ) : (
                        responses.map((r) => (
                          <div key={r.id} className="tf-response-item">
                            <div className="tf-response-header">
                              <strong>{r.user?.name || 'Participant'}</strong>
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
              )}
            </>
          ) : (
            <div className="tf-table-empty">
              <p>Select a task from the list to view its audit history.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MemberTaskHistoryPage;
