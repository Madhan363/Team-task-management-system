import { useState, useEffect } from 'react';
import {
  PlusCircle,
  AlertCircle,
  CheckCircle,
  CalendarDays,
} from 'lucide-react';
import { api } from '../../api';

function LeaderAssignTaskPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [responsibilities, setResponsibilities] = useState({});
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [referenceFiles, setReferenceFiles] = useState([]);

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberLoadError, setMemberLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const allMembersSelected = members.length > 0
    && members.every((member) => selectedMemberIds.includes(member.id));

  useEffect(() => {
    let active = true;
    api.getTeamLeaderDashboard()
      .then((res) => {
        if (active) {
          setMembers((res.members || []).filter((member) => member.isActive !== false));
          setMemberLoadError('');
        }
      })
      .catch((err) => {
        if (active) setMemberLoadError(err.message || 'Failed to load team members.');
      })
      .finally(() => {
        if (active) setLoadingMembers(false);
      });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!title.trim()) {
      setFormError('Please enter a task title.');
      return;
    }
    if (selectedMemberIds.length < 2) {
      setFormError('Select at least two team members to create a shared task.');
      return;
    }
    if (startDate && dueDate && dueDate < startDate) {
      setFormError('The due date must be the same as or later than the start date.');
      return;
    }
    const allowedFileTypes = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'];
    if (referenceFiles.length > 5
      || referenceFiles.some((file) => !allowedFileTypes.includes(file.type))
      || referenceFiles.reduce((total, file) => total + file.size, 0) > 1_048_576) {
      setFormError('Choose up to five PDF, PNG, JPEG, or TXT reference files totaling no more than 1 MB.');
      return;
    }

    setSubmitting(true);
    try {
      const assignees = members.filter((member) => selectedMemberIds.includes(member.id));
      const attachments = await Promise.all(referenceFiles.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, url: reader.result });
        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
        reader.readAsDataURL(file);
      })));
      await api.createTask({
        title: title.trim(),
        description: description.trim(),
        assignedMemberIds: selectedMemberIds,
        contributions: selectedMemberIds.map((userId) => ({
          userId,
          responsibility: responsibilities[userId]?.responsibility || '',
          description: responsibilities[userId]?.description || '',
        })),
        priority,
        startDate: startDate || null,
        dueDate: dueDate || null,
        attachments,
      });

      setTitle('');
      setDescription('');
      setSelectedMemberIds([]);
      setResponsibilities({});
      setPriority('medium');
      setStartDate('');
      setDueDate('');
      setReferenceFiles([]);

      setFormSuccess(`Shared task successfully assigned to ${assignees.length} team members.`);
    } catch (err) {
      setFormError(err.message || 'Failed to assign task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tf-page-container">
      <div className="tf-page-header">
        <div>
          <h2>Create Shared Team Task</h2>
          <p>
            Assign one shared task to at least two members of your department, then coordinate their responsibilities in its workspace.
          </p>
        </div>
      </div>

      <div className="tf-card tf-form-card">
        <div className="tf-card-header">
          <div className="tf-card-title-row">
            <PlusCircle size={20} className="tf-accent-icon" />
            <h3>Task Assignment Details</h3>
          </div>
        </div>

        {formError && (
          <div className="tf-alert tf-alert-error" role="alert">
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}

        {memberLoadError && (
          <div className="tf-alert tf-alert-error" role="alert">
            <AlertCircle size={18} />
            <span>{memberLoadError}</span>
          </div>
        )}

        {formSuccess && (
          <div className="tf-alert tf-alert-success" role="status">
            <CheckCircle size={18} />
            <span>{formSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="tf-grid-form">
          <div className="tf-form-group tf-full-width">
            <label htmlFor="task-title">Task Title *</label>
            <input
              id="task-title"
              type="text"
              className="tf-input"
              placeholder="e.g. Design Responsive Navigation Component"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group tf-full-width">
            <label htmlFor="task-desc">Task Description & Requirements</label>
            <textarea
              id="task-desc"
              className="tf-textarea"
              rows={4}
              placeholder="Specify the deliverable expectations, instructions, and review criteria…"
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="tf-form-group">
            <div className="tf-assignment-header">
              <label>Assign To Members (select at least two) *</label>
              <button
                type="button"
                className="tf-btn tf-btn-secondary tf-btn-sm"
                onClick={() => setSelectedMemberIds(allMembersSelected ? [] : members.map((member) => member.id))}
                disabled={loadingMembers || members.length === 0}
                aria-pressed={allMembersSelected}
              >
                {allMembersSelected ? 'Clear All' : 'Select All'}
              </button>
            </div>
            <div className="tf-member-checklist" role="group" aria-label="Team members">
              {members.map((member) => (
                <label className="tf-member-checklist-item" key={member.id}>
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(member.id)}
                    onChange={(event) => {
                      setSelectedMemberIds((currentIds) => (
                        event.target.checked
                          ? [...currentIds, member.id]
                          : currentIds.filter((id) => id !== member.id)
                      ));
                      setResponsibilities((current) => ({
                        ...current,
                        [member.id]: current[member.id] || { responsibility: '', description: '' },
                      }));
                    }}
                  />
                  <span>{member.name} ({member.username})</span>
                </label>
              ))}
              {members.length === 0 && !loadingMembers && (
                <span className="tf-form-help">No active team members found in your department.</span>
              )}
            </div>
            {members.length > 0 && (
              <span className="tf-form-help">
                {members.filter((member) => selectedMemberIds.includes(member.id)).length} of {members.length} team members selected.
              </span>
            )}
            {loadingMembers && <span className="tf-form-help">Loading team members…</span>}
            {members.length === 0 && (
              <span className="tf-form-help tf-text-amber">
                {loadingMembers
                  ? 'Please wait while department members load.'
                  : 'No active team members found in your department. Ask your Admin to create or activate a member account.'}
              </span>
            )}
          </div>

          {selectedMemberIds.length > 0 && (
            <div className="tf-form-group tf-full-width">
              <label>Work Distribution</label>
              {members.filter((member) => selectedMemberIds.includes(member.id)).map((member) => (
                <div className="tf-card" key={member.id} style={{ padding: '1rem', marginTop: '.75rem' }}>
                  <strong>{member.name}</strong>
                  <input
                    className="tf-input"
                    style={{ marginTop: '.5rem' }}
                    aria-label={`${member.name} responsibility title`}
                    placeholder="Responsibility title"
                    maxLength={300}
                    value={responsibilities[member.id]?.responsibility || ''}
                    onChange={(event) => setResponsibilities((current) => ({
                      ...current,
                      [member.id]: { ...current[member.id], responsibility: event.target.value },
                    }))}
                  />
                  <textarea
                    className="tf-textarea"
                    style={{ marginTop: '.5rem' }}
                    aria-label={`${member.name} responsibility details`}
                    placeholder="Describe this member's work"
                    rows={2}
                    maxLength={2000}
                    value={responsibilities[member.id]?.description || ''}
                    onChange={(event) => setResponsibilities((current) => ({
                      ...current,
                      [member.id]: { ...current[member.id], description: event.target.value },
                    }))}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="tf-form-group">
            <label htmlFor="task-priority">Task Priority *</label>
            <select
              id="task-priority"
              className="tf-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="critical">Critical Priority</option>
            </select>
          </div>

          <div className="tf-form-group">
            <label htmlFor="task-start">Start Date</label>
            <input
              id="task-start"
              type="date"
              className="tf-input"
              value={startDate}
              max={dueDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="task-due">Due Date (Deadline)</label>
            <input
              id="task-due"
              type="date"
              className="tf-input"
              value={dueDate}
              min={startDate || undefined}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="tf-form-group tf-full-width">
            <label htmlFor="task-reference-files">Reference files (PDF, PNG, JPEG, or TXT; 1 MB total)</label>
            <input
              id="task-reference-files"
              className="tf-input"
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
              onChange={(event) => setReferenceFiles(Array.from(event.target.files || []))}
            />
          </div>

          <div className="tf-form-actions-bottom">
            <button
              type="submit"
              className="tf-btn tf-btn-primary"
              disabled={submitting || loadingMembers || selectedMemberIds.length < 2}
            >
              {submitting ? 'Assigning Task…' : (
                <>
                  <CalendarDays size={16} /> Assign Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LeaderAssignTaskPage;
