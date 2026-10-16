import mongoose from 'mongoose';
import {
  Department,
  Meeting,
  MeetingRoom,
  Notification,
  Task,
  User,
} from '../models.js';
import { recordAuditEvent } from '../utils/audit.js';
import {
  cancelCalendarEvent,
  createCalendarEvent,
  deleteCalendarEvent,
  isGoogleCalendarConfigured,
  updateCalendarEvent,
} from '../services/googleCalendar.js';

const MEETING_ROLES = ['admin', 'team_leader'];
const NOTE_TYPES = ['note', 'decision', 'blocker'];

function sameId(left, right) {
  return String(left?._id || left || '') === String(right?._id || right || '');
}

function validObjectId(value) {
  return typeof value === 'string' && mongoose.isValidObjectId(value);
}

function parseDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function meetingStatus(meeting, now = Date.now()) {
  if (meeting.status === 'cancelled') return 'cancelled';
  if (new Date(meeting.startsAt).getTime() > now) return 'upcoming';
  if (new Date(meeting.endsAt).getTime() < now) return 'past';
  return 'ongoing';
}

function serializeMeeting(meeting) {
  return {
    id: meeting._id.toString(),
    title: meeting.title,
    description: meeting.description,
    agenda: meeting.agenda,
    startsAt: meeting.startsAt.toISOString(),
    endsAt: meeting.endsAt.toISOString(),
    timezone: meeting.timezone,
    organizer: meeting.organizer && typeof meeting.organizer === 'object'
      ? {
        id: meeting.organizer._id.toString(),
        name: meeting.organizer.name,
        email: meeting.organizer.email || '',
      }
      : { id: meeting.organizer.toString(), name: '', email: '' },
    room: meeting.room && typeof meeting.room === 'object'
      ? { id: meeting.room._id.toString(), name: meeting.room.name, type: meeting.room.type }
      : (meeting.room ? { id: meeting.room.toString(), name: '', type: '' } : null),
    participants: meeting.participants.map((participant) => (
      participant && typeof participant === 'object'
        ? {
          id: participant._id.toString(),
          name: participant.name,
          email: participant.email || '',
          role: participant.role,
        }
        : { id: participant.toString(), name: '', email: '' }
    )),
    department: meeting.department && typeof meeting.department === 'object'
      ? { id: meeting.department._id.toString(), name: meeting.department.name }
      : (meeting.department ? { id: meeting.department.toString(), name: '' } : null),
    task: meeting.task && typeof meeting.task === 'object'
      ? { id: meeting.task._id.toString(), title: meeting.task.title, status: meeting.task.status }
      : (meeting.task ? { id: meeting.task.toString(), title: '', status: '' } : null),
    meetingUrl: meeting.meetingUrl,
    status: meetingStatus(meeting),
    notes: meeting.notes.map((note) => ({
      id: note._id.toString(),
      author: note.author && typeof note.author === 'object'
        ? { id: note.author._id.toString(), name: note.author.name }
        : { id: note.author.toString(), name: '' },
      type: note.type,
      text: note.text,
      createdAt: note.createdAt.toISOString(),
    })),
    followUps: meeting.followUps.map((followUp) => ({
      id: followUp._id.toString(),
      title: followUp.title,
      assignedTo: followUp.assignedTo && typeof followUp.assignedTo === 'object'
        ? { id: followUp.assignedTo._id.toString(), name: followUp.assignedTo.name }
        : (followUp.assignedTo ? { id: followUp.assignedTo.toString(), name: '' } : null),
      dueAt: followUp.dueAt?.toISOString() || null,
      status: followUp.status,
      createdBy: followUp.createdBy && typeof followUp.createdBy === 'object'
        ? { id: followUp.createdBy._id.toString(), name: followUp.createdBy.name }
        : { id: followUp.createdBy.toString(), name: '' },
      createdAt: followUp.createdAt.toISOString(),
    })),
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
  };
}

const MEETING_POPULATE = [
  { path: 'organizer', select: 'name email role' },
  { path: 'room', select: 'name type creator participants isActive' },
  { path: 'participants', select: 'name email role' },
  { path: 'department', select: 'name' },
  { path: 'task', select: 'title status' },
  { path: 'notes.author', select: 'name' },
  { path: 'followUps.assignedTo', select: 'name' },
  { path: 'followUps.createdBy', select: 'name' },
];

const ROOM_POPULATE = [
  { path: 'creator', select: 'name username email role' },
  { path: 'department', select: 'name' },
  { path: 'participants', select: 'name username email role department' },
  { path: 'announcements.author', select: 'name' },
];

async function populateMeeting(meeting) {
  await meeting.populate(MEETING_POPULATE);
  return meeting;
}

