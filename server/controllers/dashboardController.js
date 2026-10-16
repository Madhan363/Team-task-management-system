import mongoose from 'mongoose';
import { Department, Task, User, serializeTask } from '../models.js';

export async function getAdminDashboard(_request, response, next) {
  try {
    const [users, departments, tasks] = await Promise.all([
      User.find().select('name username email role department isActive createdAt'),
      Department.find().select('name description teamLeader isActive'),
      Task.find({ deletedAt: null })
        .populate('assignee', 'name username')
        .populate('department', 'name')
        .select('title status priority dueDate completed completedAt department createdAt'),
    ]);

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.isActive !== false).length;
    const inactiveUsers = totalUsers - activeUsers;
    const totalDepartments = departments.length;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed' || t.completed).length;
    const incompleteTasks = totalTasks - completedTasks;

    // Chart 1: Active vs Inactive Users
    const userStatusChart = [
      { name: 'Active Users', value: activeUsers, color: '#10b981' },
      { name: 'Inactive Users', value: inactiveUsers, color: '#ef4444' },
    ];

    // Chart 2: Completed vs Incomplete Tasks
    const taskStatusChart = [
      { name: 'Completed', value: completedTasks, color: '#10b981' },
      { name: 'In Progress', value: tasks.filter((t) => t.status === 'in_progress').length, color: '#3b82f6' },
      { name: 'In Review', value: tasks.filter((t) => t.status === 'submitted_review').length, color: '#8b5cf6' },
      { name: 'Assigned', value: tasks.filter((t) => t.status === 'assigned').length, color: '#f59e0b' },
    ];

    // Chart 3: Task distribution by department
    const deptMap = new Map();
    for (const d of departments) {
      deptMap.set(d._id.toString(), { name: d.name, count: 0, completed: 0 });
    }
    deptMap.set('Unassigned', { name: 'General / No Dept', count: 0, completed: 0 });

    for (const t of tasks) {
      const deptId = t.department?._id?.toString() || t.department?.toString();
      if (deptId && deptMap.has(deptId)) {
        const item = deptMap.get(deptId);
        item.count += 1;
        if (t.status === 'completed' || t.completed) item.completed += 1;
      } else {
        const general = deptMap.get('Unassigned');
        general.count += 1;
        if (t.status === 'completed' || t.completed) general.completed += 1;
      }
    }

    const departmentDistributionChart = Array.from(deptMap.values())
      .filter((d) => d.count > 0 || d.name !== 'General / No Dept')
      .map((d) => ({
        department: d.name,
        totalTasks: d.count,
        completedTasks: d.completed,
      }));

    // Chart 4: Task completion trends for last 7 days
    const now = new Date();
    const completionTrends = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);

      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const count = tasks.filter((t) => {
        if (!t.completedAt) return false;
        const compDate = new Date(t.completedAt);
        return compDate >= d && compDate < nextD;
      }).length;

      const created = tasks.filter((t) => {
        const createDate = new Date(t.createdAt);
        return createDate >= d && createDate < nextD;
      }).length;

      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completed: count,
        created,
      };
    });

    response.json({
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalDepartments,
        totalTasks,
        completedTasks,
        incompleteTasks,
      },
      charts: {
        userStatusChart,
        taskStatusChart,
        departmentDistributionChart,
        completionTrends,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTeamLeaderDashboard(request, response, next) {
  try {
    let department = null;
    if (request.user.role === 'team_leader') {
      department = await Department.findOne({ teamLeader: request.user._id });
    } else if (request.user.role === 'admin' && request.query.departmentId) {
      department = await Department.findById(request.query.departmentId);
    }

    const deptFilter = department ? { department: department._id } : {};

    const [members, tasks] = await Promise.all([
      department
        ? User.find({ department: department._id, role: 'team_member' }).select('name username email role isActive')
        : User.find({ role: 'team_member' }).select('name username email role isActive'),
      Task.find({ ...deptFilter, deletedAt: null })
        .populate('assignee', 'name username email')
        .populate('assignedBy', 'name username email')
        .sort({ createdAt: -1 }),
    ]);

    const now = new Date();
    const totalTeamMembers = members.length;
    const activeTeamMembers = members.filter((m) => m.isActive !== false).length;
    const tasksAssigned = tasks.length;
    const awaitingAcknowledgment = tasks.filter((t) => t.acknowledgmentStatus === 'pending' && t.status !== 'completed').length;
    const tasksInProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const completedTasks = tasks.filter((t) => t.status === 'completed' || t.completed).length;
    const overdueTasks = tasks.filter((t) => (
      t.status !== 'completed' && !t.completed && t.dueDate && new Date(t.dueDate) < now
    )).length;

    // Team workload chart
    const memberWorkload = members.map((member) => {
      const memberTasks = tasks.filter((t) => t.assignee?._id?.equals(member._id));
      const completed = memberTasks.filter((t) => t.status === 'completed' || t.completed).length;
      return {
        id: member._id.toString(),
        name: member.name,
        email: member.email,
        username: member.username,
        isActive: member.isActive !== false,
        assignedTasks: memberTasks.length,
        completedTasks: completed,
        inProgressTasks: memberTasks.filter((t) => t.status === 'in_progress').length,
        pendingAck: memberTasks.filter((t) => t.acknowledgmentStatus === 'pending').length,
      };
    });

    const completionBreakdown = [
      { name: 'Completed', value: completedTasks, color: '#10b981' },
      { name: 'In Progress', value: tasksInProgress, color: '#3b82f6' },
      { name: 'Awaiting Ack', value: awaitingAcknowledgment, color: '#f59e0b' },
      { name: 'Review Pending', value: tasks.filter((t) => t.status === 'submitted_review').length, color: '#8b5cf6' },
    ];

    response.json({
      department: department ? { id: department._id.toString(), name: department.name } : null,
      stats: {
        totalTeamMembers,
        activeTeamMembers,
        tasksAssigned,
        awaitingAcknowledgment,
        tasksInProgress,
        completedTasks,
        overdueTasks,
      },
      charts: {
        completionBreakdown,
        memberWorkload,
      },
      members: memberWorkload,
      recentTasks: tasks.slice(0, 8).map(serializeTask),
    });
  } catch (error) {
    next(error);
  }
}

export async function getAvailableTeamMembers(request, response, next) {
  try {
    const department = await Department.findOne({
      _id: request.user.department,
      teamLeader: request.user._id,
      isActive: true,
    });
    if (!department) {
      response.status(403).json({ error: 'You are not assigned as the Team Leader of an active department.' });
      return;
    }

    const members = await User.find({
      role: 'team_member',
      isActive: true,
      $or: [{ department: null }, { department: { $exists: false } }],
    })
      .select('name username email')
      .sort({ name: 1 });

    response.json({
      members: members.map((member) => ({
        id: member._id.toString(),
        name: member.name,
        username: member.username,
        email: member.email || '',
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function addExistingTeamMember(request, response, next) {
  try {
    const { memberId } = request.params;
    if (!mongoose.isValidObjectId(memberId)) {
      response.status(400).json({ error: 'Select a valid team member account.' });
      return;
    }

    const department = await Department.findOne({
      _id: request.user.department,
      teamLeader: request.user._id,
      isActive: true,
    });
    if (!department) {
      response.status(403).json({ error: 'You are not assigned as the Team Leader of an active department.' });
      return;
    }

    const member = await User.findOneAndUpdate(
      {
        _id: memberId,
        role: 'team_member',
        isActive: true,
        $or: [{ department: null }, { department: { $exists: false } }],
      },
      { $set: { department: department._id } },
      { new: true, runValidators: true },
    ).select('name username email');

    if (!member) {
      response.status(409).json({
        error: 'That account is unavailable or already assigned to a department. Refresh the member list and try again.',
      });
      return;
    }

    response.status(201).json({
      member: {
        id: member._id.toString(),
        name: member.name,
        username: member.username,
        email: member.email || '',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTeamMemberDashboard(request, response, next) {
  try {
    const tasks = await Task.find({
      $or: [{ assignee: request.user._id }, { user: request.user._id }],
      deletedAt: null,
    })
      .populate('assignedBy', 'name username email')
      .populate('department', 'name')
      .sort({ createdAt: -1 });

    const now = new Date();
    const myTotalTasks = tasks.length;
    const tasksAwaitingMyAcknowledgment = tasks.filter((t) => (
      t.acknowledgmentStatus === 'pending' && t.status !== 'completed' && !t.completed
    )).length;
    const tasksInProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const tasksSubmittedForReview = tasks.filter((t) => t.status === 'submitted_review').length;
    const completedTasks = tasks.filter((t) => t.status === 'completed' || t.completed).length;
    const overdueTasks = tasks.filter((t) => (
      t.status !== 'completed' && !t.completed && t.dueDate && new Date(t.dueDate) < now
    )).length;

    const urgentTasks = tasks
      .filter((t) => t.status !== 'completed' && !t.completed)
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      })
      .slice(0, 5)
      .map(serializeTask);

    response.json({
      stats: {
        myTotalTasks,
        tasksAwaitingMyAcknowledgment,
        tasksInProgress,
        tasksSubmittedForReview,
        completedTasks,
        overdueTasks,
      },
      urgentTasks,
      recentTasks: tasks.slice(0, 8).map(serializeTask),
    });
  } catch (error) {
    next(error);
  }
}
