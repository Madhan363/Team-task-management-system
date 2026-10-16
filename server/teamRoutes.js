import bcrypt from 'bcryptjs';
import express from 'express';
import mongoose from 'mongoose';
import {
  Department,
  TaskHistory,
  TaskResponse,
  Team,
  TeamNotification,
  TeamTask,
  User,
  serializeTeamTask,
} from './models.js';

const router = express.Router();

function validObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function requireRole(role) {
  return (request, response, next) => {
    if (request.user.role !== role) {
      response.status(403).json({ error: `This action requires the ${role.replace('_', ' ')} role.` });
      return;
    }
    next();
  };
}

function serializeMember(member) {
  return {
    id: member.user._id.toString(),
    name: member.user.name,
    email: member.user.email || '',
    username: member.user.username,
  };
}

async function notify(recipient, team, task, eventKey, message) {
  try {
    await TeamNotification.updateOne(
      { eventKey },
      { $setOnInsert: { recipient, team, task, eventKey, message } },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000 || !await TeamNotification.exists({ eventKey })) throw error;
  }
}

async function recordTaskChange(task, actor, oldStatus, newStatus, comment = '') {
  await TaskHistory.create({ task: task._id, changedBy: actor._id, oldStatus, newStatus, comment });
}

async function findOwnedTeam(teamId, ownerId) {
  if (!validObjectId(teamId)) return null;
  return Team.findOne({ _id: teamId, owner: ownerId });
}

router.get('/context', (request, response) => {
  const role = {
    admin: 'admin',
    team_leader: 'leader',
    team_member: 'member',
    personal: 'personal',
  }[request.user.role] || 'personal';
  response.json({ role });
});