function serializeRoom(room) {
  return {
    id: room._id.toString(),
    name: room.name,
    description: room.description,
    purpose: room.purpose,
    type: room.type,
    isActive: room.isActive,
    creator: room.creator && typeof room.creator === 'object'
      ? { id: room.creator._id.toString(), name: room.creator.name, role: room.creator.role }
      : { id: room.creator.toString(), name: '', role: '' },
    department: room.department && typeof room.department === 'object'
      ? { id: room.department._id.toString(), name: room.department.name }
      : (room.department ? { id: room.department.toString(), name: '' } : null),
    participants: room.participants.map((participant) => (
      participant && typeof participant === 'object'
        ? {
          id: participant._id.toString(),
          name: participant.name,
          username: participant.username,
          email: participant.email || '',
          role: participant.role,
        }
        : { id: participant.toString(), name: '', email: '', role: '' }
    )),
    announcements: room.announcements.map((announcement) => ({
      id: announcement._id.toString(),
      author: announcement.author && typeof announcement.author === 'object'
        ? { id: announcement.author._id.toString(), name: announcement.author.name }
        : { id: announcement.author.toString(), name: '' },
      text: announcement.text,
      createdAt: announcement.createdAt.toISOString(),
    })),
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

async function leaderDepartment(user) {
  return Department.findOne({ teamLeader: user._id, isActive: true });
}

async function canManageMeeting(user, meeting) {
  if (user.role === 'admin') return true;
  if (user.role !== 'team_leader' || !sameId(user, meeting.organizer)) return false;
  const department = await leaderDepartment(user);
  return Boolean(department && sameId(department, meeting.department));
}

async function canManageRoom(user, room) {
  if (user.role === 'admin') return true;
  if (user.role !== 'team_leader' || room.type !== 'team' || !sameId(user, room.creator)) return false;
  const department = await leaderDepartment(user);
  return Boolean(department && sameId(department, room.department));
}

function canViewRoom(user, room) {
  return user.role === 'admin'
    || sameId(user, room.creator)
    || room.participants.some((participant) => sameId(user, participant));
}

async function canAccessMeeting(user, meeting) {
  if (user.role === 'admin' || sameId(user, meeting.organizer)) return true;
  if (!meeting.room) return meeting.participants.some((participant) => sameId(user, participant));
  const room = meeting.room?.isActive !== undefined
    ? meeting.room
    : await MeetingRoom.findById(meeting.room?._id || meeting.room);
  return Boolean(room?.isActive && canViewRoom(user, room));
}

async function notifyRoomParticipants(room, participantIds, title, message, eventKeyPrefix) {
  await Promise.all(participantIds.map((participant) => {
    const participantId = participant._id || participant;
    return Notification.updateOne(
      { eventKey: `${eventKeyPrefix}-${room._id}-${participantId}` },
      {
        $setOnInsert: {
          recipient: participantId,
          room: room._id,
          title,
          message,
          isRead: false,
        },
      },
      { upsert: true },
    );
  }));
}

async function notifyParticipants(meeting, eventType) {
  const message = eventType === 'reminder'
    ? `"${meeting.title}" starts in about 15 minutes.`
    : `"${meeting.title}" is scheduled for ${meeting.startsAt.toLocaleString()}.`;
  const suffix = eventType === 'reminder' ? 'reminder' : `scheduled-${meeting.updatedAt.getTime()}`;
  await Promise.all(meeting.participants.map((recipient) => {
    const recipientId = recipient._id || recipient;
    return Notification.updateOne(
      { eventKey: `meeting-${meeting._id}-${suffix}-${recipientId}` },
      {
        $setOnInsert: {
          recipient: recipientId,
          meeting: meeting._id,
          title: eventType === 'reminder' ? 'Meeting reminder' : 'New meeting scheduled',
          message,
          isRead: false,
        },
      },
      { upsert: true },
    );
  }));
}

async function validatedMeetingFields(source, request, existing = null) {
  const title = typeof source.title === 'string' ? source.title.trim() : existing?.title || '';
  const description = typeof source.description === 'string' ? source.description.trim() : existing?.description || '';
  const agenda = typeof source.agenda === 'string' ? source.agenda.trim() : existing?.agenda || '';
  const departmentId = source.departmentId === undefined
    ? (existing?.department?._id || existing?.department || null)
    : source.departmentId;
  const roomId = source.roomId === undefined
    ? (existing?.room?._id || existing?.room || null)
    : source.roomId;
  const taskId = source.taskId === undefined
    ? (existing?.task?._id || existing?.task || null)
    : source.taskId;
  const startsAt = source.startsAt === undefined ? existing?.startsAt : parseDate(source.startsAt);
  const duration = source.durationMinutes === undefined
    ? Math.round((new Date(existing?.endsAt).getTime() - new Date(existing?.startsAt).getTime()) / 60000)
    : Number(source.durationMinutes);
  const timezone = typeof source.timezone === 'string' ? source.timezone.trim() : existing?.timezone || 'UTC';
  const meetingUrl = source.meetingUrl === undefined ? existing?.meetingUrl || '' : String(source.meetingUrl).trim();
  const participantIds = source.participantIds === undefined
    ? existing?.participants.map((participant) => String(participant._id || participant)) || []
    : source.participantIds;

  if (!title || title.length > 160) throw Object.assign(new Error('Enter a meeting title between 1 and 160 characters.'), { status: 400 });
  if (description.length > 2000 || agenda.length > 5000) {
    throw Object.assign(new Error('Meeting description and agenda exceed the allowed length.'), { status: 400 });
  }
  if (!startsAt || !Number.isFinite(startsAt.getTime())) {
    throw Object.assign(new Error('Enter a valid meeting date and time.'), { status: 400 });
  }
  if (!existing && startsAt.getTime() <= Date.now()) {
    throw Object.assign(new Error('Meeting start time must be in the future.'), { status: 400 });
  }
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
    throw Object.assign(new Error('Meeting duration must be between 5 minutes and 8 hours.'), { status: 400 });
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format(startsAt);
  } catch {
    throw Object.assign(new Error('Enter a valid timezone.'), { status: 400 });
  }
  if (!Array.isArray(participantIds) || participantIds.length === 0 || participantIds.length > 100
    || participantIds.some((id) => !validObjectId(id))) {
    throw Object.assign(new Error('Select valid meeting participants.'), { status: 400 });
  }
  if (meetingUrl) {
    try {
      const url = new URL(meetingUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'meet.google.com'
        || url.username || url.password || url.port || url.pathname === '/') {
        throw new Error('invalid');
      }
    } catch {
      throw Object.assign(new Error('Enter a valid HTTPS Google Meet URL from meet.google.com.'), { status: 400 });
    }
  }

  let room = null;
  if (roomId) {
    if (!validObjectId(String(roomId))) {
      throw Object.assign(new Error('Select a valid meeting room.'), { status: 400 });
    }
    room = await MeetingRoom.findOne({ _id: roomId, isActive: true });
    if (!room) throw Object.assign(new Error('The selected meeting room is unavailable.'), { status: 400 });
    if (request.user.role === 'team_leader'
      && (room.type !== 'team' || !sameId(room.creator, request.user))) {
      throw Object.assign(new Error('Team Leaders can only schedule meetings in rooms they created.'), { status: 403 });
    }
    if (!canViewRoom(request.user, room)) {
      throw Object.assign(new Error('You are not a member of the selected meeting room.'), { status: 403 });
    }
  }

  let department = null;
  if (room?.department) {
    department = await Department.findOne({ _id: room.department, isActive: true });
    if (!department) throw Object.assign(new Error('The meeting room department is unavailable.'), { status: 400 });
    if (departmentId && !sameId(departmentId, department)) {
      throw Object.assign(new Error('The meeting department must match the selected room.'), { status: 400 });
    }
  } else if (departmentId) {
    if (!validObjectId(String(departmentId))) {
      throw Object.assign(new Error('Select a valid department for the meeting.'), { status: 400 });
    }
    department = await Department.findOne({ _id: departmentId, isActive: true });
    if (!department) throw Object.assign(new Error('The selected department is unavailable.'), { status: 400 });
  } else if (!room) {
    throw Object.assign(new Error('Select a department or meeting room.'), { status: 400 });
  }
  if (request.user.role === 'team_leader'
    && (!department || !sameId(department.teamLeader, request.user))) {
    throw Object.assign(new Error('You can only schedule meetings for your own department.'), { status: 403 });
  }

  const participantIdsUnique = [...new Set(participantIds.map(String))];
  const participantUsers = await User.find({
    _id: { $in: participantIdsUnique },
    isActive: true,
  }).select('name email role department');
  if (participantUsers.length !== participantIdsUnique.length) {
    throw Object.assign(new Error('One or more selected participants are unavailable.'), { status: 400 });
  }
  if (department && participantUsers.some((user) => !sameId(user.department, department))) {
    throw Object.assign(new Error('All participants must belong to the selected department.'), { status: 400 });
  }
  if (room && participantUsers.some((user) => !room.participants.some((participant) => sameId(user, participant)))) {
    throw Object.assign(new Error('All meeting participants must be invited to the selected room.'), { status: 400 });
  }
  if (isGoogleCalendarConfigured() && participantUsers.some((user) => !user.email)) {
    throw Object.assign(new Error('All participants need an email address for Google Calendar invitations.'), { status: 400 });
  }

  let task = null;
  if (taskId) {
    if (!validObjectId(String(taskId))) {
      throw Object.assign(new Error('Select a valid related task.'), { status: 400 });
    }
    if (!department) {
      throw Object.assign(new Error('A related task can only be selected for a department meeting.'), { status: 400 });
    }
    task = await Task.findOne({ _id: taskId, department: department._id, deletedAt: null });
    if (!task) throw Object.assign(new Error('The related task is not available in this department.'), { status: 400 });
  }

  return {
    title,
    description,
    agenda,
    startsAt,
    endsAt: new Date(startsAt.getTime() + duration * 60_000),
    timezone,
    meetingUrl,
    room: room?._id || null,
    department: department?._id || null,
    task: task?._id || null,
    participants: participantUsers.map((participant) => participant._id),
    participantUsers,
  };
}

function handleProviderError(error, response, message) {
  console.error(message, error);
  response.status(502).json({ error: message });
}

export async function getMeetingOptions(request, response, next) {
  try {
    let departmentFilter = {};
    if (request.user.role === 'team_leader') {
      const department = await leaderDepartment(request.user);
      if (!department) {
        response.status(403).json({ error: 'An active department is required to manage meetings.' });
        return;
      }
      departmentFilter = { _id: department._id };
    } else if (request.user.role === 'team_member') {
      departmentFilter = { _id: request.user.department?._id || request.user.department || null };
    }

    const departments = await Department.find({ ...departmentFilter, isActive: true })
      .select('name')
      .sort({ name: 1 })
      .lean();
    const departmentIds = departments.map((department) => department._id);
    const userFilter = { isActive: true };
    const taskFilter = { deletedAt: null, department: { $in: departmentIds } };
    if (request.user.role === 'team_leader') {
      userFilter.department = departmentIds[0];
      userFilter.role = 'team_member';
    } else if (request.user.role === 'team_member') {
      userFilter._id = request.user._id;
      userFilter.department = request.user.department?._id || request.user.department;
      taskFilter.assignee = request.user._id;
    }

    const [users, tasks] = await Promise.all([
      User.find(userFilter).select('name username email role department').sort({ name: 1 }).lean(),
      Task.find(taskFilter).select('title status department').sort({ title: 1 }).limit(500).lean(),
    ]);
    let roomFilter = { isActive: true };
    if (request.user.role === 'team_leader') {
      roomFilter = {
        isActive: true,
        creator: request.user._id,
      };
    } else if (request.user.role === 'team_member') {
      roomFilter = { isActive: true, participants: request.user._id };
    }
    const rooms = await MeetingRoom.find(roomFilter)
      .populate(ROOM_POPULATE)
      .sort({ updatedAt: -1 })
      .limit(200);

    response.json({
      departments: departments.map((department) => ({ id: department._id.toString(), name: department.name })),
      users: users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        email: user.email || '',
        role: user.role,
        departmentId: user.department?.toString() || '',
      })),
      tasks: tasks.map((task) => ({
        id: task._id.toString(),
        title: task.title,
        status: task.status,
        departmentId: task.department?.toString() || '',
      })),
      rooms: rooms.map(serializeRoom),
      googleCalendarEnabled: isGoogleCalendarConfigured(),
    });
  } catch (error) {
    next(error);
  }
}

