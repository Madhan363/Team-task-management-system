import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  Megaphone,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import { api } from '../../api';
import ConfirmModal from '../../components/ConfirmModal';

const EMPTY_FORM = {
  title: '',
  description: '',
  agenda: '',
  startsAt: '',
  durationMinutes: '30',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  departmentId: '',
  roomId: '',
  taskId: '',
  participantIds: [],
  meetingUrl: '',
};

function localDateTimeValue(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function formatMeetingTime(value, timezone) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone || undefined,
  }).format(new Date(value));
}

function MeetingRoomCard({ room, user, eligibleUsers, roomMeetings, onUpdate, onAnnounce, onError }) {
  const canManage = user.role === 'admin'
    || (user.role === 'team_leader' && room.creator.id === user.id && room.type === 'team');
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState(room.participants.map((participant) => participant.id));
  const [announcement, setAnnouncement] = useState('');
  const [busy, setBusy] = useState(false);

  const saveAccess = async () => {
    setBusy(true);
    onError('');
    try {
      await onUpdate(room.id, { participantIds: selectedIds });
    } catch (error) {
      onError(error.message || 'Could not update room access.');
    } finally {
      setBusy(false);
    }
  };

  const postAnnouncement = async (event) => {
    event.preventDefault();
    setBusy(true);
    onError('');
    try {
      await onAnnounce(room.id, announcement);
      setAnnouncement('');
    } catch (error) {
      onError(error.message || 'Could not share the announcement.');
    } finally {
      setBusy(false);
    }
  };

  const toggleRoomStatus = async () => {
    setBusy(true);
    onError('');
    try {
      await onUpdate(room.id, { isActive: !room.isActive });
    } catch (error) {
      onError(error.message || 'Could not change the room status.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="tf-room-card">
      <div className="tf-room-card-header">
        <div className="tf-room-icon"><Video size={19} /></div>
        <div className="tf-room-card-title">
          <span className={`tf-room-kind tf-room-kind-${room.type}`}>{room.type === 'leadership' ? 'Leadership' : 'Team'}</span>
          <h3>{room.name}</h3>
          <small>{room.type === 'leadership' ? 'Admin + invited Team Leaders' : `${room.department?.name || 'Team'} · Team Leader + invited members`}</small>
        </div>
        {!room.isActive && <span className="tf-meeting-status tf-meeting-status-cancelled">Archived</span>}
      </div>
      <p className="tf-room-purpose">{room.purpose || room.description || (room.type === 'leadership'
        ? 'Discuss company instructions, department progress, deadlines, and team issues.'
        : 'Discuss assigned tasks, technical doubts, work progress, and pending activities.')}</p>
      <div className="tf-room-meta">
        <span><Users size={15} /> {room.participants.length} invited</span>
        <span>Created by {room.creator.name}</span>
      </div>
      {roomMeetings.length > 0 && (
        <div className="tf-room-scheduled-meetings">
          <strong><CalendarDays size={15} /> Scheduled in this room</strong>
          {roomMeetings.map((meeting) => (
            <div key={meeting.id}>
              <span>{meeting.title}<small>{formatMeetingTime(meeting.startsAt, meeting.timezone)}</small></span>
              {meeting.meetingUrl && <a href={meeting.meetingUrl} target="_blank" rel="noopener noreferrer">Join</a>}
            </div>
          ))}
        </div>
      )}
      {room.announcements.length > 0 && (
        <div className="tf-room-announcements">
          <strong><Megaphone size={15} /> Announcements</strong>
          {room.announcements.slice().reverse().map((item) => (
            <p key={item.id}>{item.text}<small>{item.author.name} · {new Date(item.createdAt).toLocaleString()}</small></p>
          ))}
        </div>
      )}
      {canManage && (
        <div className="tf-room-manage">
          <button type="button" className="tf-meeting-details-toggle" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Hide room management' : 'Manage room'}
          </button>
          {expanded && (
            <div className="tf-room-manage-panel">
              <fieldset className="tf-meeting-participants">
                <legend>Invitees and room access</legend>
                {eligibleUsers.map((person) => (
                  <label key={person.id}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(person.id)}
                      onChange={() => setSelectedIds((current) => current.includes(person.id)
                        ? current.filter((id) => id !== person.id)
                        : [...current, person.id])}
                    />
                    <span>{person.name}<small>{person.email || person.username}</small></span>
                  </label>
                ))}
                {!eligibleUsers.length && <p>No eligible participants are available.</p>}
              </fieldset>
              <button type="button" className="tf-btn tf-btn-secondary" onClick={saveAccess} disabled={busy}>
                <Users size={15} /> Save access
              </button>
              <button type="button" className="tf-btn tf-btn-secondary" onClick={toggleRoomStatus} disabled={busy}>
                {room.isActive ? 'Archive room' : 'Reactivate room'}
              </button>
              <form className="tf-room-announcement-form" onSubmit={postAnnouncement}>
                <label htmlFor={`announcement-${room.id}`}>Share an announcement</label>
                <textarea id={`announcement-${room.id}`} className="tf-textarea" rows={3} maxLength={2000} value={announcement} onChange={(event) => setAnnouncement(event.target.value)} required />
                <button type="submit" className="tf-btn tf-btn-primary" disabled={busy}><Megaphone size={15} /> Share with room</button>
              </form>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function MeetingCollaboration({ meeting, onUpdated, onError }) {
  const [noteType, setNoteType] = useState('note');
  const [noteText, setNoteText] = useState('');
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);

  const submitNote = async (event) => {
    event.preventDefault();
    setSaving(true);
    onError('');
    try {
      const result = await api.addMeetingNote(meeting.id, noteType, noteText);
      onUpdated(result.meeting);
      setNoteText('');
    } catch (error) {
      onError(error.message || 'Could not save the meeting note.');
    } finally {
      setSaving(false);
    }
  };

  const submitFollowUp = async (event) => {
    event.preventDefault();
    setSaving(true);
    onError('');
    try {
      const result = await api.addMeetingFollowUp(meeting.id, {
        title: followUpTitle,
        ...(assignedTo ? { assignedTo } : {}),
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
      });
      onUpdated(result.meeting);
      setFollowUpTitle('');
      setDueAt('');
      setAssignedTo('');
    } catch (error) {
      onError(error.message || 'Could not save the follow-up task.');
    } finally {
      setSaving(false);
    }
  };

  const toggleFollowUp = async (followUp) => {
    setSaving(true);
    onError('');
    try {
      const result = await api.updateMeetingFollowUp(
        meeting.id,
        followUp.id,
        followUp.status === 'completed' ? 'open' : 'completed',
      );
      onUpdated(result.meeting);
    } catch (error) {
      onError(error.message || 'Could not update the follow-up task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tf-meeting-collaboration">
      <section>
        <h4><FileText size={16} /> Notes, decisions &amp; blockers</h4>
        <form className="tf-meeting-inline-form" onSubmit={submitNote}>
          <select className="tf-select" value={noteType} onChange={(event) => setNoteType(event.target.value)}>
            <option value="note">Note</option>
            <option value="decision">Decision</option>
            <option value="blocker">Blocker</option>
          </select>
          <input
            className="tf-input"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            maxLength={2000}
            placeholder="Write a meeting update…"
            required
          />
          <button type="submit" className="tf-btn tf-btn-primary" disabled={saving}><Plus size={15} /> Add</button>
        </form>
        {meeting.notes.length ? (
          <ul className="tf-meeting-entry-list">
            {meeting.notes.map((note) => (
              <li key={note.id}>
                <span className={`tf-meeting-note-type tf-meeting-note-${note.type}`}>{note.type}</span>
                <div><p>{note.text}</p><small>{note.author.name} · {new Date(note.createdAt).toLocaleString()}</small></div>
              </li>
            ))}
          </ul>
        ) : <p className="tf-meeting-muted">No notes have been added yet.</p>}
      </section>

      <section>
        <h4><CheckCircle2 size={16} /> Follow-up tasks</h4>
        <form className="tf-meeting-followup-form" onSubmit={submitFollowUp}>
          <input
            className="tf-input"
            value={followUpTitle}
            onChange={(event) => setFollowUpTitle(event.target.value)}
            maxLength={160}
            placeholder="Action item"
            required
          />
          <select className="tf-select" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
            <option value="">Assign to me</option>
            {[meeting.organizer, ...meeting.participants]
              .filter((person, index, list) => list.findIndex((item) => item.id === person.id) === index)
              .map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <input
            className="tf-input"
            type="date"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            aria-label="Follow-up due date"
          />
          <button type="submit" className="tf-btn tf-btn-primary" disabled={saving}><Plus size={15} /> Add</button>
        </form>
        {meeting.followUps.length ? (
          <ul className="tf-meeting-entry-list tf-meeting-followups">
            {meeting.followUps.map((followUp) => (
              <li key={followUp.id}>
                <button type="button" className="tf-meeting-check" onClick={() => toggleFollowUp(followUp)} disabled={saving} aria-label={`Mark ${followUp.title} ${followUp.status === 'completed' ? 'open' : 'completed'}`}>
                  {followUp.status === 'completed' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <div className={followUp.status === 'completed' ? 'tf-meeting-complete' : ''}>
                  <p>{followUp.title}</p>
                  <small>{followUp.assignedTo?.name || 'Unassigned'}{followUp.dueAt ? ` · Due ${new Date(followUp.dueAt).toLocaleDateString()}` : ''}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="tf-meeting-muted">No follow-up tasks have been recorded.</p>}
      </section>
    </div>
  );
}

function MeetingsPage({ user }) {
  const canSchedule = ['admin', 'team_leader'].includes(user.role);
  const [meetings, setMeetings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [options, setOptions] = useState({
    departments: [],
    users: [],
    tasks: [],
    rooms: [],
    googleCalendarEnabled: false,
  });
  const [roomForm, setRoomForm] = useState({
    name: user.role === 'admin' ? 'Admin Meeting Room' : 'My Team Meeting Room',
    description: '',
    purpose: '',
    departmentId: '',
    participantIds: [],
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expandedMeeting, setExpandedMeeting] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.getMeetings(), api.getMeetingOptions(), api.getMeetingRooms()])
      .then(([meetingResult, optionResult, roomResult]) => {
        if (!active) return;
        setMeetings(meetingResult.meetings || []);
        setOptions({
          departments: optionResult.departments || [],
          users: optionResult.users || [],
          tasks: optionResult.tasks || [],
          rooms: optionResult.rooms || [],
          googleCalendarEnabled: Boolean(optionResult.googleCalendarEnabled),
        });
        setRooms(roomResult.rooms || []);
        if (user.role === 'team_leader' && optionResult.departments[0]) {
          setRoomForm((previous) => ({ ...previous, departmentId: optionResult.departments[0].id }));
        }
        setError('');
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load meetings.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.role]);

  const visibleMeetings = useMemo(() => meetings
    .filter((meeting) => (
      filter === 'upcoming' ? meeting.status === 'upcoming'
        : filter === 'ongoing' ? meeting.status === 'ongoing'
          : meeting.status === 'past' || meeting.status === 'cancelled'
    ))
    .sort((first, second) => (
      filter === 'past'
        ? new Date(second.startsAt) - new Date(first.startsAt)
        : new Date(first.startsAt) - new Date(second.startsAt)
    )), [filter, meetings]);

  const updateMeetingInList = (updatedMeeting) => {
    setMeetings((previous) => previous.map((meeting) => (
      meeting.id === updatedMeeting.id ? updatedMeeting : meeting
    )));
  };

  const refreshMeetings = async () => {
    setLoading(true);
    setError('');
    try {
      const [result, roomResult] = await Promise.all([api.getMeetings(), api.getMeetingRooms()]);
      setMeetings(result.meetings || []);
      setRooms(roomResult.rooms || []);
    } catch (requestError) {
      setError(requestError.message || 'Could not refresh meetings.');
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const updateRoomInList = (room) => {
    setRooms((previous) => previous.map((item) => item.id === room.id ? room : item));
    setOptions((previous) => ({
      ...previous,
      rooms: room.isActive
        ? [room, ...previous.rooms.filter((item) => item.id !== room.id)]
        : previous.rooms.filter((item) => item.id !== room.id),
    }));
  };

  const saveRoomAccess = async (id, changes) => {
    const result = await api.updateMeetingRoom(id, changes);
    updateRoomInList(result.room);
    setNotice('Meeting room access updated.');
  };

  const shareRoomAnnouncement = async (id, text) => {
    const result = await api.addRoomAnnouncement(id, text);
    updateRoomInList(result.room);
    setNotice('Announcement shared with room participants.');
  };

  const createRoom = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!roomForm.participantIds.length) {
      setError('Invite at least one participant to the room.');
      return;
    }
    setSaving(true);
    try {
      const result = await api.createMeetingRoom({
        ...roomForm,
        ...(user.role === 'admin' ? { departmentId: null } : {}),
      });
      setRooms((previous) => [result.room, ...previous]);
      setOptions((previous) => ({ ...previous, rooms: [result.room, ...previous.rooms] }));
      setRoomForm({
        name: user.role === 'admin' ? 'Admin Meeting Room' : 'My Team Meeting Room',
        description: '',
        purpose: '',
        departmentId: options.departments[0]?.id || '',
        participantIds: [],
      });
      setNotice('Meeting room created and invitations sent.');
    } catch (requestError) {
      setError(requestError.message || 'Could not create this meeting room.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, departmentId: options.departments[0]?.id || '' });
    setEditingMeeting(null);
  };

  const startEditing = (meeting) => {
    setEditingMeeting(meeting);
    setForm({
      title: meeting.title,
      description: meeting.description || '',
      agenda: meeting.agenda || '',
      startsAt: localDateTimeValue(meeting.startsAt),
      durationMinutes: String(Math.round((new Date(meeting.endsAt) - new Date(meeting.startsAt)) / 60_000)),
      timezone: meeting.timezone || EMPTY_FORM.timezone,
      departmentId: meeting.department?.id || '',
      roomId: meeting.room?.id || '',
      taskId: meeting.task?.id || '',
      participantIds: meeting.participants.map((participant) => participant.id),
      meetingUrl: meeting.meetingUrl || '',
    });
    setNotice('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveMeeting = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!form.participantIds.length) {
      setError('Select at least one participant.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        participantIds: form.participantIds,
        roomId: form.roomId || null,
        departmentId: form.departmentId || null,
        taskId: form.taskId || null,
      };
      if (editingMeeting) {
        const result = await api.updateMeeting(editingMeeting.id, payload);
        updateMeetingInList(result.meeting);
        setNotice('Meeting updated.');
      } else {
        const result = await api.createMeeting(payload);
        setMeetings((previous) => [result.meeting, ...previous]);
        setNotice('Meeting scheduled and participants notified.');
      }
      resetForm();
    } catch (requestError) {
      setError(requestError.message || 'Could not save this meeting.');
    } finally {
      setSaving(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    const { meeting, action } = confirmAction;
    setConfirmAction(null);
    setError('');
    try {
      if (action === 'cancel') {
        const result = await api.cancelMeeting(meeting.id);
        updateMeetingInList(result.meeting);
        setNotice('Meeting cancelled. Participants have been notified.');
      } else {
        await api.deleteMeeting(meeting.id);
        setMeetings((previous) => previous.filter((item) => item.id !== meeting.id));
        setNotice('Meeting deleted.');
      }
    } catch (requestError) {
      setError(requestError.message || `Could not ${action} this meeting.`);
    }
  };

  const toggleParticipant = (participantId) => {
    setForm((previous) => ({
      ...previous,
      participantIds: previous.participantIds.includes(participantId)
        ? previous.participantIds.filter((id) => id !== participantId)
        : [...previous.participantIds, participantId],
    }));
  };

  const availableUsers = options.users.filter((person) => (
    form.roomId
      ? options.rooms.find((room) => room.id === form.roomId)?.participants.some((participant) => participant.id === person.id)
      : !form.departmentId || person.departmentId === form.departmentId
  ));
  const selectedRoom = options.rooms.find((room) => room.id === form.roomId);
  const availableTasks = options.tasks.filter((task) => !form.departmentId || task.departmentId === form.departmentId);
  const isMeetingManager = (meeting) => user.role === 'admin' || meeting.organizer.id === user.id;
  const availableRoomInvitees = user.role === 'admin'
    ? options.users.filter((person) => person.role === 'team_leader')
    : options.users.filter((person) => person.role === 'team_member'
      && (!roomForm.departmentId || person.departmentId === roomForm.departmentId));

  return (
    <div className="tf-page-container tf-meetings-page">
      <div className="tf-page-header">
        <div>
          <h2>Meetings</h2>
          <p>Schedule team discussions, join meetings, and track decisions and follow-up work.</p>
        </div>
        <button type="button" className="tf-btn tf-btn-secondary" onClick={refreshMeetings} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'tf-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="tf-alert tf-alert-error" role="alert">{error}</div>}
      {notice && <div className="tf-alert tf-alert-success" role="status">{notice}</div>}

      <section className="tf-card tf-room-dashboard">
        <div className="tf-card-header">
          <div className="tf-card-title-row">
            <Users size={20} className="tf-accent-icon" />
            <h3>Meeting Rooms</h3>
          </div>
          <span className="tf-card-subtitle">Cyberjeet Team Workspace</span>
        </div>
        {canSchedule && (
          <form className="tf-room-create-form" onSubmit={createRoom}>
            <h4>{user.role === 'admin' ? 'Create the Admin Meeting Room' : 'Create a team meeting room'}</h4>
            <div className="tf-meeting-form">
              <label>Room name *
                <input className="tf-input" value={roomForm.name} onChange={(event) => setRoomForm((previous) => ({ ...previous, name: event.target.value }))} maxLength={120} required />
              </label>
              {user.role === 'team_leader' && (
                <label>Assigned department
                  <select className="tf-select" value={roomForm.departmentId} onChange={(event) => setRoomForm((previous) => ({ ...previous, departmentId: event.target.value, participantIds: [] }))} required>
                    <option value="">Select department</option>
                    {options.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </label>
              )}
              <label>Room description
                <input className="tf-input" value={roomForm.description} onChange={(event) => setRoomForm((previous) => ({ ...previous, description: event.target.value }))} maxLength={2000} placeholder="Who uses this room?" />
              </label>
              <label>Purpose
                <input className="tf-input" value={roomForm.purpose} onChange={(event) => setRoomForm((previous) => ({ ...previous, purpose: event.target.value }))} maxLength={1000} placeholder={user.role === 'admin' ? 'Company instructions, department progress, deadlines…' : 'Assigned tasks, technical questions, work progress…'} />
              </label>
              <fieldset className="tf-meeting-participants tf-meeting-full-width">
                <legend>{user.role === 'admin' ? 'Invite Team Leaders' : 'Invite department members'}</legend>
                {availableRoomInvitees.length ? (
                  <>
                    <label>
                      <input
                        type="checkbox"
                        checked={availableRoomInvitees.every((person) => roomForm.participantIds.includes(person.id))}
                        onChange={(event) => setRoomForm((previous) => ({
                          ...previous,
                          participantIds: event.target.checked
                            ? availableRoomInvitees.map((person) => person.id)
                            : [],
                        }))}
                      />
                      <span>Select all</span>
                    </label>
                    {availableRoomInvitees.map((person) => (
                      <label key={person.id}>
                        <input
                          type="checkbox"
                          checked={roomForm.participantIds.includes(person.id)}
                          onChange={() => setRoomForm((previous) => ({
                            ...previous,
                            participantIds: previous.participantIds.includes(person.id)
                              ? previous.participantIds.filter((id) => id !== person.id)
                              : [...previous.participantIds, person.id],
                          }))}
                        />
                        <span>{person.name}<small>{person.email || person.username}</small></span>
                      </label>
                    ))}
                  </>
                ) : <p>{user.role === 'admin' ? 'No active Team Leaders are available.' : 'No active Team Members are available in this department.'}</p>}
              </fieldset>
              <div className="tf-meeting-form-actions tf-meeting-full-width">
                <button type="submit" className="tf-btn tf-btn-primary" disabled={saving || !availableRoomInvitees.length}>
                  <Plus size={16} /> {user.role === 'admin' ? 'Create Admin Meeting Room' : 'Create team room'}
                </button>
              </div>
            </div>
          </form>
        )}
        <div className="tf-room-grid">
          {rooms.map((room) => {
            const eligibleUsers = room.type === 'leadership'
              ? options.users.filter((person) => person.role === 'team_leader')
              : options.users.filter((person) => person.role === 'team_member' && person.departmentId === room.department?.id);
            return (
              <MeetingRoomCard
                key={room.id}
                room={room}
                user={user}
                eligibleUsers={eligibleUsers}
                roomMeetings={meetings.filter((meeting) => meeting.room?.id === room.id
                  && ['upcoming', 'ongoing'].includes(meeting.status))}
                onUpdate={saveRoomAccess}
                onAnnounce={shareRoomAnnouncement}
                onError={setError}
              />
            );
          })}
          {!rooms.length && !loading && (
            <div className="tf-room-empty">
              <Users size={24} />
              <span>{user.role === 'team_member'
                ? 'You have not been invited to a meeting room yet.'
                : 'No meeting rooms yet. Create the workspace room and invite its members.'}</span>
            </div>
          )}
        </div>
      </section>

      {canSchedule && (
        <section className="tf-card tf-meeting-form-card">
          <div className="tf-card-header">
            <div className="tf-card-title-row">
              <Video size={20} className="tf-accent-icon" />
              <h3>{editingMeeting ? 'Edit meeting' : 'Schedule a meeting'}</h3>
            </div>
            <span className="tf-card-subtitle">
              {options.googleCalendarEnabled
                ? 'Google Calendar invitations are enabled. Leave the Meet URL empty to generate a Google Meet link.'
                : 'Add an existing Google Meet URL. Set up server-side Google Calendar OAuth to generate links automatically.'}
            </span>
          </div>
          <form className="tf-meeting-form" onSubmit={saveMeeting}>
            <label>Meeting title *
              <input className="tf-input" value={form.title} onChange={(event) => updateForm('title', event.target.value)} maxLength={160} required />
            </label>
            <label>Department{selectedRoom?.department ? '' : ' *'}
              <select className="tf-select" value={form.departmentId} disabled={Boolean(selectedRoom?.department)} required={!form.roomId} onChange={(event) => {
                const departmentId = event.target.value;
                setForm((previous) => ({
                  ...previous,
                  departmentId,
                  taskId: '',
                  roomId: '',
                  participantIds: previous.participantIds.filter((id) => (
                    options.users.some((person) => person.id === id && person.departmentId === departmentId)
                  )),
                }));
              }}>
                <option value="">Select a department</option>
                {options.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </label>
            <label>Meeting room
              <select className="tf-select" value={form.roomId} onChange={(event) => {
                const room = options.rooms.find((item) => item.id === event.target.value);
                setForm((previous) => ({
                  ...previous,
                  roomId: room?.id || '',
                  departmentId: room?.department?.id || '',
                  taskId: '',
                  participantIds: room ? room.participants.map((person) => person.id) : [],
                }));
              }}>
                <option value="">No room</option>
                {options.rooms.filter((room) => user.role === 'admin'
                  || (room.type === 'team' && room.creator.id === user.id))
                  .map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </label>
            <label>Date and time *
              <input className="tf-input" type="datetime-local" value={form.startsAt} onChange={(event) => updateForm('startsAt', event.target.value)} required />
            </label>
            <label>Duration
              <select className="tf-select" value={form.durationMinutes} onChange={(event) => updateForm('durationMinutes', event.target.value)}>
                {[15, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
              </select>
            </label>
            <label>Related task
              <select className="tf-select" value={form.taskId} disabled={Boolean(form.roomId && !selectedRoom?.department)} onChange={(event) => updateForm('taskId', event.target.value)}>
                <option value="">No related task</option>
                {availableTasks.map((task) => <option key={task.id} value={task.id}>{task.title} · {task.status.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label>Google Meet URL
              <input
                className="tf-input"
                type="url"
                value={form.meetingUrl}
                onChange={(event) => updateForm('meetingUrl', event.target.value)}
                placeholder={options.googleCalendarEnabled ? 'Leave blank to generate automatically' : 'https://meet.google.com/abc-defg-hij'}
                pattern="https://meet\.google\.com/.+"
                title="Use an HTTPS link from meet.google.com"
              />
            </label>
            <label className="tf-meeting-full-width">Description
              <textarea className="tf-textarea" rows={3} maxLength={2000} value={form.description} onChange={(event) => updateForm('description', event.target.value)} />
            </label>
            <label className="tf-meeting-full-width">Agenda
              <textarea className="tf-textarea" rows={4} maxLength={5000} value={form.agenda} onChange={(event) => updateForm('agenda', event.target.value)} placeholder="Topics, goals, and preparation…" />
            </label>
            <fieldset className="tf-meeting-participants tf-meeting-full-width">
              <legend>Participants *</legend>
              {availableUsers.length ? (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={availableUsers.every((person) => form.participantIds.includes(person.id))}
                      onChange={(event) => setForm((previous) => ({
                        ...previous,
                        participantIds: event.target.checked
                          ? [...new Set([...previous.participantIds, ...availableUsers.map((person) => person.id)])]
                          : previous.participantIds.filter((id) => !availableUsers.some((person) => person.id === id)),
                      }))}
                    />
                    <span>Select all</span>
                  </label>
                  {availableUsers.map((person) => (
                    <label key={person.id}>
                      <input type="checkbox" checked={form.participantIds.includes(person.id)} onChange={() => toggleParticipant(person.id)} />
                      <span>{person.name}<small>{person.email || person.role.replaceAll('_', ' ')}</small></span>
                    </label>
                  ))}
                </>
              ) : <p>Select a department to view its active participants.</p>}
            </fieldset>
            <div className="tf-meeting-form-actions tf-meeting-full-width">
              {editingMeeting && <button type="button" className="tf-btn tf-btn-secondary" onClick={resetForm}>Stop editing</button>}
              <button type="submit" className="tf-btn tf-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editingMeeting ? 'Save changes' : 'Schedule meeting'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="tf-card tf-meeting-list-card">
        <div className="tf-meeting-list-header">
          <div className="tf-meeting-tabs" role="tablist" aria-label="Meeting time filters">
            {[
              ['upcoming', 'Upcoming'],
              ['ongoing', 'Ongoing'],
              ['past', 'Past'],
            ].map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
          <span className="tf-card-subtitle">{visibleMeetings.length} meeting{visibleMeetings.length === 1 ? '' : 's'}</span>
        </div>
        {loading ? <div className="tf-table-empty">Loading meetings…</div> : visibleMeetings.length ? (
          <div className="tf-meeting-list">
            {visibleMeetings.map((meeting) => {
              const canManage = isMeetingManager(meeting) && meeting.status !== 'cancelled';
              return (
                <article className="tf-meeting-card" key={meeting.id}>
                  <div className="tf-meeting-card-main">
                    <div className="tf-meeting-card-heading">
                      <div>
                        <span className={`tf-meeting-status tf-meeting-status-${meeting.status}`}>{meeting.status}</span>
                        <h3>{meeting.title}</h3>
                      </div>
                      <div className="tf-meeting-actions">
                        {meeting.meetingUrl && meeting.status !== 'cancelled' && (
                          <a className="tf-btn tf-btn-primary" href={meeting.meetingUrl} target="_blank" rel="noopener noreferrer">
                            <Video size={16} /> Join meeting <ExternalLink size={13} />
                          </a>
                        )}
                        {canManage && <>
                          <button type="button" className="tf-btn tf-btn-secondary" onClick={() => startEditing(meeting)}>Edit</button>
                          <button type="button" className="tf-btn tf-btn-secondary" onClick={() => setConfirmAction({ action: 'cancel', meeting })}>Cancel</button>
                          <button type="button" className="tf-icon-action-btn" aria-label="Delete meeting" onClick={() => setConfirmAction({ action: 'delete', meeting })}><Trash2 size={16} /></button>
                        </>}
                      </div>
                    </div>
                    <div className="tf-meeting-meta">
                      <span><CalendarDays size={15} /> {formatMeetingTime(meeting.startsAt, meeting.timezone)}</span>
                      <span><Clock3 size={15} /> Ends {formatMeetingTime(meeting.endsAt, meeting.timezone)}</span>
                      <span><Users size={15} /> {meeting.participants.length} participant{meeting.participants.length === 1 ? '' : 's'}</span>
                      {meeting.department && <span>{meeting.department.name}</span>}
                      {meeting.task && <span>Task: {meeting.task.title}</span>}
                    </div>
                    {meeting.description && <p className="tf-meeting-description">{meeting.description}</p>}
                    {meeting.agenda && <details className="tf-meeting-agenda"><summary>View agenda</summary><p>{meeting.agenda}</p></details>}
                    <p className="tf-meeting-organizer">Organized by {meeting.organizer.name}</p>
                    <button
                      type="button"
                      className="tf-meeting-details-toggle"
                      aria-expanded={expandedMeeting === meeting.id}
                      onClick={() => setExpandedMeeting((current) => current === meeting.id ? '' : meeting.id)}
                    >
                      {expandedMeeting === meeting.id ? 'Hide meeting notes and follow-ups' : 'Notes and follow-up tasks'}
                    </button>
                  </div>
                  {expandedMeeting === meeting.id && (
                    <MeetingCollaboration
                      meeting={meeting}
                      onUpdated={updateMeetingInList}
                      onError={setError}
                    />
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="tf-meeting-empty">
            <Video size={30} />
            <strong>No {filter} meetings</strong>
            <span>{canSchedule ? 'Schedule a meeting above, or check another time filter.' : 'Meetings you are invited to will appear here.'}</span>
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        title={confirmAction?.action === 'delete' ? 'Delete meeting?' : 'Cancel meeting?'}
        message={confirmAction?.action === 'delete'
          ? 'This will permanently delete the meeting and its notes and follow-up tasks.'
          : 'Participants will be notified that this meeting was cancelled.'}
        confirmText={confirmAction?.action === 'delete' ? 'Delete meeting' : 'Cancel meeting'}
        isDestructive
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

export default MeetingsPage;
