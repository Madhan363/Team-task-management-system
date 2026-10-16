import bcrypt from 'bcryptjs';
import express from 'express';
import mongoose from 'mongoose';
import {
  Department,
  Task,
  TaskHistory,
  TaskResponse,
  Team,
  TeamNotification,
  TeamTask,
  User,
  serializeTeamTask,
  serializeUser,
} from './models.js';

const router = express.Router();
const VALID_ROLES = ['admin', 'team_leader', 'team_member'];

router.get('/dashboard', async (request, response, next) => {
  try {
    const [users, personalTasks, teams, teamTasks] = await Promise.all([
      User.find().select('-passwordHash').populate('department', 'name').sort({ createdAt: -1 }),
      Task.find({ deletedAt: null }).populate('user', 'name username email department').sort({ createdAt: -1 }),
      Team.find().populate('owner', 'name username email').populate('members.user', 'name username email').populate('department', 'name'),
      TeamTask.find().populate('assignee', 'name username email department').populate('team', 'name department'),
    ]);
    const tasksByUser = new Map();
    for (const task of personalTasks) {
      const key = task.user._id.toString();
      const counts = tasksByUser.get(key) || { total: 0, completed: 0 };
      counts.total += 1;
      if (task.completed) counts.completed += 1;
      tasksByUser.set(key, counts);
    }
    const teamProgress = new Map();
    for (const task of teamTasks) {
      const key = task.assignee._id.toString();
      const counts = teamProgress.get(key) || { total: 0, completed: 0 };
      counts.total += 1;
      if (task.status === 'completed') counts.completed += 1;
      teamProgress.set(key, counts);
    }
    const allTasks = [
      ...personalTasks.map((task) => ({
        id: task._id.toString(),
        kind: 'personal',
        title: task.title,
        status: task.completed ? 'completed' : 'todo',
        priority: task.priority,
        dueDate: task.dueDate?.toISOString() || null,
        completedAt: task.completedAt?.toISOString() || null,
        owner: {
          id: task.user._id.toString(),
          name: task.user.name,
          username: task.user.username,
          departmentId: task.user.department?.toString() || null,
        },
      })),
      ...teamTasks.map((task) => ({
        ...serializeTeamTask(task, { includeAssignee: true }),
        kind: 'team',
        teamName: task.team.name,
        departmentId: task.team.department?._id?.toString() || task.team.department?.toString() || null,
        owner: task.assignee ? {
          id: task.assignee._id.toString(),
          name: task.assignee.name,
          username: task.assignee.username,
        } : null,
      })),
    ];
    const activeUsers = users.filter((user) => user.isActive).length;
    const completedCount = allTasks.filter((task) => task.status === 'completed').length;
    const departmentTaskCounts = new Map();
    for (const task of allTasks) {
      const departmentId = task.departmentId || task.owner?.departmentId;
      if (departmentId) departmentTaskCounts.set(departmentId, (departmentTaskCounts.get(departmentId) || 0) + 1);
    }
    const completionTrend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      return {
        date: date.toISOString().slice(0, 10),
        completed: allTasks.filter((task) => (
          task.completedAt && new Date(task.completedAt) >= date && new Date(task.completedAt) < nextDay
        )).length,
      };
    });
    response.json({
      users: users.map((user) => ({
        ...serializeUser(user),
        role: user.role,
        isActive: user.isActive,
        department: user.department ? { id: user.department._id.toString(), name: user.department.name } : null,
        createdAt: user.createdAt.toISOString(),
        personalProgress: tasksByUser.get(user._id.toString()) || { total: 0, completed: 0 },
        teamProgress: teamProgress.get(user._id.toString()) || { total: 0, completed: 0 },
      })),
      teams: teams.map((team) => ({
        id: team._id.toString(),
        name: team.name,
        owner: { id: team.owner._id.toString(), name: team.owner.name },
        memberCount: team.members.length,
      })),
      departments: await Department.find().populate('teamLeader', 'name username email').sort({ name: 1 }).then((departments) => (
        departments.map((department) => ({
          id: department._id.toString(),
          name: department.name,
          description: department.description,
          isActive: department.isActive,
          teamLeader: { id: department.teamLeader._id.toString(), name: department.teamLeader.name },
          userCount: users.filter((user) => user.department?._id.equals(department._id)).length,
          taskCount: departmentTaskCounts.get(department._id.toString()) || 0,
        }))
      )),
      tasks: allTasks,
      stats: {
        users: users.length,
        activeUsers,
        inactiveUsers: users.length - activeUsers,
        teams: teams.length,
        departments: await Department.countDocuments(),
        tasks: allTasks.length,
        completed: completedCount,
        incomplete: allTasks.length - completedCount,
        completionPercent: allTasks.length ? Math.round((completedCount / allTasks.length) * 100) : 0,
        completionTrend,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/users', async (request, response, next) => {
  try {
    const { name, username, email, password, role, departmentId, isActive = true } = request.body || {};
    if (Object.keys(request.body || {}).some((key) => !['name', 'username', 'email', 'password', 'role', 'departmentId', 'isActive'].includes(key))) {
      response.status(400).json({ error: 'One or more account fields are not allowed.' });
      return;
    }
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanName || cleanName.length > 80
      || !/^[a-z0-9_]{3,30}$/.test(cleanUsername)
      || cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
      || typeof password !== 'string' || password.length < 8 || password.length > 100
      || !['admin', 'team_leader', 'team_member'].includes(role)
      || typeof isActive !== 'boolean'
      || (departmentId !== null && departmentId !== undefined && !mongoose.isValidObjectId(departmentId))) {
      response.status(400).json({ error: 'Enter a valid name, username, email, password, and account role.' });
      return;
    }
    const department = departmentId ? await Department.findOne({ _id: departmentId, isActive: true }) : null;
    if (departmentId && !department) {
      response.status(400).json({ error: 'Choose an active department.' });
      return;
    }
    if (role === 'team_leader' && department) {
      response.status(400).json({ error: 'Assign Team Leaders through Department Manager.' });
      return;
    }
    const user = await User.create({
      name: cleanName,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role,
      department: department?._id || null,
      isActive,
    });
    response.status(201).json({ user: { ...serializeUser(user), isActive: user.isActive } });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'That username or email is already registered.' });
      return;
    }
    next(error);
  }
});