export async function listMeetingRooms(request, response, next) {
  try {
    const filter = request.user.role === 'admin'
      ? {}
      : { $or: [{ creator: request.user._id }, { participants: request.user._id }] };
    if (request.user.role === 'team_member') filter.isActive = true;
    const rooms = await MeetingRoom.find(filter)
      .populate(ROOM_POPULATE)
      .sort({ updatedAt: -1 })
      .limit(500);
    response.json({ rooms: rooms.map(serializeRoom) });
  } catch (error) {
    next(error);
  }
}

export async function createMeetingRoom(request, response, next) {
  try {
    const { name, description = '', purpose = '', departmentId = null, participantIds = [] } = request.body || {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || cleanName.length > 120) {
      response.status(400).json({ error: 'Enter a room name between 1 and 120 characters.' });
      return;
    }
    if (typeof description !== 'string' || description.length > 2000
      || typeof purpose !== 'string' || purpose.length > 1000) {
      response.status(400).json({ error: 'Room description or purpose exceeds the allowed length.' });
      return;
    }
    if (!Array.isArray(participantIds) || participantIds.length === 0 || participantIds.length > 100
      || participantIds.some((id) => !validObjectId(id))) {
      response.status(400).json({ error: 'Invite at least one valid participant.' });
      return;
    }

    let type;
    let department = null;
    let requiredRole;
    if (request.user.role === 'admin') {
      type = 'leadership';
      requiredRole = 'team_leader';
      if (departmentId) {
        response.status(400).json({ error: 'Admin leadership rooms are not tied to one department.' });
        return;
      }
    } else if (request.user.role === 'team_leader') {
      type = 'team';
      requiredRole = 'team_member';
      department = await leaderDepartment(request.user);
      if (!department) {
        response.status(403).json({ error: 'An active department is required to create a team room.' });
        return;
      }
      if (departmentId && !sameId(departmentId, department)) {
        response.status(403).json({ error: 'You can only create rooms for your assigned department.' });
        return;
      }
    } else {
      response.status(403).json({ error: 'Only Admins and Team Leaders can create meeting rooms.' });
      return;
    }

    const ids = [...new Set(participantIds.map(String))];
    const users = await User.find({ _id: { $in: ids }, role: requiredRole, isActive: true })
      .select('_id email department');
    if (users.length !== ids.length) {
      response.status(400).json({
        error: type === 'leadership'
          ? 'Only active Team Leaders can be invited to the Admin Meeting Room.'
          : 'Select active Team Members from your assigned department.',
      });
      return;
    }
    if (type === 'team' && users.some((member) => !sameId(member.department, department))) {
      response.status(400).json({ error: 'Team rooms can only invite members from your assigned department.' });
      return;
    }
    const room = await MeetingRoom.create({
      name: cleanName,
      description: description.trim(),
      purpose: purpose.trim(),
      type,
      creator: request.user._id,
      department: department?._id || null,
      participants: users.map((member) => member._id),
    });
    await room.populate(ROOM_POPULATE);
    await notifyRoomParticipants(
      room,
      users.map((member) => member._id),
      'Meeting room invitation',
      `You were invited to ${room.name}.`,
      'meeting-room-invitation',
    );
    await recordAuditEvent({
      actor: request.user,
      action: 'meeting.room.created',
      resourceType: 'meeting_room',
      resourceId: room._id,
      summary: `Created ${type === 'leadership' ? 'Admin leadership' : 'team'} room "${room.name}".`,
    });
    response.status(201).json({ room: serializeRoom(room) });
  } catch (error) {
    next(error);
  }
}

