import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Department, Task, User, serializeUser } from '../models.js';
import { recordAuditEvent } from '../utils/audit.js';

export async function listUsers(request, response, next) {
  try {
    const { search = '', department = '', role = '', status = '', page = 1, limit = 10 } = request.query;

    const filter = {};

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { username: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
      ];
    }

    if (department && department !== 'all') {
      if (mongoose.isValidObjectId(department)) {
        filter.department = department;
      }
    }

    if (role && role !== 'all') {
      filter.role = role;
    }

    if (status && status !== 'all') {
      filter.isActive = status === 'active';
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .populate('department', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    response.json({
      users: users.map(serializeUser),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      limit: limitNum,
    });
  } catch (error) {
    next(error);
  }
}

export async function createUser(request, response, next) {
  try {
    const {
      name,
      username,
      email,
      password,
      role = 'team_member',
      departmentId,
      department,
      isActive = true,
    } = request.body || {};

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';
    const deptId = departmentId || department || null;

    if (!cleanName || cleanName.length > 80) {
      response.status(400).json({ error: 'Enter a name between 1 and 80 characters.' });
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      response.status(400).json({ error: 'Username must be 3–30 characters using letters, numbers, or underscores.' });
      return;
    }
    if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      response.status(400).json({ error: 'Enter a valid email address.' });
      return;
    }
    if (cleanPassword.length < 8 || cleanPassword.length > 100) {
      response.status(400).json({ error: 'Password must be 8–100 characters long.' });
      return;
    }

    // Role options: Team Leader, Team Member (or Admin for internal management)
    if (!['team_leader', 'team_member', 'admin'].includes(role)) {
      response.status(400).json({ error: 'Role must be Team Leader or Team Member.' });
      return;
    }

    if (deptId) {
      if (!mongoose.isValidObjectId(deptId) || !(await Department.exists({ _id: deptId }))) {
        response.status(400).json({ error: 'The specified department does not exist.' });
        return;
      }
    }

    const existing = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }],
    });
    if (existing) {
      response.status(409).json({ error: 'That username or email is already registered.' });
      return;
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 12);
    const user = await User.create({
      name: cleanName,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      role,
      department: deptId || null,
      isActive: Boolean(isActive),
    });

    await user.populate('department', 'name');
    await recordAuditEvent({
      actor: request.user,
      action: 'user.created',
      resourceType: 'user',
      resourceId: user._id,
      summary: `Created ${role.replace('_', ' ')} account "${user.username}".`,
    });
    response.status(201).json({ user: serializeUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'That username or email is already registered.' });
      return;
    }
    next(error);
  }
}

export async function getUser(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = await User.findById(id).populate('department', 'name');
    if (!user) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }

    response.json({ user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }

    const {
      name,
      username,
      email,
      role,
      departmentId,
      department,
      isActive,
      password,
    } = request.body || {};

    if (name !== undefined) {
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName || cleanName.length > 80) {
        response.status(400).json({ error: 'Enter a name between 1 and 80 characters.' });
        return;
      }
      user.name = cleanName;
    }

    if (username !== undefined) {
      const cleanUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
      if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
        response.status(400).json({ error: 'Username must be 3–30 characters using letters, numbers, or underscores.' });
        return;
      }
      user.username = cleanUsername;
    }

    if (email !== undefined) {
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        response.status(400).json({ error: 'Enter a valid email address.' });
        return;
      }
      user.email = cleanEmail;
    }

    if (role !== undefined) {
      if (!['admin', 'team_leader', 'team_member'].includes(role)) {
        response.status(400).json({ error: 'Invalid role.' });
        return;
      }
      // Safety check: prevent demoting last active admin
      if (user.role === 'admin' && role !== 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
        if (adminCount <= 1) {
          response.status(400).json({ error: 'Cannot demote the only active Administrator.' });
          return;
        }
      }
      user.role = role;
    }

    if (departmentId !== undefined || department !== undefined) {
      const targetDeptId = departmentId !== undefined ? departmentId : department;
      if (targetDeptId === null || targetDeptId === '') {
        user.department = null;
      } else {
        if (!mongoose.isValidObjectId(targetDeptId) || !(await Department.exists({ _id: targetDeptId }))) {
          response.status(400).json({ error: 'The specified department does not exist.' });
          return;
        }
        user.department = targetDeptId;
      }
    }

    if (isActive !== undefined) {
      const activeState = Boolean(isActive);
      if (!activeState && user.role === 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
        if (adminCount <= 1) {
          response.status(400).json({ error: 'Cannot deactivate the only active Administrator.' });
          return;
        }
      }
      user.isActive = activeState;
    }

    if (password) {
      if (typeof password !== 'string' || password.length < 8 || password.length > 100) {
        response.status(400).json({ error: 'Password must be 8–100 characters long.' });
        return;
      }
      user.passwordHash = await bcrypt.hash(password, 12);
    }

    await user.save();
    await user.populate('department', 'name');
    await recordAuditEvent({
      actor: request.user,
      action: 'user.updated',
      resourceType: 'user',
      resourceId: user._id,
      summary: `Updated account "${user.username}".`,
    });
    response.json({ user: serializeUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'That username or email is already registered.' });
      return;
    }
    next(error);
  }
}

export async function toggleUserStatus(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }

    const newStatus = Object.hasOwn(request.body, 'isActive')
      ? Boolean(request.body.isActive)
      : !user.isActive;

    if (!newStatus && user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        response.status(400).json({ error: 'Cannot deactivate the only active Administrator.' });
        return;
      }
    }

    user.isActive = newStatus;
    await user.save();
    await user.populate('department', 'name');
    await recordAuditEvent({
      actor: request.user,
      action: newStatus ? 'user.activated' : 'user.deactivated',
      resourceType: 'user',
      resourceId: user._id,
      summary: `${newStatus ? 'Activated' : 'Deactivated'} account "${user.username}".`,
    });
    response.json({ user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }

    if (request.user._id.toString() === id) {
      response.status(400).json({ error: 'You cannot delete your own account.' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      response.status(404).json({ error: 'User not found.' });
      return;
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        response.status(400).json({ error: 'Cannot delete the only Administrator.' });
        return;
      }
    }

    // Check if user is assigned as Team Leader to any department
    const leadingDept = await Department.findOne({ teamLeader: id });
    if (leadingDept) {
      response.status(400).json({
        error: `Cannot delete user because they are the Team Leader of "${leadingDept.name}". Please reassign the department leader first.`,
      });
      return;
    }

    // Check if user has active tasks assigned
    const activeTasksCount = await Task.countDocuments({
      assignee: id,
      status: { $in: ['assigned', 'in_progress', 'submitted_review'] },
      deletedAt: null,
    });
    if (activeTasksCount > 0) {
      response.status(400).json({
        error: `Cannot delete user because they have ${activeTasksCount} active task(s). Please reassign or complete them first.`,
      });
      return;
    }

    await User.findByIdAndDelete(id);
    await recordAuditEvent({
      actor: request.user,
      action: 'user.deleted',
      resourceType: 'user',
      resourceId: user._id,
      summary: `Deleted account "${user.username}".`,
    });
    response.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    next(error);
  }
}