router.patch('/users/:userId', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.userId)) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }
    const user = await User.findById(request.params.userId);
    if (!user) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }
    const allowedFields = ['name', 'username', 'email', 'role', 'isActive', 'departmentId'];
    const body = request.body || {};
    if (Object.keys(body).length === 0 || Object.keys(body).some((key) => !allowedFields.includes(key))) {
      response.status(400).json({ error: 'Provide valid account fields to update.' });
      return;
    }
    const name = Object.hasOwn(body, 'name') && typeof body.name === 'string' ? body.name.trim() : user.name;
    const username = Object.hasOwn(body, 'username') && typeof body.username === 'string'
      ? body.username.trim().toLowerCase()
      : user.username;
    const email = Object.hasOwn(body, 'email') && typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : user.email;
    const role = Object.hasOwn(body, 'role') ? body.role : user.role;
    const isActive = Object.hasOwn(body, 'isActive') ? body.isActive : user.isActive;
    const departmentId = Object.hasOwn(body, 'departmentId')
      ? body.departmentId
      : user.department?.toString() || null;
    if (!name || name.length > 80 || !/^[a-z0-9_]{3,30}$/.test(username)
      || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || !VALID_ROLES.includes(role) || typeof isActive !== 'boolean'
      || (departmentId !== null && !mongoose.isValidObjectId(departmentId))) {
      response.status(400).json({ error: 'The account fields are invalid.' });
      return;
    }
    const department = departmentId ? await Department.findOne({ _id: departmentId, isActive: true }) : null;
    if (departmentId && !department) {
      response.status(400).json({ error: 'Choose an active department.' });
      return;
    }
    if (role === 'team_leader' && department
      && !department.teamLeader.equals(user._id)
      && await User.exists({ role: 'team_leader', department: department._id, _id: { $ne: user._id } })) {
      response.status(409).json({ error: 'That department already has a Team Leader.' });
      return;
    }
    if (user.role === 'team_leader' && user.department
      && (role !== 'team_leader' || !isActive)) {
      const ledDepartment = await Department.exists({ _id: user.department, teamLeader: user._id });
      if (ledDepartment) {
        response.status(409).json({ error: 'Reassign this department’s Team Leader before changing this account role or status.' });
        return;
      }
    }
    if (role === 'team_leader' && department && !department.teamLeader.equals(user._id)) {
      response.status(409).json({ error: 'Assign this account as the department Team Leader in Department Manager.' });
      return;
    }
    if (user._id.equals(request.user._id)
      && (role !== 'admin' || isActive !== true)) {
      response.status(400).json({ error: 'You cannot remove your own administrator access or deactivate your account.' });
      return;
    }
    if (user.role === 'admin' && (role !== 'admin' || !isActive)) {
      const otherActiveAdmins = await User.countDocuments({
        role: 'admin',
        isActive: true,
        _id: { $ne: user._id },
      });
      if (otherActiveAdmins === 0) {
        response.status(409).json({ error: 'The last active administrator cannot be demoted or deactivated.' });
        return;
      }
    }
    user.name = name;
    user.username = username;
    user.email = email;
    user.role = role;
    user.isActive = isActive;
    user.department = department?._id || null;
    await user.save();
    response.json({ user: { ...serializeUser(user), isActive: user.isActive } });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'That username or email is already registered.' });
      return;
    }
    next(error);
  }
});