export async function updateMeetingRoom(request, response, next) {
  try {
    const { id } = request.params;
    if (!validObjectId(id)) {
      response.status(404).json({ error: 'Meeting room not found.' });
      return;
    }
    const room = await MeetingRoom.findById(id);
    if (!room) {
      response.status(404).json({ error: 'Meeting room not found.' });
      return;
    }
    if (!(await canManageRoom(request.user, room))) {
      response.status(403).json({ error: 'You do not have permission to manage this room.' });
      return;
    }

    const { name, description, purpose, isActive, participantIds } = request.body || {};
    if (name !== undefined) {
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName || cleanName.length > 120) {
        response.status(400).json({ error: 'Enter a room name between 1 and 120 characters.' });
        return;
      }
      room.name = cleanName;
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || description.length > 2000) {
        response.status(400).json({ error: 'Room description must be 2000 characters or fewer.' });
        return;
      }
      room.description = description.trim();
    }
    if (purpose !== undefined) {
      if (typeof purpose !== 'string' || purpose.length > 1000) {
        response.status(400).json({ error: 'Room purpose must be 1000 characters or fewer.' });
        return;
      }
      room.purpose = purpose.trim();
    }
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        response.status(400).json({ error: 'Room status must be active or archived.' });
        return;
      }
      room.isActive = isActive;
    }

    let addedIds = [];
    let removedIds = [];
    if (participantIds !== undefined) {
      if (!Array.isArray(participantIds) || participantIds.length > 100
        || participantIds.some((participantId) => !validObjectId(participantId))) {
        response.status(400).json({ error: 'Select valid room participants.' });
        return;
      }
      const ids = [...new Set(participantIds.map(String))];
      const role = room.type === 'leadership' ? 'team_leader' : 'team_member';
      const users = await User.find({ _id: { $in: ids }, role, isActive: true }).select('_id department');
      if (users.length !== ids.length) {
        response.status(400).json({ error: 'All room participants must be active accounts with the correct role.' });
        return;
      }
      if (room.type === 'team' && users.some((member) => !sameId(member.department, room.department))) {
        response.status(400).json({ error: 'Team rooms can only include members from their department.' });
        return;
      }
      const previousIds = room.participants.map(String);
      addedIds = ids.filter((participantId) => !previousIds.includes(participantId));
      removedIds = previousIds.filter((participantId) => !ids.includes(participantId));
      room.participants = users.map((member) => member._id);
    }

    await room.save();
    await room.populate(ROOM_POPULATE);
    if (addedIds.length) {
      await notifyRoomParticipants(room, addedIds, 'Meeting room invitation', `You were invited to ${room.name}.`, 'meeting-room-invitation');
      await recordAuditEvent({
        actor: request.user,
        action: 'meeting.room.participants_added',
        resourceType: 'meeting_room',
        resourceId: room._id,
        summary: `Invited ${addedIds.length} participant(s) to "${room.name}".`,
      });
    }
    if (removedIds.length) {
      await recordAuditEvent({
        actor: request.user,
        action: 'meeting.room.participants_removed',
        resourceType: 'meeting_room',
        resourceId: room._id,
        summary: `Removed ${removedIds.length} participant(s) from "${room.name}".`,
      });
    }
    await recordAuditEvent({
      actor: request.user,
      action: 'meeting.room.updated',
      resourceType: 'meeting_room',
      resourceId: room._id,
      summary: `Updated meeting room "${room.name}".`,
    });
    response.json({ room: serializeRoom(room) });
  } catch (error) {
    next(error);
  }
}

