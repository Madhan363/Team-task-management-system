import mongoose from 'mongoose';
import { Department, Task, User } from '../models.js';
import { recordAuditEvent } from '../utils/audit.js';

export async function listDepartments(_request, response, next) {
  try {
    const [departments, users, allTasks] = await Promise.all([
      Department.find()
        .populate('teamLeader', 'name username email')
        .sort({ name: 1 }),
      User.find().select('department role isActive'),
      Task.find({ deletedAt: null }).select('department status'),
    ]);

    const userCountByDept = new Map();
    for (const user of users) {
      if (user.department) {
        const id = user.department.toString();
        userCountByDept.set(id, (userCountByDept.get(id) || 0) + 1);
      }
    }

    const taskCountByDept = new Map();
    for (const task of allTasks) {
      if (task.department) {
        const id = task.department.toString();
        taskCountByDept.set(id, (taskCountByDept.get(id) || 0) + 1);
      }
    }

    const departmentList = departments.map((dept) => {
      const id = dept._id.toString();
      return {
        id,
        _id: id,
        name: dept.name,
        description: dept.description || '',
        isActive: dept.isActive !== false,
        teamLeader: dept.teamLeader ? {
          id: dept.teamLeader._id.toString(),
          _id: dept.teamLeader._id.toString(),
          name: dept.teamLeader.name,
          username: dept.teamLeader.username,
          email: dept.teamLeader.email || '',
        } : null,
        teamLeaderId: dept.teamLeader ? dept.teamLeader._id.toString() : null,
        userCount: userCountByDept.get(id) || 0,
        taskCount: taskCountByDept.get(id) || 0,
        createdAt: dept.createdAt?.toISOString(),
        updatedAt: dept.updatedAt?.toISOString(),
      };
    });

    const totalUsers = users.length;
    const totalTeamLeaders = users.filter((u) => u.role === 'team_leader').length;
    const totalTeamMembers = users.filter((u) => u.role === 'team_member').length;

    response.json({
      departments: departmentList,
      stats: {
        totalDepartments: departments.length,
        totalUsers,
        totalTeamLeaders,
        totalTeamMembers,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createDepartment(request, response, next) {
  try {
    const { name, description = '', teamLeaderId, teamLeader } = request.body || {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanDesc = typeof description === 'string' ? description.trim() : '';
    const leaderId = teamLeaderId || teamLeader;

    if (!cleanName || cleanName.length > 80) {
      response.status(400).json({ error: 'Enter a department name between 1 and 80 characters.' });
      return;
    }

    if (!leaderId || !mongoose.isValidObjectId(leaderId)) {
      response.status(400).json({ error: 'Select a valid Team Leader for this department.' });
      return;
    }

    const leader = await User.findById(leaderId);
    if (!leader || leader.isActive === false) {
      response.status(400).json({ error: 'The selected Team Leader was not found or is inactive.' });
      return;
    }

    // Ensure leader has team_leader role (promote if needed)
    if (leader.role !== 'team_leader' && leader.role !== 'admin') {
      leader.role = 'team_leader';
      await leader.save();
    }

    const existing = await Department.findOne({
      name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (existing) {
      response.status(409).json({ error: 'A department with that name already exists.' });
      return;
    }

    const department = await Department.create({
      name: cleanName,
      description: cleanDesc,
      teamLeader: leader._id,
      isActive: true,
    });

    // Assign the department to the leader as well
    leader.department = department._id;
    await leader.save();

    await department.populate('teamLeader', 'name username email');

    await recordAuditEvent({
      actor: request.user,
      action: 'department.created',
      resourceType: 'department',
      resourceId: department._id,
      summary: `Created department "${department.name}".`,
    });
    response.status(201).json({
      department: {
        id: department._id.toString(),
        name: department.name,
        description: department.description,
        isActive: department.isActive,
        teamLeader: {
          id: department.teamLeader._id.toString(),
          name: department.teamLeader.name,
          username: department.teamLeader.username,
          email: department.teamLeader.email || '',
        },
        teamLeaderId: department.teamLeader._id.toString(),
        userCount: 1,
        taskCount: 0,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'A department with that name already exists.' });
      return;
    }
    next(error);
  }
}

export async function getDepartment(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'Department not found.' });
      return;
    }

    const dept = await Department.findById(id).populate('teamLeader', 'name username email');
    if (!dept) {
      response.status(404).json({ error: 'Department not found.' });
      return;
    }

    const [userCount, taskCount] = await Promise.all([
      User.countDocuments({ department: id }),
      Task.countDocuments({ department: id, deletedAt: null }),
    ]);

    response.json({
      department: {
        id: dept._id.toString(),
        name: dept.name,
        description: dept.description,
        isActive: dept.isActive,
        teamLeader: dept.teamLeader ? {
          id: dept.teamLeader._id.toString(),
          name: dept.teamLeader.name,
          username: dept.teamLeader.username,
          email: dept.teamLeader.email || '',
        } : null,
        userCount,
        taskCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDepartment(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'Department not found.' });
      return;
    }

    const dept = await Department.findById(id);
    if (!dept) {
      response.status(404).json({ error: 'Department not found.' });
      return;
    }

    const { name, description, teamLeaderId, teamLeader, isActive } = request.body || {};

    if (name !== undefined) {
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName || cleanName.length > 80) {
        response.status(400).json({ error: 'Enter a department name between 1 and 80 characters.' });
        return;
      }
      const existing = await Department.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
      if (existing) {
        response.status(409).json({ error: 'A department with that name already exists.' });
        return;
      }
      dept.name = cleanName;
    }

    if (description !== undefined) {
      dept.description = typeof description === 'string' ? description.trim() : '';
    }

    const targetLeader = teamLeaderId !== undefined ? teamLeaderId : teamLeader;
    if (targetLeader !== undefined) {
      if (!mongoose.isValidObjectId(targetLeader)) {
        response.status(400).json({ error: 'Choose a valid Team Leader.' });
        return;
      }
      const leader = await User.findById(targetLeader);
      if (!leader || leader.isActive === false) {
        response.status(400).json({ error: 'The selected Team Leader was not found or is inactive.' });
        return;
      }
      if (leader.role !== 'team_leader' && leader.role !== 'admin') {
        leader.role = 'team_leader';
      }
      leader.department = dept._id;
      await leader.save();
      dept.teamLeader = leader._id;
    }

    if (isActive !== undefined) {
      dept.isActive = Boolean(isActive);
    }

    await dept.save();
    await dept.populate('teamLeader', 'name username email');

    await recordAuditEvent({
      actor: request.user,
      action: 'department.updated',
      resourceType: 'department',
      resourceId: dept._id,
      summary: `Updated department "${dept.name}".`,
    });
    const [userCount, taskCount] = await Promise.all([
      User.countDocuments({ department: id }),
      Task.countDocuments({ department: id, deletedAt: null }),
    ]);

    response.json({
      department: {
        id: dept._id.toString(),
        name: dept.name,
        description: dept.description,
        isActive: dept.isActive,
        teamLeader: dept.teamLeader ? {
          id: dept.teamLeader._id.toString(),
          name: dept.teamLeader.name,
          username: dept.teamLeader.username,
          email: dept.teamLeader.email || '',
        } : null,
        userCount,
        taskCount,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'A department with that name already exists.' });
      return;
    }
    next(error);
  }
}

export async function deleteDepartment(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'Department not found.' });
      return;
    }

    const dept = await Department.findById(id);
    if (!dept) {
      response.status(404).json({ error: 'Department not found.' });
      return;
    }

    // Safety check: Cannot delete department while users remain assigned
    const assignedUsersCount = await User.countDocuments({ department: id });
    if (assignedUsersCount > 0) {
      response.status(400).json({
        error: `Cannot delete department "${dept.name}" because ${assignedUsersCount} user(s) are assigned to it. Please reassign the users first.`,
      });
      return;
    }

    // Safety check: Cannot delete department while active tasks remain assigned
    const activeTasksCount = await Task.countDocuments({
      department: id,
      status: { $in: ['assigned', 'in_progress', 'submitted_review'] },
      deletedAt: null,
    });
    if (activeTasksCount > 0) {
      response.status(400).json({
        error: `Cannot delete department "${dept.name}" because ${activeTasksCount} active task(s) are assigned to it. Please reassign or complete them first.`,
      });
      return;
    }

    await Department.findByIdAndDelete(id);
    await recordAuditEvent({
      actor: request.user,
      action: 'department.deleted',
      resourceType: 'department',
      resourceId: dept._id,
      summary: `Deleted department "${dept.name}".`,
    });
    response.status(200).json({ message: 'Department deleted successfully.' });
  } catch (error) {
    next(error);
  }
}
