import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  FileSpreadsheet,
  FolderKanban,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '../../api';
import ConfirmModal from '../../components/ConfirmModal';

const DRAFT_STORAGE_KEY = 'taskflow.project-import-draft';

const FIELD_LABELS = {
  projectName: 'Project Name',
  projectDescription: 'Project Description',
  title: 'Task Title',
  description: 'Task Description',
  priority: 'Priority',
  startDate: 'Start Date',
  dueDate: 'Due Date',
};

function dateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function displayDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'No date';
}

function hasPublishedTaskId(task) {
  return task.status !== 'draft' && /^[a-f\d]{24}$/i.test(String(task.id || ''));
}

function importErrorMessage(error, fallback) {
  if (error.status === 403 && /team_leader/i.test(error.message || '')) {
    return 'The server does not recognize this session as a Team Leader. Ask an administrator to verify this account’s role and department, then sign out and sign back in. The draft has not been changed.';
  }
  return error.message || fallback;
}

function taskProgress(task) {
  if (task.status === 'completed') return 100;
  const contributions = task.contributions || [];
  return contributions.length
    ? Math.round(contributions.reduce((total, item) => total + Number(item.progress || 0), 0) / contributions.length)
    : 0;
}

function MemberAvatar({ member }) {
  return member.profileImage
    ? <img className="tf-project-avatar" src={member.profileImage} alt="" title={member.name} />
    : <span className="tf-project-avatar tf-project-avatar-fallback" title={member.name}>{member.name?.slice(0, 1)?.toUpperCase() || '?'}</span>;
}

