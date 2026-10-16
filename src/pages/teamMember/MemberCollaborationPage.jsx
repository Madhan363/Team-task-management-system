import { useCallback, useEffect, useState } from 'react';
import { FolderKanban, RefreshCw, Search } from 'lucide-react';
import { api } from '../../api';
import SharedTaskWorkspace from '../common/SharedTaskWorkspace';

function progressOf(task) {
  if (task.status === 'completed') return 100;
  const contributions = task.contributions || [];
  return contributions.length
    ? Math.round(contributions.reduce((sum, item) => sum + Number(item.progress || 0), 0) / contributions.length)
    : 0;
}

function hasPublishedTaskId(task) {
  return task.status !== 'draft' && /^[a-f\d]{24}$/i.test(String(task.id || ''));
}

function MemberCollaborationPage() {
  const [projects, setProjects] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getProjects();
      setProjects(response.projects || []);
    } catch (loadError) {
      setError(loadError.message || 'Projects could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const visibleProjects = projects.filter((project) => {
    const query = search.trim().toLowerCase();
    if (query && !`${project.name} ${project.description} ${project.sourceName}`.toLowerCase().includes(query)) return false;
    return !status || project.status === status;
  });

  return (
    <div className="tf-page-container">
      {activeTask ? (
        <SharedTaskWorkspace
          task={activeTask}
          role="team_member"
          onClose={() => setActiveTask(null)}
          onUpdated={loadProjects}
        />
      ) : (
        <>
          <div className="tf-page-header">
            <div>
              <h2>Team Collaboration</h2>
              <p>Published projects and tasks assigned to you or shared with your team.</p>
            </div>
            <button type="button" className="tf-btn tf-btn-secondary" onClick={loadProjects} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'tf-spin' : ''} /> Refresh
            </button>
          </div>
          {error && <div className="tf-alert tf-alert-error" role="alert">{error}</div>}
          <section className="tf-card tf-project-import-panel">
            <div className="tf-project-import-published-heading">
              <div>
                <h3><FolderKanban size={18} /> My Department Projects</h3>
                <span>Project details are shared by your department; task details are limited to your assignments.</span>
              </div>
            </div>
            <div className="tf-project-filters tf-member-project-filters">
              <label className="tf-search-box">
                <Search size={16} className="tf-search-icon" />
                <input
                  className="tf-input tf-search-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search projects"
                  aria-label="Search projects"
                />
              </label>
              <select className="tf-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter projects by status">
                <option value="">All project statuses</option>
                {['Published', 'In Progress', 'Completed'].map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            {loading ? (
              <p className="tf-text-muted">Loading projects…</p>
            ) : (
              <div className="tf-project-card-list">
                {visibleProjects.map((project) => (
                  <article className="tf-project-card" key={project.id}>
                    <div className="tf-project-card-header">
                      <div>
                        <div className="tf-project-card-title">
                          <h5>{project.name}</h5>
                          <span className={`tf-project-status tf-project-status-${project.status.toLowerCase().replaceAll(' ', '-')}`}>{project.status}</span>
                        </div>
                        <p>{project.description || 'No project description'}</p>
                        <small>{project.sourceName} · {project.taskCount} assigned task{project.taskCount === 1 ? '' : 's'}</small>
                      </div>
                    </div>
                    <div className="tf-project-card-meta">
                      <span>{project.members.length} collaborator{project.members.length === 1 ? '' : 's'}</span>
                      <strong>{project.overallProgress}% complete</strong>
                      <div className="tf-project-progress-track" role="progressbar" aria-valuenow={project.overallProgress} aria-valuemin="0" aria-valuemax="100">
                        <span style={{ width: `${project.overallProgress}%` }} />
                      </div>
                      <button
                        type="button"
                        className="tf-btn tf-btn-secondary tf-btn-sm"
                        onClick={() => setExpanded((current) => ({ ...current, [project.id]: !current[project.id] }))}
                      >
                        {expanded[project.id] ? 'Hide Tasks' : 'View Tasks'}
                      </button>
                    </div>
                    {expanded[project.id] && (
                      <div className="tf-project-card-tasks">
                        {project.tasks.map((task) => (
                          <article className="tf-project-card-task" key={task.id}>
                            <div>
                              <strong>{task.title}</strong>
                              <p>{task.description || 'No task description'}</p>
                              <small>Start {task.startDate ? new Date(task.startDate).toLocaleDateString() : 'No date'} · Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</small>
                            </div>
                            <span className={`tf-priority-tag tf-priority-${task.priority}`}>{task.priority}</span>
                            <div className="tf-project-task-members">
                              {task.assignees.map((member) => (
                                <span className="tf-project-member-chip" key={member.id}>
                                  {member.profileImage
                                    ? <img src={member.profileImage} alt="" />
                                    : <span className="tf-project-avatar-fallback">{member.name?.slice(0, 1) || '?'}</span>}
                                  {member.name || member.username}
                                </span>
                              ))}
                            </div>
                            <span>{task.status?.replaceAll('_', ' ')} · {progressOf(task)}%</span>
                            {hasPublishedTaskId(task) ? (
                              <button type="button" className="tf-link-btn" onClick={() => setActiveTask(task)}>Open task workspace</button>
                            ) : <small>Workspace available after project publication.</small>}
                          </article>
                        ))}
                        {!project.tasks.length && <p className="tf-text-muted">No tasks in this project are assigned to you.</p>}
                      </div>
                    )}
                  </article>
                ))}
                {!visibleProjects.length && (
                  <p className="tf-text-muted">
                    {projects.length
                      ? 'No projects match your filters.'
                      : 'No published projects are available yet. Projects and their assignments appear here after your Team Leader publishes them.'}
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default MemberCollaborationPage;