export async function addRoomAnnouncement(request, response, next) {
  try {
    const { id } = request.params;
    const text = typeof request.body?.text === 'string' ? request.body.text.trim() : '';
    if (!validObjectId(id)) {
      response.status(404).json({ error: 'Meeting room not found.' });
      return;
    }
    if (!text || text.length > 2000) {
      response.status(400).json({ error: 'Enter an announcement between 1 and 2000 characters.' });
      return;
    }
    const room = await MeetingRoom.findById(id);
    if (!room) {
      response.status(404).json({ error: 'Meeting room not found.' });
      return;
    }
    if (!(await canManageRoom(request.user, room))) {
      response.status(403).json({ error: 'Only the room organizer can share announcements.' });
      return;
    }
    room.announcements.push({ author: request.user._id, text });
    await room.save();
    await room.populate(ROOM_POPULATE);
    await notifyRoomParticipants(
      room,
      room.participants,
      'Meeting room announcement',
      `New announcement in ${room.name}: ${text.slice(0, 350)}`,
      `meeting-room-announcement-${room.announcements.at(-1)._id}`,
    );
    await recordAuditEvent({
      actor: request.user,
      action: 'meeting.room.announcement_added',
      resourceType: 'meeting_room',
      resourceId: room._id,
      summary: `Shared an announcement in "${room.name}".`,
    });
    response.status(201).json({ room: serializeRoom(room) });
  } catch (error) {
    next(error);
  }
}