router.delete('/users/:userId', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.userId)) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }
    const user = await User.findById(request.params.userId);
    if (!user) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }
    if (user._id.equals(request.user._id)) {
      response.status(400).json({ error: 'You cannot delete your own administrator account.' });
      return;
    }
    if (user.role === 'admin' && await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: user._id } }) === 0) {
      response.status(409).json({ error: 'The last active administrator cannot be deleted.' });
      return;
    }
    if (await Team.exists({ owner: user._id }) || await Department.exists({ teamLeader: user._id })) {
      response.status(409).json({ error: 'Reassign the user’s teams and departments before deleting this account.' });
      return;
    }
    if (await TeamTask.exists({ assignee: user._id })) {
      response.status(409).json({ error: 'Reassign or remove the user’s team tasks before deleting this account.' });
      return;
    }
    const membershipTeams = await Team.find({ 'members.user': user._id }).select('_id');
    await Promise.all([
      Task.deleteMany({ user: user._id }),
      Team.updateMany({ 'members.user': user._id }, { $pull: { members: { user: user._id } } }),
      TeamNotification.deleteMany({ recipient: user._id }),
      TaskResponse.deleteMany({ user: user._id }),
      TaskHistory.deleteMany({ changedBy: user._id }),
    ]);
    await user.deleteOne();
    response.json({ deleted: true, removedFromTeams: membershipTeams.length });
  } catch (error) {
    next(error);
  }
});