router.get('/leader/dashboard', requireRole('team_leader'), async (request, response, next) => {
  try {
    const teams = await Team.find({ owner: request.user._id })
      .populate('members.user', 'name email username')
      .sort({ createdAt: 1 });
    const teamIds = teams.map((team) => team._id);
    const [tasks, notifications] = await Promise.all([
      TeamTask.find({ team: { $in: teamIds } })
        .populate('assignee', 'name email username')
        .populate('assignedBy', 'name email username')
        .sort({ createdAt: -1 }),
      TeamNotification.find({ recipient: request.user._id, team: { $in: teamIds } })
        .sort({ createdAt: -1 })
        .limit(50),
    ]);
    response.json({
      teams: teams.map((team) => ({
        id: team._id.toString(),
        name: team.name,
        description: team.description,
        members: team.members.map(serializeMember),
      })),
      tasks: tasks.map((task) => serializeTeamTask(task, { includeAssignee: true })),
      stats: {
        members: teams.reduce((count, team) => count + team.members.length, 0),
        assigned: tasks.length,
        awaitingAcknowledgement: tasks.filter((task) => !task.acknowledgedAt).length,
        inProgress: tasks.filter((task) => task.status === 'in_progress').length,
        submitted: tasks.filter((task) => task.status === 'submitted_review').length,
        completed: tasks.filter((task) => task.status === 'completed').length,
        overdue: tasks.filter((task) => task.status !== 'completed' && task.dueDate && task.dueDate < new Date()).length,
      },
      notifications: notifications.map((notification) => ({
        id: notification._id.toString(),
        taskId: notification.task.toString(),
        message: notification.message,
        read: Boolean(notification.readAt),
        createdAt: notification.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/member/dashboard', requireRole('team_member'), async (request, response, next) => {
  try {
    const teams = await Team.find({ 'members.user': request.user._id }).select('_id name');
    if (!teams.length) {
      response.json({ tasks: [] });
      return;
    }
    const tasks = await TeamTask.find({
      team: { $in: teams.map((team) => team._id) },
      assignee: request.user._id,
    }).populate('assignedBy', 'name username').sort({ createdAt: -1 });
    const notifications = await TeamNotification.find({
      recipient: request.user._id,
      team: { $in: teams.map((team) => team._id) },
      task: { $ne: null },
    })
      .sort({ createdAt: -1 }).limit(50);
    response.json({
      tasks: tasks.map((task) => ({
        ...serializeTeamTask(task),
        teamName: teams.find((team) => team._id.equals(task.team))?.name || '',
        assignedBy: task.assignedBy ? { name: task.assignedBy.name, username: task.assignedBy.username } : null,
      })),
      notifications: notifications.map((notification) => ({
        id: notification._id.toString(),
        taskId: notification.task.toString(),
        message: notification.message,
        read: Boolean(notification.readAt),
        createdAt: notification.createdAt.toISOString(),
      })),
      stats: {
        total: tasks.length,
        awaitingAcknowledgement: tasks.filter((task) => !task.acknowledgedAt).length,
        inProgress: tasks.filter((task) => task.status === 'in_progress').length,
        submitted: tasks.filter((task) => task.status === 'submitted_review').length,
        completed: tasks.filter((task) => task.status === 'completed').length,
        overdue: tasks.filter((task) => task.status !== 'completed' && task.dueDate && task.dueDate < new Date()).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/teams', requireRole('team_leader'), async (request, response, next) => {
  try {
    const { name, description = '' } = request.body || {};
    if (Object.keys(request.body || {}).some((key) => !['name', 'description'].includes(key))) {
      response.status(400).json({ error: 'Only a team name and description are allowed.' });
      return;
    }
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
      response.status(400).json({ error: 'Team name is required and must be 80 characters or fewer.' });
      return;
    }
    if (typeof description !== 'string' || description.trim().length > 500) {
      response.status(400).json({ error: 'Team description must be 500 characters or fewer.' });
      return;
    }
    const department = request.user.department
      ? await Department.findOne({
        _id: request.user.department,
        teamLeader: request.user._id,
        isActive: true,
      })
      : null;
    if (!department) {
      response.status(403).json({ error: 'Ask an Admin to assign you as an active department Team Leader first.' });
      return;
    }
    const team = await Team.create({
      name: name.trim(),
      description: description.trim(),
      owner: request.user._id,
      department: department._id,
    });
    response.status(201).json({
      team: { id: team._id.toString(), name: team.name, description: team.description, members: [] },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/members', requireRole('team_leader'), async (request, response, next) => {
  try {
    const { name, username, email, password } = request.body || {};
    if (Object.keys(request.body || {}).some((key) => !['name', 'username', 'email', 'password'].includes(key))) {
      response.status(400).json({ error: 'One or more account fields are not allowed.' });
      return;
    }
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const department = request.user.department
      ? await Department.findOne({ _id: request.user.department, teamLeader: request.user._id, isActive: true })
      : null;
    if (!department) {
      response.status(403).json({ error: 'Ask an Admin to assign you to an active department first.' });
      return;
    }
    if (!cleanName || cleanName.length > 80
      || !/^[a-z0-9_]{3,30}$/.test(cleanUsername)
      || cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
      || typeof password !== 'string' || password.length < 8 || password.length > 100) {
      response.status(400).json({ error: 'Enter a valid name, username, email, and password.' });
      return;
    }
    const member = await User.create({
      name: cleanName,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'team_member',
      department: department._id,
    });
    response.status(201).json({
      member: {
        id: member._id.toString(),
        name: member.name,
        username: member.username,
        email: member.email,
        department: department.name,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'That username or email is already registered.' });
      return;
    }
    next(error);
  }
});

router.post('/teams/:teamId/members', requireRole('team_leader'), async (request, response, next) => {
  try {
    const team = await findOwnedTeam(request.params.teamId, request.user._id);
    if (!team) {
      response.status(404).json({ error: 'Team not found.' });
      return;
    }
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    if (Object.keys(request.body || {}).some((key) => key !== 'email')
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      response.status(400).json({ error: 'Enter a valid member email address.' });
      return;
    }
    const member = await User.findOne({ email });
    if (!member) {
      response.status(404).json({ error: 'No account is registered with that email address.' });
      return;
    }
    if (!member.isActive || member.role !== 'team_member') {
      response.status(400).json({ error: 'Only active Team Member accounts can join a team.' });
      return;
    }
    if (team.department && (!member.department || !member.department.equals(team.department))) {
      response.status(403).json({ error: 'The selected member must belong to the leader’s department.' });
      return;
    }
    if (member._id.equals(team.owner)) {
      response.status(400).json({ error: 'The team leader cannot be added as a member.' });
      return;
    }
    if (team.members.some((entry) => entry.user.equals(member._id))) {
      response.status(409).json({ error: 'That user is already a team member.' });
      return;
    }
    team.members.push({ user: member._id });
    await team.save();
    response.status(201).json({ member: serializeMember({ user: member }) });
  } catch (error) {
    next(error);
  }
});

router.post('/teams/:teamId/tasks', requireRole('team_leader'), async (request, response, next) => {
  try {
    const team = await findOwnedTeam(request.params.teamId, request.user._id);
    if (!team) {
      response.status(404).json({ error: 'Team not found.' });
      return;
    }
    const body = request.body || {};
    const allowed = ['title', 'description', 'priority', 'startDate', 'dueDate', 'assigneeId'];
    if (Object.keys(body).some((key) => !allowed.includes(key))) {
      response.status(400).json({ error: 'One or more task fields are not allowed.' });
      return;
    }
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof (body.description ?? '') === 'string' ? (body.description ?? '').trim() : null;
    const priority = body.priority ?? 'medium';
    const dueDate = body.dueDate === null || body.dueDate === '' || body.dueDate === undefined
      ? null
      : typeof body.dueDate === 'string' && !Number.isNaN(Date.parse(body.dueDate))
        ? new Date(body.dueDate)
        : undefined;
    const startDate = body.startDate === null || body.startDate === '' || body.startDate === undefined
      ? null
      : typeof body.startDate === 'string' && !Number.isNaN(Date.parse(body.startDate))
        ? new Date(body.startDate)
        : undefined;
    const member = await User.findOne({
      _id: body.assigneeId,
      role: 'team_member',
      isActive: true,
      ...(team.department ? { department: team.department } : {}),
    });
    if (!title || title.length > 120 || description === null || description.length > 2000
      || !['low', 'medium', 'high'].includes(priority) || dueDate === undefined
      || startDate === undefined
      || !validObjectId(body.assigneeId)
      || !member
      || !team.members.some((entry) => entry.user.equals(body.assigneeId))) {
      response.status(400).json({ error: 'Enter a valid task and select one member of this team.' });
      return;
    }
    const task = await TeamTask.create({
      team: team._id,
      title,
      description,
      priority,
      dueDate,
      assignee: body.assigneeId,
      assignedBy: request.user._id,
      startDate,
    });
    await Promise.all([
      task.populate('assignee', 'name email username'),
      recordTaskChange(task, request.user, '', 'assigned'),
      notify(
        member._id,
        team._id,
        task._id,
        `task-assigned:${task._id}`,
        `New task assigned: "${task.title}".`,
      ),
    ]);
    response.status(201).json({ task: serializeTeamTask(task, { includeAssignee: true }) });
  } catch (error) {
    next(error);
  }
});

router.patch('/tasks/:taskId/acknowledge', requireRole('team_member'), async (request, response, next) => {
  try {
    if (Object.keys(request.body || {}).length) {
      response.status(400).json({ error: 'Acknowledgement does not accept any fields.' });
      return;
    }
    if (!validObjectId(request.params.taskId)) {
      response.status(404).json({ error: 'Assigned task not found.' });
      return;
    }
    const task = await TeamTask.findOne({
      _id: request.params.taskId,
      assignee: request.user._id,
    }).populate('team', 'name owner');
    if (!task || !task.team) {
      response.status(404).json({ error: 'Assigned task not found.' });
      return;
    }
    const membership = await Team.exists({ _id: task.team._id, 'members.user': request.user._id });
    if (!membership) {
      response.status(403).json({ error: 'You cannot acknowledge a task that is not assigned to you.' });
      return;
    }
    if (!task.acknowledgedAt) {
      task.acknowledgedAt = new Date();
      await task.save();
      await recordTaskChange(task, request.user, task.status, task.status, 'Acknowledged task.');
    }
    await notify(
      task.team.owner,
      task.team._id,
      task._id,
      `task-acknowledged:${task._id}`,
      `${request.user.name} acknowledged the task "${task.title}".`,
    );
    response.json({ task: serializeTeamTask(task) });
  } catch (error) {
    next(error);
  }
});

router.patch('/tasks/:taskId/status', requireRole('team_member'), async (request, response, next) => {
  try {
    const { status } = request.body || {};
    if (Object.keys(request.body || {}).some((key) => key !== 'status')
      || status !== 'in_progress') {
      response.status(400).json({ error: 'Members can start an acknowledged task; submit it for review when finished.' });
      return;
    }
    const task = await TeamTask.findOne({
      _id: request.params.taskId,
      assignee: request.user._id,
      acknowledgedAt: { $ne: null },
      status: { $in: ['assigned', 'in_progress'] },
    }).populate('team', 'owner');
    if (!task) {
      response.status(404).json({ error: 'Assigned task not found.' });
      return;
    }
    const previousStatus = task.status;
    task.status = 'in_progress';
    if (!task.startDate) task.startDate = new Date();
    await task.save();
    if (previousStatus !== task.status) {
      await recordTaskChange(task, request.user, previousStatus, task.status);
    }
    response.json({ task: serializeTeamTask(task) });
  } catch (error) {
    if (error.name === 'CastError') {
      response.status(404).json({ error: 'Assigned task not found.' });
      return;
    }
    next(error);
  }
});

router.patch('/tasks/:taskId/submit', requireRole('team_member'), async (request, response, next) => {
  try {
    if (Object.keys(request.body || {}).length) {
      response.status(400).json({ error: 'Task submission does not accept additional fields.' });
      return;
    }
    const task = await TeamTask.findOne({
      _id: request.params.taskId,
      assignee: request.user._id,
      acknowledgedAt: { $ne: null },
      status: 'in_progress',
    }).populate('team', 'owner');
    if (!task) {
      response.status(404).json({ error: 'Only an in-progress task assigned to you can be submitted.' });
      return;
    }
    task.status = 'submitted_review';
    task.submittedAt = new Date();
    await task.save();
    await Promise.all([
      recordTaskChange(task, request.user, 'in_progress', 'submitted_review'),
      notify(
        task.team.owner,
        task.team._id,
        task._id,
        `task-submitted:${task._id}:${task.updatedAt.getTime()}`,
        `${request.user.name} submitted "${task.title}" for review.`,
      ),
    ]);
    response.json({ task: serializeTeamTask(task) });
  } catch (error) {
    if (error.name === 'CastError') {
      response.status(404).json({ error: 'Assigned task not found.' });
      return;
    }
    next(error);
  }
});

router.patch('/tasks/:taskId/review', requireRole('team_leader'), async (request, response, next) => {
  try {
    const { decision, comment = '' } = request.body || {};
    if (Object.keys(request.body || {}).some((key) => !['decision', 'comment'].includes(key))
      || !['approve', 'changes'].includes(decision)
      || typeof comment !== 'string' || comment.trim().length > 2000
      || (decision === 'changes' && !comment.trim())) {
      response.status(400).json({ error: 'Choose approve or changes; a comment is required when requesting changes.' });
      return;
    }
    const task = await TeamTask.findOne({ _id: request.params.taskId })
      .populate('team', 'owner');
    if (!task || !task.team || !task.team.owner.equals(request.user._id)) {
      response.status(404).json({ error: 'Submitted task not found.' });
      return;
    }
    if (task.status !== 'submitted_review') {
      response.status(409).json({ error: 'Only tasks submitted for review can be reviewed.' });
      return;
    }
    const previousStatus = task.status;
    task.status = decision === 'approve' ? 'completed' : 'in_progress';
    task.completedAt = decision === 'approve' ? new Date() : null;
    await task.save();
    const message = comment.trim();
    await Promise.all([
      recordTaskChange(task, request.user, previousStatus, task.status, message),
      ...(message ? [TaskResponse.create({
        task: task._id,
        user: request.user._id,
        responseType: 'review',
        message,
      })] : []),
      notify(
        task.assignee,
        task.team._id,
        task._id,
        `task-review:${task._id}:${task.updatedAt.getTime()}`,
        decision === 'approve'
          ? `Your task "${task.title}" was approved.`
          : `Changes were requested for "${task.title}": ${message}`,
      ),
    ]);
    response.json({ task: serializeTeamTask(task, { includeAssignee: true }) });
  } catch (error) {
    if (error.name === 'CastError') {
      response.status(404).json({ error: 'Submitted task not found.' });
      return;
    }
    next(error);
  }
});

router.post('/tasks/:taskId/responses', async (request, response, next) => {
  try {
    const { message, responseType = 'comment' } = request.body || {};
    if (Object.keys(request.body || {}).some((key) => !['message', 'responseType'].includes(key))
      || typeof message !== 'string' || !message.trim() || message.trim().length > 2000
      || !['comment', 'clarification'].includes(responseType)) {
      response.status(400).json({ error: 'Enter a valid comment or clarification request.' });
      return;
    }
    const task = await TeamTask.findOne({ _id: request.params.taskId }).populate('team', 'owner');
    if (!task || !task.team
      || (!task.team.owner.equals(request.user._id) && !task.assignee.equals(request.user._id))) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    const result = await TaskResponse.create({
      task: task._id,
      user: request.user._id,
      responseType,
      message: message.trim(),
    });
    await Promise.all([
      TaskHistory.create({
        task: task._id,
        changedBy: request.user._id,
        oldStatus: task.status,
        newStatus: task.status,
        comment: message.trim(),
      }),
      notify(
        task.team.owner.equals(request.user._id) ? task.assignee : task.team.owner,
        task.team._id,
        task._id,
        `task-response:${result._id}`,
        `${request.user.name} added a ${responseType} on "${task.title}".`,
      ),
    ]);
    response.status(201).json({
      response: {
        id: result._id.toString(),
        responseType: result.responseType,
        message: result.message,
        createdAt: result.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    next(error);
  }
});

router.get('/tasks/:taskId/history', async (request, response, next) => {
  try {
    const task = await TeamTask.findById(request.params.taskId).populate('team', 'owner');
    if (!task || !task.team
      || (!task.team.owner.equals(request.user._id) && !task.assignee.equals(request.user._id))) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    const [history, responses] = await Promise.all([
      TaskHistory.find({ task: task._id }).populate('changedBy', 'name username').sort({ createdAt: -1 }),
      TaskResponse.find({ task: task._id }).populate('user', 'name username').sort({ createdAt: -1 }),
    ]);
    response.json({
      history: history.map((entry) => ({
        id: entry._id.toString(),
        actor: entry.changedBy.name,
        oldStatus: entry.oldStatus,
        newStatus: entry.newStatus,
        comment: entry.comment,
        createdAt: entry.createdAt.toISOString(),
      })),
      responses: responses.map((entry) => ({
        id: entry._id.toString(),
        author: entry.user.name,
        responseType: entry.responseType,
        message: entry.message,
        createdAt: entry.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error.name === 'CastError') {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    next(error);
  }
});

router.patch('/notifications/:notificationId/read', async (request, response, next) => {
  try {
    const notification = await TeamNotification.findOneAndUpdate(
      { _id: request.params.notificationId, recipient: request.user._id },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!notification) {
      response.status(404).json({ error: 'Notification not found.' });
      return;
    }
    response.json({ id: notification._id.toString(), read: true });
  } catch (error) {
    if (error.name === 'CastError') {
      response.status(404).json({ error: 'Notification not found.' });
      return;
    }
    next(error);
  }
});

export default router;
