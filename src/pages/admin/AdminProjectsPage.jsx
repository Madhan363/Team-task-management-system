import { useCallback, useEffect, useState } from 'react';
import { FolderKanban, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../../api';
import ConfirmModal from '../../components/ConfirmModal';

function AdminProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  const deleteProject = async () => {
    if (!projectToDelete || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await api.deleteProject(projectToDelete.id);
      setNotice(`"${projectToDelete.name}" was deleted.`);
      setProjectToDelete(null);
      await loadProjects();
    } catch (deleteError) {
      setError(deleteError.message || `The project "${projectToDelete.name}" could not be deleted.`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="tf-page-container">
      <div className="tf-page-header">
        <div>
          <h2>Team Collaboration Projects</h2>
          <p>Review published department projects and remove projects when required.</p>
        </div>
        <button type="button" className="tf-btn tf-btn-secondary" onClick={loadProjects} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'tf-spin' : ''} /> Refresh
        </button>
      </div>
      {error && <div className="tf-alert tf-alert-error" role="alert">{error}</div>}
      {notice && <div className="tf-alert tf-alert-success" role="status">{notice}</div>}
      <section className="tf-card tf-project-import-panel">
        <div className="tf-project-import-published-heading">
          <div>
            <h3><FolderKanban size={18} /> Projects</h3>
            <span>{projects.length} project{projects.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        {loading ? (
          <p className="tf-text-muted">Loading projects…</p>
        ) : (
          <div className="tf-project-card-list">
            {projects.map((project) => (
              <article className="tf-project-card" key={project.id}>
                <div className="tf-project-card-header">
                  <div>
                    <div className="tf-project-card-title">
                      <h5>{project.name}</h5>
                      <span className={`tf-project-status tf-project-status-${project.status.toLowerCase().replaceAll(' ', '-')}`}>
                        {project.status}
                      </span>
                    </div>
                    <p>{project.description || 'No project description'}</p>
                    <small>{project.sourceName || 'Imported project'} · {project.taskCount} task{project.taskCount === 1 ? '' : 's'} · {project.department || 'Department'}</small>
                  </div>
                  <div className="tf-project-card-actions">
                    <button
                      type="button"
                      className="tf-btn tf-btn-danger tf-btn-sm"
                      onClick={() => setProjectToDelete(project)}
                      disabled={deleting}
                      aria-label={`Delete ${project.name} project`}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
                <div className="tf-project-card-meta">
                  <span>{project.members.length} member{project.members.length === 1 ? '' : 's'}</span>
                  <strong>{project.overallProgress}% complete</strong>
                  <div
                    className="tf-project-progress-track"
                    role="progressbar"
                    aria-valuenow={project.overallProgress}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    <span style={{ width: `${project.overallProgress}%` }} />
                  </div>
                </div>
              </article>
            ))}
            {!projects.length && <p className="tf-text-muted">No published projects found.</p>}
          </div>
        )}
      </section>
      <ConfirmModal
        isOpen={Boolean(projectToDelete)}
        title="Delete project?"
        message={`Delete "${projectToDelete?.name}" and remove it from active project lists? Its tasks will be hidden from active workspaces; stored task history and audit records are retained.`}
        confirmText={deleting ? 'Deleting…' : 'Delete project'}
        isDestructive
        onConfirm={deleteProject}
        onCancel={() => !deleting && setProjectToDelete(null)}
      />
    </div>
  );
}

export default AdminProjectsPage;