export async function listMeetings(request, response, next) {
  try {
    const filter = {};
    if (request.user.role !== 'admin') {
      if (!['team_leader', 'team_member'].includes(request.user.role)) {
        response.status(403).json({ error: 'Meetings are not available for this account.' });
        return;
      }
      const invitedRooms = await MeetingRoom.find({
        participants: request.user._id,
        isActive: true,
      }).distinct('_id');
      filter.$or = [
        { participants: request.user._id },
        { organizer: request.user._id },
        { room: { $in: invitedRooms } },
      ];
    }
    if (request.user.role !== 'admin' && !['team_leader', 'team_member'].includes(request.user.role)) {
      response.status(403).json({ error: 'Meetings are not available for this account.' });
      return;
    }
    const meetings = await Meeting.find(filter)
      .populate(MEETING_POPULATE)
      .sort({ startsAt: -1, _id: -1 })
      .limit(500);
    const accessibleMeetings = request.user.role === 'admin'
      ? meetings
      : await Promise.all(meetings.map(async (meeting) => (
        await canAccessMeeting(request.user, meeting) ? meeting : null
      )));
    response.json({ meetings: accessibleMeetings.filter(Boolean).map(serializeMeeting) });
  } catch (error) {
    next(error);
  }
}

export async function createMeeting(request, response, next) {
  try {
    if (!MEETING_ROLES.includes(request.user.role)) {
      response.status(403).json({ error: 'Only Admins and Team Leaders can schedule meetings.' });
      return;
    }
    const fields = await validatedMeetingFields(request.body || {}, request);
    if (!fields.meetingUrl && !isGoogleCalendarConfigured()) {
      response.status(400).json({ error: 'Add a Google Meet URL or configure Google Calendar OAuth to generate one.' });
      return;
    }

    let calendarEvent = null;
    if (isGoogleCalendarConfigured()) {
      try {
        calendarEvent = await createCalendarEvent(fields);
        if (!fields.meetingUrl && !calendarEvent?.meetingUrl) {
          throw new Error('Google Calendar did not return a Google Meet link.');
        }
      } catch (error) {
        handleProviderError(error, response, 'Google Calendar could not create this meeting. Check the server OAuth configuration and Calendar API access.');
        return;
      }
    }

    let meeting;
    try {
      meeting = await Meeting.create({
        ...fields,
        organizer: request.user._id,
        meetingUrl: fields.meetingUrl || calendarEvent?.meetingUrl || '',
        calendarEventId: calendarEvent?.eventId || null,
      });
      await populateMeeting(meeting);
      await notifyParticipants(meeting, 'scheduled');
      await recordAuditEvent({
        actor: request.user,
        action: 'meeting.created',
        resourceType: 'meeting',
        resourceId: meeting._id,
        summary: `Scheduled meeting "${meeting.title}".`,
      });
    } catch (error) {
      if (calendarEvent?.eventId) {
        try {
          await deleteCalendarEvent({ calendarEventId: calendarEvent.eventId });
        } catch (cleanupError) {
          console.error('Failed to remove orphaned Google Calendar event:', cleanupError);
        }
      }
      throw error;
    }

    response.status(201).json({ meeting: serializeMeeting(meeting) });
  } catch (error) {
    if (error.status) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function updateMeeting(request, response, next) {
  try {
    const { id } = request.params;
    if (!validObjectId(id)) {
      response.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    const meeting = await Meeting.findById(id);
    if (!meeting) {
      response.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    if (!(await canManageMeeting(request.user, meeting))) {
      response.status(403).json({ error: 'You do not have permission to update this meeting.' });
      return;
    }
    if (meeting.status === 'cancelled') {
      response.status(409).json({ error: 'Cancelled meetings cannot be edited.' });
      return;
    }

    const fields = await validatedMeetingFields(request.body || {}, request, meeting);
    if (!fields.meetingUrl && !isGoogleCalendarConfigured() && !meeting.calendarEventId) {
      response.status(400).json({ error: 'Add a Google Meet URL or configure Google Calendar OAuth to generate one.' });
      return;
    }
    const updateData = { ...fields };
    delete updateData.participantUsers;
    if (meeting.calendarEventId) {
      try {
        const googleUrl = await updateCalendarEvent({ ...meeting.toObject(), ...fields, calendarEventId: meeting.calendarEventId });
        if (!fields.meetingUrl && googleUrl) updateData.meetingUrl = googleUrl;
      } catch (error) {
        handleProviderError(error, response, 'Google Calendar could not update this meeting; no meeting changes were saved.');
        return;
      }
    }

    Object.assign(meeting, updateData);
    await meeting.save();
    await populateMeeting(meeting);
    await notifyParticipants(meeting, 'scheduled');
    await recordAuditEvent({
      actor: request.user,
      action: 'meeting.updated',
      resourceType: 'meeting',
      resourceId: meeting._id,
      summary: `Updated meeting "${meeting.title}".`,
    });
    response.json({ meeting: serializeMeeting(meeting) });
  } catch (error) {
    if (error.status) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function cancelMeeting(request, response, next) {
  try {
    const { id } = request.params;
    if (!validObjectId(id)) {
      response.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    const meeting = await Meeting.findById(id);
    if (!meeting) {
      response.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    if (!(await canManageMeeting(request.user, meeting))) {
      response.status(403).json({ error: 'You do not have permission to cancel this meeting.' });
      return;
    }
    if (meeting.status !== 'cancelled') {
      try {
        await cancelCalendarEvent(meeting);
      } catch (error) {
        handleProviderError(error, response, 'Google Calendar could not cancel this meeting; no meeting changes were saved.');
        return;
      }
      meeting.status = 'cancelled';
      meeting.reminderSentAt = new Date();
      await meeting.save();
      await populateMeeting(meeting);
      await Promise.all(meeting.participants.map((recipient) => Notification.updateOne(
        { eventKey: `meeting-${meeting._id}-cancelled-${recipient._id}` },
        {
          $setOnInsert: {
            recipient: recipient._id,
            meeting: meeting._id,
            title: 'Meeting cancelled',
            message: `"${meeting.title}" has been cancelled.`,
            isRead: false,
          },
        },
        { upsert: true },
      )));
      await recordAuditEvent({
        actor: request.user,
        action: 'meeting.cancelled',
        resourceType: 'meeting',
        resourceId: meeting._id,
        summary: `Cancelled meeting "${meeting.title}".`,
      });
    }
    response.json({ meeting: serializeMeeting(meeting) });
  } catch (error) {
    next(error);
  }
}

export async function deleteMeeting(request, response, next) {
  try {
    const { id } = request.params;
    if (!validObjectId(id)) {
      response.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    const meeting = await Meeting.findById(id);
    if (!meeting) {
      response.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    if (!(await canManageMeeting(request.user, meeting))) {
      response.status(403).json({ error: 'You do not have permission to delete this meeting.' });
      return;
    }
    try {
      await deleteCalendarEvent(meeting);
    } catch (error) {
      handleProviderError(error, response, 'Google Calendar could not delete this meeting; no meeting changes were saved.');
      return;
    }
    await Meeting.deleteOne({ _id: meeting._id });
    await recordAuditEvent({
      actor: request.user,
      action: 'meeting.deleted',
      resourceType: 'meeting',
      resourceId: meeting._id,
      summary: `Deleted meeting "${meeting.title}".`,
    });
    response.json({ message: 'Meeting deleted.' });
  } catch (error) {
    next(error);
  }
}

export async function addMeetingNote(request, response, next) {
  try {
    const { id } = request.params;
    const { type = 'note', text } = request.body || {};
    if (!validObjectId(id)) {
      response.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    if (!NOTE_TYPES.includes(type) || typeof text !== 'string' || !text.trim() || text.trim().length > 2000) {
      response.status(400).json({ error: 'Choose a note type and enter text between 1 and 2000 characters.' });
      return;
    }
    const meeting = await Meeting.findById(id);
    if (!meeting) {
      response.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    if (!(await canAccessMeeting(request.user, meeting))) {
      response.status(403).json({ error: 'Only the organizer and selected participants can add meeting notes.' });
      return;
    }
    meeting.notes.push({ author: request.user._id, type, text: text.trim() });
    await meeting.save();
    await populateMeeting(meeting);
    response.status(201).json({ meeting: serializeMeeting(meeting) });
  } catch (error) {
    next(error);
  }
}

export async function addMeetingFollowUp(request, response, next) {
  try {
    const { id } = request.params;
    const { title, assignedTo, dueAt } = request.body || {};
    if (!validObjectId(id)) {
      response.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    if (!cleanTitle || cleanTitle.length > 160) {
      response.status(400).json({ error: 'Enter a follow-up task title between 1 and 160 characters.' });
      return;
    }
    const meeting = await Meeting.findById(id);
    if (!meeting) {
      response.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    if (!(await canAccessMeeting(request.user, meeting))) {
      response.status(403).json({ error: 'Only the organizer and selected participants can add follow-up tasks.' });
      return;
    }
    let assignee = request.user._id;
    if (assignedTo) {
      if (!validObjectId(assignedTo)) {
        response.status(400).json({ error: 'Select a valid follow-up assignee.' });
        return;
      }
      const allowedAssignees = [meeting.organizer, ...meeting.participants].map(String);
      if (!allowedAssignees.includes(String(assignedTo))) {
        response.status(400).json({ error: 'Follow-up tasks can only be assigned to the organizer or a participant.' });
        return;
      }
      assignee = assignedTo;
    }
    const dueDate = dueAt ? parseDate(dueAt) : null;
    if (dueAt && !dueDate) {
      response.status(400).json({ error: 'Enter a valid follow-up due date.' });
      return;
    }
    meeting.followUps.push({
      title: cleanTitle,
      assignedTo: assignee,
      dueAt: dueDate,
      createdBy: request.user._id,
    });
    await meeting.save();
    await populateMeeting(meeting);
    response.status(201).json({ meeting: serializeMeeting(meeting) });
  } catch (error) {
    next(error);
  }
}

export async function updateMeetingFollowUp(request, response, next) {
  try {
    const { id, followUpId } = request.params;
    if (!validObjectId(id) || !validObjectId(followUpId)) {
      response.status(404).json({ error: 'Follow-up task not found.' });
      return;
    }
    const meeting = await Meeting.findById(id);
    if (!meeting || !(await canAccessMeeting(request.user, meeting))) {
      response.status(404).json({ error: 'Follow-up task not found.' });
      return;
    }
    const followUp = meeting.followUps.id(followUpId);
    if (!followUp) {
      response.status(404).json({ error: 'Follow-up task not found.' });
      return;
    }
    if (!sameId(request.user, followUp.assignedTo)
      && !(await canManageMeeting(request.user, meeting))) {
      response.status(403).json({ error: 'Only the assignee or meeting organizer can update this follow-up.' });
      return;
    }
    const { status } = request.body || {};
    if (!['open', 'completed'].includes(status)) {
      response.status(400).json({ error: 'Follow-up status must be open or completed.' });
      return;
    }
    followUp.status = status;
    await meeting.save();
    await populateMeeting(meeting);
    response.json({ meeting: serializeMeeting(meeting) });
  } catch (error) {
    next(error);
  }
}

export async function sendMeetingReminders() {
  const now = new Date();
  const dueMeetings = await Meeting.find({
    status: 'scheduled',
    startsAt: { $gt: now, $lte: new Date(now.getTime() + 15 * 60_000) },
    reminderSentAt: null,
    participants: { $exists: true, $ne: [] },
  }).limit(100);
  for (const meeting of dueMeetings) {
    await notifyParticipants(meeting, 'reminder');
    await Meeting.updateOne(
      { _id: meeting._id, reminderSentAt: null },
      { $set: { reminderSentAt: new Date() } },
    );
  }
}