router.get('/departments', async (request, response, next) => {
  try {
    const departments = await Department.find()
      .populate('teamLeader', 'name username email')
      .sort({ name: 1 });
    const users = await User.find({ department: { $in: departments.map((item) => item._id) } }).select('department role');
    response.json({
      departments: departments.map((department) => ({
        id: department._id.toString(),
        name: department.name,
        description: department.description,
        isActive: department.isActive,
        teamLeader: {
          id: department.teamLeader._id.toString(),
          name: department.teamLeader.name,
          email: department.teamLeader.email,
        },
        userCount: users.filter((user) => user.department.equals(department._id)).length,
        teamLeaderCount: users.filter((user) => user.department.equals(department._id) && user.role === 'team_leader').length,
        teamMemberCount: users.filter((user) => user.department.equals(department._id) && user.role === 'team_member').length,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/departments', async (request, response, next) => {
  try {
    const { name, description = '', teamLeaderId } = request.body || {};
    if (Object.keys(request.body || {}).some((key) => !['name', 'description', 'teamLeaderId'].includes(key))
      || typeof name !== 'string' || !name.trim() || name.trim().length > 80
      || typeof description !== 'string' || description.trim().length > 500
      || !mongoose.isValidObjectId(teamLeaderId)) {
      response.status(400).json({ error: 'Enter a valid department name, description, and Team Leader.' });
      return;
    }
    const leader = await User.findOne({ _id: teamLeaderId, role: 'team_leader', isActive: true });
    if (!leader) {
      response.status(400).json({ error: 'Choose an active Team Leader account.' });
      return;
    }
    if (await Department.exists({ teamLeader: leader._id })) {
      response.status(409).json({ error: 'This Team Leader is already assigned to a department.' });
      return;
    }
    const department = await Department.create({
      name: name.trim(),
      description: description.trim(),
      teamLeader: leader._id,
    });
    leader.department = department._id;
    await leader.save();
    response.status(201).json({ department: { id: department._id.toString(), name: department.name } });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'A department with that name already exists.' });
      return;
    }
    next(error);
  }
});

router.patch('/departments/:departmentId', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.departmentId)) {
      response.status(404).json({ error: 'Department not found.' });
      return;
    }
    const department = await Department.findById(request.params.departmentId);
    if (!department) {
      response.status(404).json({ error: 'Department not found.' });
      return;
    }
    const body = request.body || {};
    if (!Object.keys(body).length || Object.keys(body).some((key) => !['name', 'description', 'teamLeaderId', 'isActive'].includes(key))) {
      response.status(400).json({ error: 'Provide valid department fields to update.' });
      return;
    }
    const name = Object.hasOwn(body, 'name') && typeof body.name === 'string' ? body.name.trim() : department.name;
    const description = Object.hasOwn(body, 'description') && typeof body.description === 'string'
      ? body.description.trim()
      : department.description;
    const isActive = Object.hasOwn(body, 'isActive') ? body.isActive : department.isActive;
    const leaderId = Object.hasOwn(body, 'teamLeaderId') ? body.teamLeaderId : department.teamLeader.toString();
    if (!name || name.length > 80 || description.length > 500 || typeof isActive !== 'boolean'
      || !mongoose.isValidObjectId(leaderId)) {
      response.status(400).json({ error: 'The department fields are invalid.' });
      return;
    }
    const leader = await User.findOne({ _id: leaderId, role: 'team_leader', isActive: true });
    if (!leader) {
      response.status(400).json({ error: 'Choose an active Team Leader account.' });
      return;
    }
    const otherDepartment = await Department.exists({
      _id: { $ne: department._id },
      teamLeader: leader._id,
    });
    if (otherDepartment) {
      response.status(409).json({ error: 'This Team Leader is already assigned to another department.' });
      return;
    }
    if (leader.department && !leader.department.equals(department._id)) {
      response.status(409).json({ error: 'This Team Leader is already assigned to another department.' });
      return;
    }
    const previousLeader = department.teamLeader;
    department.name = name;
    department.description = description;
    department.teamLeader = leader._id;
    department.isActive = isActive;
    await department.save();
    if (!previousLeader.equals(leader._id)) {
      await User.updateOne({ _id: previousLeader, department: department._id }, { $set: { department: null } });
    }
    leader.department = department._id;
    await leader.save();
    response.json({ department: { id: department._id.toString(), name: department.name, isActive } });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'A department with that name already exists.' });
      return;
    }
    next(error);
  }
});

router.delete('/departments/:departmentId', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.departmentId)) {
      response.status(404).json({ error: 'Department not found.' });
      return;
    }
    const department = await Department.findById(request.params.departmentId);
    if (!department) {
      response.status(404).json({ error: 'Department not found.' });
      return;
    }
    const teams = await Team.find({ department: department._id }).select('_id');
    const teamIds = teams.map((team) => team._id);
    if (await User.exists({ department: department._id, _id: { $ne: department.teamLeader } })
      || (teamIds.length && await TeamTask.exists({ team: { $in: teamIds } }))) {
      response.status(409).json({ error: 'Reassign or remove this department’s users and active team tasks before deleting it.' });
      return;
    }
    await Promise.all([
      User.updateOne({ _id: department.teamLeader, department: department._id }, { $set: { department: null } }),
      Team.deleteMany({ department: department._id }),
      department.deleteOne(),
    ]);
    response.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

router.get('/users/:userId', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.userId)) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }
    const user = await User.findById(request.params.userId)
      .select('-passwordHash')
      .populate('department', 'name');
    if (!user) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }
    const [personalTasks, teamTasks] = await Promise.all([
      Task.find({ user: user._id, deletedAt: null }).select('title completed dueDate createdAt'),
      TeamTask.find({ assignee: user._id }).select('title status dueDate createdAt'),
    ]);
    response.json({
      user: {
        ...serializeUser(user),
        role: user.role,
        isActive: user.isActive,
        department: user.department ? { id: user.department._id.toString(), name: user.department.name } : null,
      },
      personalTasks,
      teamTasks,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