function ProjectImportPanel({ onOpenTask, onPublished, refreshToken = 0 }) {
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [draft, setDraft] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [memberSearch, setMemberSearch] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});
  const [stage, setStage] = useState('upload');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deletingProject, setDeletingProject] = useState(false);

  const loadProjects = useCallback(async () => {
    const result = await api.getProjects();
    setProjects(result.projects || []);
  }, []);

  const loadDraft = useCallback(async (draftId) => {
    const savedDraft = await api.getProjectImportDraft(draftId);
    const nextAssignments = {};
    (savedDraft.assignments || []).forEach((assignment) => {
      nextAssignments[assignment.rowNumber] = assignment.members.map((item) => ({
        memberId: item.memberId,
        responsibility: item.responsibility || '',
        description: item.description || '',
      }));
    });
    setDraft(savedDraft);
    setAssignments(nextAssignments);
    setStage(savedDraft.validationErrors?.length ? 'preview' : 'assign');
    window.localStorage.setItem(DRAFT_STORAGE_KEY, savedDraft.draftId);
  }, []);

  useEffect(() => {
    loadProjects().catch((loadError) => setError(loadError.message || 'Unable to load projects.'));
  }, [loadProjects, refreshToken]);

  useEffect(() => {
    let active = true;
    api.getProjectImportMembers()
      .then((memberResult) => {
        if (!active) return;
        setMembers(memberResult.members || []);
      })
      .catch((loadError) => {
        if (active) setError(importErrorMessage(loadError, 'Unable to load department projects and members.'));
      });
    const savedDraftId = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraftId) {
      loadDraft(savedDraftId).catch((draftError) => {
        if (draftError.status === 404) {
          window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
        setError(importErrorMessage(draftError, 'The saved draft could not be loaded.'));
      });
    }
    return () => { active = false; };
  }, [loadDraft]);

  const clearActiveDraft = () => {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    setDraft(null);
    setAssignments({});
    setStage('upload');
  };

  const handleWorkbook = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setNotice('');
    if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
      setError('Choose an .xlsx workbook no larger than 5 MB.');
      return;
    }
    setLoading(true);
    try {
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The selected workbook could not be read.'));
        reader.readAsDataURL(file);
      });
      const preview = await api.previewProjectImport(file.name, fileData);
      setDraft(preview);
      setAssignments({});
      setStage('preview');
      window.localStorage.setItem(DRAFT_STORAGE_KEY, preview.draftId);
      setNotice(`${preview.rows.length} spreadsheet row${preview.rows.length === 1 ? '' : 's'} loaded from ${file.name}. Review and correct rows before assignment.`);
      await loadProjects();
    } catch (uploadError) {
      setError(uploadError.message || 'The workbook could not be validated.');
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (rowNumber, field, value) => {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => row.rowNumber === rowNumber
        ? {
          ...row,
          [field]: value,
          formulaFields: (row.formulaFields || []).filter((column) => column !== ({
            projectName: 'project name',
            projectDescription: 'project description',
            title: 'task title',
            description: 'task description',
            priority: 'priority',
            startDate: 'start date',
            dueDate: 'due date',
          })[field]),
        }
        : row),
    }));
  };

  const removeRow = (rowNumber) => {
    setDraft((current) => ({
      ...current,
      rows: current.rows.filter((row) => row.rowNumber !== rowNumber),
    }));
  };

  const validateCorrections = async () => {
    setError('');
    setSaving(true);
    try {
      const result = await api.saveProjectImportRows(draft.draftId, draft.rows);
      setDraft((current) => ({ ...current, ...result }));
      setAssignments({});
      if (result.validationErrors.length) {
        setError('Correct the highlighted rows or remove them, then validate again.');
      } else {
        setStage('assign');
        setNotice('Spreadsheet validation passed. Assign members to each task.');
      }
      await loadProjects();
    } catch (validationError) {
      setError(validationError.message || 'The corrected preview could not be validated.');
    } finally {
      setSaving(false);
    }
  };

  const toggleMember = (rowNumber, memberId, checked) => {
    setAssignments((current) => {
      const currentMembers = current[rowNumber] || [];
      return {
        ...current,
        [rowNumber]: checked
          ? [...currentMembers, { memberId, responsibility: '', description: '' }]
          : currentMembers.filter((item) => item.memberId !== memberId),
      };
    });
  };

  const updateAssignment = (rowNumber, memberId, field, value) => {
    setAssignments((current) => ({
      ...current,
      [rowNumber]: (current[rowNumber] || []).map((item) => (
        item.memberId === memberId ? { ...item, [field]: value } : item
      )),
    }));
  };

  const persistAssignments = async ({ requireComplete }) => {
    const missingRows = draft.tasks
      .filter((task) => !(assignments[task.rowNumber] || []).length)
      .map((task) => task.rowNumber);
    if (requireComplete && missingRows.length) {
      setError(`Assign at least one member to every task. Missing rows: ${missingRows.join(', ')}.`);
      return false;
    }
    setError('');
    setSaving(true);
    try {
      const payload = Object.entries(assignments)
        .filter(([, selected]) => selected.length)
        .map(([rowNumber, selected]) => ({ rowNumber: Number(rowNumber), members: selected }));
      await api.saveProjectImportAssignments(draft.draftId, payload);
      return true;
    } catch (saveError) {
      setError(importErrorMessage(saveError, 'Assignments could not be saved.'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (stage === 'preview' && draft.validationErrors?.length) {
      setError('Correct spreadsheet errors before saving this draft.');
      return;
    }
    const saved = await persistAssignments({ requireComplete: false });
    if (!saved) return;
    setNotice('Draft and current assignments are saved. Continue it later from the project list.');
    clearActiveDraft();
    await loadProjects();
  };

  const continueToConfirmation = async () => {
    const saved = await persistAssignments({ requireComplete: true });
    if (saved) {
      setStage('confirm');
      setNotice('Review the project groups and assignments before publishing.');
    }
  };

  const cancelImport = async () => {
    if (!draft) return;
    setCancelling(true);
    setError('');
    try {
      await api.cancelProjectImportDraft(draft.draftId);
      clearActiveDraft();
      setNotice('Import cancelled and its draft removed.');
      await loadProjects();
    } catch (cancelError) {
      setError(cancelError.message || 'The import draft could not be cancelled.');
    } finally {
      setCancelling(false);
    }
  };

  const publish = async () => {
    setError('');
    setPublishing(true);
    try {
      const result = await api.publishProjectImport(draft.draftId);
      clearActiveDraft();
      setNotice(`Published ${result.projects.length} project${result.projects.length === 1 ? '' : 's'} successfully.`);
      await loadProjects();
      onPublished?.();
    } catch (publishError) {
      setError(importErrorMessage(publishError, 'The project could not be published.'));
    } finally {
      setPublishing(false);
    }
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete || deletingProject) return;
    const project = projectToDelete;
    setDeletingProject(true);
    setError('');
    try {
      if (project.status === 'Draft') {
        await api.cancelProjectImportDraft(project.draftId);
        if (draft?.draftId === project.draftId) clearActiveDraft();
      } else {
        await api.deleteProject(project.id);
      }
      setProjectToDelete(null);
      setNotice(`"${project.name}" was deleted.`);
      await loadProjects();
      onPublished?.();
    } catch (deleteError) {
      setError(deleteError.message || `The project "${project.name}" could not be deleted.`);
    } finally {
      setDeletingProject(false);
    }
  };

  const rowErrors = useMemo(() => {
    const grouped = new Map();
    (draft?.validationErrors || []).forEach((item) => {
      const list = grouped.get(item.row) || [];
      list.push(item);
      grouped.set(item.row, list);
    });
    return grouped;
  }, [draft?.validationErrors]);

  const filteredProjects = projects.filter((project) => {
    const term = search.trim().toLowerCase();
    if (term && !`${project.name} ${project.description} ${project.sourceName}`.toLowerCase().includes(term)) return false;
    if (statusFilter && project.status !== statusFilter) return false;
    if (priorityFilter && !project.tasks.some((task) => task.priority === priorityFilter)) return false;
    if (memberFilter && !project.members.some((member) => member.id === memberFilter)) return false;
    return true;
  });

  const draftCards = (draft?.projects || []).map((project) => ({
    id: `${draft.draftId}-${project.key}`,
    draftId: draft.draftId,
    key: project.key,
    name: project.name,
    status: 'Draft',
  }));

  return (
    <section className="tf-card tf-project-import-panel" aria-labelledby="project-import-heading">
      <div className="tf-project-import-heading">
        <div>
          <h3 id="project-import-heading"><FolderKanban size={18} /> Team Collaboration Projects</h3>
          <p>Import Excel projects into the existing task collaboration, assignment, and review workflow.</p>
        </div>
        <label className={`tf-btn tf-btn-primary tf-project-upload-button ${draft ? 'tf-btn-disabled' : ''}`}>
          <Upload size={15} />
          {loading ? 'Validating…' : 'Import Excel'}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleWorkbook}
            disabled={loading || saving || publishing || Boolean(draft)}
            aria-label="Import project from Excel workbook"
          />
        </label>
      </div>

      {error && <div className="tf-alert tf-alert-error" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
      {notice && <div className="tf-alert tf-alert-success" role="status">{notice}</div>}

      {draft && (
        <div className="tf-project-import-draft">
          <div className="tf-project-import-title">
            <div>
              <strong>{draft.rows?.length || 0} rows · {draft.projects?.length || 0} project groups</strong>
              <span>{draft.sourceName || 'Excel workbook'} · Draft remains private until publication.</span>
            </div>
            <button type="button" className="tf-btn tf-btn-secondary tf-btn-sm" onClick={cancelImport} disabled={cancelling || saving || publishing}>
              <Trash2 size={14} /> {cancelling ? 'Cancelling…' : 'Cancel import'}
            </button>
          </div>

          {stage === 'preview' && (
            <>
              <h4>Import preview and validation</h4>
              <p className="tf-form-help">Edit spreadsheet values below or remove a row. Project names group matching rows into separate projects.</p>
              {draft.validationErrors?.length > 0 && (
                <div className="tf-project-validation-errors" role="alert">
                  {draft.validationErrors.map((item, index) => (
                    <p key={`${item.row}-${item.column}-${index}`}>
                      Row {item.row || 'Workbook'} · {item.column}: {item.message}
                    </p>
                  ))}
                </div>
              )}
              <div className="tf-project-preview-rows">
                {draft.rows?.map((row) => (
                  <article className={`tf-project-import-task ${(rowErrors.get(row.rowNumber) || []).length ? 'tf-project-row-invalid' : ''}`} key={row.rowNumber}>
                    <div className="tf-project-task-summary">
                      <strong>Excel row {row.rowNumber}</strong>
                      {(rowErrors.get(row.rowNumber) || []).map((item, index) => (
                        <small className="tf-text-danger" key={`${item.column}-${index}`}>{item.column}: {item.message}</small>
                      ))}
                    </div>
                    <div className="tf-project-preview-fields">
                      {Object.entries(FIELD_LABELS).map(([field, label]) => (
                        <label key={field}>
                          <span>{label}</span>
                          {field === 'priority' ? (
                            <select className="tf-select" value={row[field] || ''} onChange={(event) => updateRow(row.rowNumber, field, event.target.value)}>
                              <option value="">Select priority</option>
                              {['high', 'medium', 'low', 'critical'].map((priority) => (
                                <option value={priority} key={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>
                              ))}
                            </select>
                          ) : field === 'description' || field === 'projectDescription' ? (
                            <textarea className="tf-textarea" rows={2} value={row[field] || ''} onChange={(event) => updateRow(row.rowNumber, field, event.target.value)} />
                          ) : (
                            <input
                              className="tf-input"
                              type={field === 'startDate' || field === 'dueDate' ? 'date' : 'text'}
                              maxLength={field === 'title' ? 120 : field === 'projectName' ? 120 : undefined}
                              value={field === 'startDate' || field === 'dueDate' ? dateInput(row[field]) : (row[field] || '')}
                              onChange={(event) => updateRow(row.rowNumber, field, event.target.value)}
                            />
                          )}
                        </label>
                      ))}
                    </div>
                    <button type="button" className="tf-btn tf-btn-secondary tf-btn-sm" onClick={() => removeRow(row.rowNumber)}>Remove row</button>
                  </article>
                ))}
              </div>
              <div className="tf-project-confirm-actions">
                <button type="button" className="tf-btn tf-btn-secondary" onClick={cancelImport} disabled={saving || cancelling}>Cancel import</button>
                <button type="button" className="tf-btn tf-btn-primary" onClick={validateCorrections} disabled={saving || !draft.rows?.length}>
                  {saving ? 'Validating…' : 'Validate preview & assign members'}
                </button>
              </div>
            </>
          )}

          {stage === 'assign' && (
            <>
              <h4>Assign department members</h4>
              <p className="tf-form-help">Select one or more active members for each task. A responsibility may be entered for each person.</p>
              {draft.projects.map((project) => (
                <div className="tf-project-assignment-group" key={project.key}>
                  <h5>{project.name}</h5>
                  <p>{project.description || 'No project description'}</p>
                  {draft.tasks.filter((task) => task.projectKey === project.key).map((task) => (
                    <article className="tf-project-import-task" key={task.rowNumber}>
                      <div className="tf-project-task-summary">
                        <strong>Row {task.rowNumber}: {task.title}</strong>
                        <span className={`tf-priority-tag tf-priority-${task.priority}`}>{task.priority}</span>
                        <small>Start {displayDate(task.startDate)} · Due {displayDate(task.dueDate)}</small>
                        {task.description && <p>{task.description}</p>}
                      </div>
                      <input
                        className="tf-input tf-project-member-search"
                        placeholder="Search department members"
                        aria-label={`Search members for ${task.title}`}
                        value={memberSearch[task.rowNumber] || ''}
                        onChange={(event) => setMemberSearch((current) => ({ ...current, [task.rowNumber]: event.target.value }))}
                      />
                      <div className="tf-project-member-choices">
                        {members.filter((member) => `${member.name} ${member.username} ${member.department}`.toLowerCase()
                          .includes((memberSearch[task.rowNumber] || '').toLowerCase()))
                          .map((member) => {
                            const selected = (assignments[task.rowNumber] || []).find((item) => item.memberId === member.id);
                            return (
                              <div className="tf-project-member-assignment" key={`${task.rowNumber}-${member.id}`}>
                                <label className="tf-project-member-label">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(selected)}
                                    onChange={(event) => toggleMember(task.rowNumber, member.id, event.target.checked)}
                                  />
                                  <MemberAvatar member={member} />
                                  <span>{member.name}<small>{member.username} · {member.department}</small></span>
                                </label>
                                {selected && (
                                  <div className="tf-project-responsibility-fields">
                                    <input
                                      className="tf-input"
                                      maxLength={300}
                                      placeholder="Responsibility (optional)"
                                      aria-label={`${member.name} responsibility for ${task.title}`}
                                      value={selected.responsibility}
                                      onChange={(event) => updateAssignment(task.rowNumber, member.id, 'responsibility', event.target.value)}
                                    />
                                    <textarea
                                      className="tf-textarea"
                                      rows={2}
                                      maxLength={2000}
                                      placeholder="Responsibility details (optional)"
                                      aria-label={`${member.name} responsibility details for ${task.title}`}
                                      value={selected.description}
                                      onChange={(event) => updateAssignment(task.rowNumber, member.id, 'description', event.target.value)}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        {!members.length && <p className="tf-text-muted">No active members are available in your department.</p>}
                      </div>
                    </article>
                  ))}
                </div>
              ))}
              <div className="tf-project-confirm-actions">
                <button type="button" className="tf-btn tf-btn-secondary" onClick={saveDraft} disabled={saving || publishing}>
                  {saving ? 'Saving…' : 'Save as Draft'}
                </button>
                <button type="button" className="tf-btn tf-btn-primary" onClick={continueToConfirmation} disabled={saving || !members.length}>
                  {saving ? 'Saving assignments…' : 'Save assignments & review'}
                </button>
              </div>
            </>
          )}

          {stage === 'confirm' && (
            <>
              <h4>Confirm project publication</h4>
              <p className="tf-form-help">Every project and task will be saved before assigned members are notified.</p>
              {draft.projects.map((project) => (
                <div className="tf-project-assignment-group" key={project.key}>
                  <h5>{project.name}</h5>
                  <p>{project.description || 'No project description'}</p>
                  {draft.tasks.filter((task) => task.projectKey === project.key).map((task) => (
                    <article className="tf-project-import-task tf-project-confirm-task" key={task.rowNumber}>
                      <strong>{task.title}</strong>
                      <span className={`tf-priority-tag tf-priority-${task.priority}`}>{task.priority}</span>
                      <small>Due {displayDate(task.dueDate)}</small>
                      <ul className="tf-project-confirm-members">
                        {(assignments[task.rowNumber] || []).map((item) => {
                          const member = members.find((candidate) => candidate.id === item.memberId);
                          return <li key={`${task.rowNumber}-${item.memberId}`}>{member?.name || 'Member'}{item.responsibility ? ` — ${item.responsibility}` : ''}</li>;
                        })}
                      </ul>
                    </article>
                  ))}
                </div>
              ))}
              <div className="tf-project-confirm-actions">
                <button type="button" className="tf-btn tf-btn-secondary" onClick={() => setStage('assign')} disabled={publishing}>Edit assignments</button>
                <button type="button" className="tf-btn tf-btn-secondary" onClick={saveDraft} disabled={publishing || saving}>Save as Draft</button>
                <button type="button" className="tf-btn tf-btn-primary" onClick={publish} disabled={publishing}>
                  {publishing ? 'Publishing…' : 'Publish Projects'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="tf-project-import-published">
        <div className="tf-project-import-published-heading">
          <div>
            <h4><FileSpreadsheet size={16} /> Projects</h4>
            <span>{projects.length} project{projects.length === 1 ? '' : 's'}</span>
          </div>
          <button type="button" className="tf-btn tf-btn-secondary tf-btn-sm" onClick={() => loadProjects().catch((loadError) => setError(loadError.message))}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <div className="tf-project-filters">
          <label className="tf-search-box">
            <Search size={16} className="tf-search-icon" />
            <input className="tf-input tf-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects or source files" />
          </label>
          <select className="tf-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All project statuses</option>
            {['Draft', 'Published', 'In Progress', 'Completed'].map((status) => <option key={status}>{status}</option>)}
          </select>
          <select className="tf-select" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="">All task priorities</option>
            {['high', 'medium', 'low', 'critical'].map((priority) => <option value={priority} key={priority}>{priority}</option>)}
          </select>
          <select className="tf-select" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}>
            <option value="">All members</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </div>
        <div className="tf-project-card-list">
          {filteredProjects.map((project) => {
            const expanded = expandedProjects[project.id] ?? false;
            return (
              <article className="tf-project-card" key={project.id}>
                <div className="tf-project-card-header">
                  <div>
                    <div className="tf-project-card-title">
                      <h5>{project.name}</h5>
                      <span className={`tf-project-status tf-project-status-${project.status.toLowerCase().replaceAll(' ', '-')}`}>{project.status}</span>
                    </div>
                    <p>{project.description || 'No project description'}</p>
                    <small>{project.sourceName || 'Imported Excel workbook'} · {project.taskCount} task{project.taskCount === 1 ? '' : 's'} · {project.department || 'Department'}</small>
                  </div>
                  <div className="tf-project-card-actions">
                    {project.status === 'Draft' && (
                      <button type="button" className="tf-btn tf-btn-secondary tf-btn-sm" onClick={() => loadDraft(project.draftId).catch((draftError) => setError(importErrorMessage(draftError, 'The saved draft could not be loaded.')))}>
                        Continue draft
                      </button>
                    )}
                    <button
                      type="button"
                      className="tf-btn tf-btn-danger tf-btn-sm"
                      onClick={() => setProjectToDelete(project)}
                      aria-label={`Delete ${project.name} project`}
                      disabled={deletingProject}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
                <div className="tf-project-card-meta">
                  <div className="tf-project-avatar-stack">
                    {project.members.slice(0, 6).map((member) => <MemberAvatar member={member} key={member.id} />)}
                    {!project.members.length && <small>No members assigned</small>}
                  </div>
                  <span>{project.members.length} member{project.members.length === 1 ? '' : 's'}</span>
                  <strong>{project.overallProgress}%</strong>
                  <div className="tf-project-progress-track" role="progressbar" aria-valuenow={project.overallProgress} aria-valuemin="0" aria-valuemax="100">
                    <span style={{ width: `${project.overallProgress}%` }} />
                  </div>
                  <button type="button" className="tf-btn tf-btn-secondary tf-btn-sm" onClick={() => setExpandedProjects((current) => ({ ...current, [project.id]: !expanded }))}>
                    {expanded ? 'Hide Tasks' : 'View Tasks'}
                  </button>
                </div>
                {expanded && (
                  <div className="tf-project-card-tasks">
                    {project.tasks.map((task) => (
                      <article className="tf-project-card-task" key={task.id}>
                        <div>
                          <strong>{task.title}</strong>
                          <p>{task.description || 'No task description'}</p>
                          <small>Start {displayDate(task.startDate)} · Due {displayDate(task.dueDate)}</small>
                        </div>
                        <span className={`tf-priority-tag tf-priority-${task.priority}`}>{task.priority}</span>
                        <div className="tf-project-task-members">
                          {task.assignees.map((member) => (
                            <span className="tf-project-member-chip" key={member.id}>
                              {member.profileImage ? <img src={member.profileImage} alt="" /> : <span className="tf-project-avatar-fallback">{member.name?.slice(0, 1) || '?'}</span>}
                              {member.name || member.username}
                            </span>
                          ))}
                          {!task.assignees.length && <small>Unassigned</small>}
                        </div>
                        <span>{task.status?.replaceAll('_', ' ')} · {taskProgress(task)}%</span>
                        {hasPublishedTaskId(task) && onOpenTask ? (
                          <button type="button" className="tf-link-btn" onClick={() => onOpenTask(task)}>Open task workspace</button>
                        ) : <small>Workspace available after project publication.</small>}
                      </article>
                    ))}
                    {!project.tasks.length && <p className="tf-text-muted">No tasks are available for this project.</p>}
                  </div>
                )}
              </article>
            );
          })}
          {!filteredProjects.length && <p className="tf-text-muted">No projects match these filters.</p>}
        </div>
      </div>
      <ConfirmModal
        isOpen={Boolean(projectToDelete)}
        title={projectToDelete?.status === 'Draft' ? 'Delete project draft?' : 'Delete project?'}
        message={projectToDelete?.status === 'Draft'
          ? `This will permanently remove the draft "${projectToDelete?.name}" and its import data.`
          : `Delete "${projectToDelete?.name}" and remove it from the active project list? Its tasks will be hidden from active workspaces; stored task history and audit records are retained.`}
        confirmText={deletingProject ? 'Deleting…' : 'Delete project'}
        isDestructive
        onConfirm={confirmDeleteProject}
        onCancel={() => !deletingProject && setProjectToDelete(null)}
      />
    </section>
  );
}

export default ProjectImportPanel;
