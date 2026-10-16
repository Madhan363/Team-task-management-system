import { Department, Task, Team, User } from '../models.js';

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export async function searchGlobal(request, response, next) {
  try {
    const rawQuery = typeof request.query.q === 'string' ? request.query.q.trim() : '';
    if (!rawQuery) {
      response.json({
        query: '',
        results: { tasks: [], users: [], departments: [], projects: [] },
        totalCount: 0,
      });
      return;
    }

    if (rawQuery.length > 100) {
      response.status(400).json({ error: 'Search query must be 100 characters or fewer.' });
      return;
    }

    const limit = Math.min(20, Math.max(1, parseInt(request.query.limit, 10) || 6));
    const typeFilter = typeof request.query.type === 'string' ? request.query.type.toLowerCase() : 'all';
    const regex = new RegExp(escapeRegex(rawQuery), 'i');

    const currentUser = request.user;
    const role = currentUser.role || 'team_member';

    // 1. Determine role-based scoping filters
    const textTaskFilter = {
      deletedAt: null,
      projectPublished: { $ne: false },
      $or: [{ title: regex }, { description: regex }, { category: regex }],
    };
    let taskFilter = textTaskFilter;
    let userFilter = { isActive: true, $or: [{ name: regex }, { username: regex }, { email: regex }] };
    let deptFilter = { isActive: true, $or: [{ name: regex }, { description: regex }] };
    let teamFilter = { $or: [{ name: regex }, { description: regex }] };
    const currentDepartmentId = currentUser.department?._id || currentUser.department || null;

    if (role === 'team_leader') {
      const leaderDept = currentDepartmentId
        ? null
        : await Department.findOne({ teamLeader: currentUser._id }).select('_id');
      const deptId = currentDepartmentId || leaderDept?._id;

      if (deptId) {
        taskFilter = {
          $and: [
            taskFilter,
            {
              $or: [
                { department: deptId },
                { assignedBy: currentUser._id },
                { assignee: currentUser._id },
                { user: currentUser._id },
              ],
            },
          ],
        };
        userFilter = { $and: [userFilter, { department: deptId }] };
        deptFilter = { $and: [deptFilter, { _id: deptId }] };
        teamFilter = {
          $and: [
            teamFilter,
            { $or: [{ owner: currentUser._id }, { department: deptId }] },
          ],
        };
      } else {
        taskFilter = {
          $and: [
            taskFilter,
            { $or: [{ assignedBy: currentUser._id }, { assignee: currentUser._id }, { user: currentUser._id }] },
          ],
        };
        userFilter = { $and: [userFilter, { _id: currentUser._id }] };
        deptFilter = {
          $and: [deptFilter, { teamLeader: currentUser._id }],
        };
        teamFilter = {
          $and: [
            teamFilter,
            { $or: [{ owner: currentUser._id }] },
          ],
        };
      }
    } else if (role === 'team_member') {
      taskFilter = {
        $and: [
          taskFilter,
          { $or: [{ assignee: currentUser._id }, { user: currentUser._id }] },
        ],
      };
      userFilter = {
        $and: [
          userFilter,
          currentDepartmentId ? { department: currentDepartmentId } : { _id: currentUser._id },
        ],
      };
      deptFilter = {
        $and: [
          deptFilter,
          currentDepartmentId ? { _id: currentDepartmentId } : { _id: null },
        ],
      };

      teamFilter = {
        $and: [
          teamFilter,
          { 'members.user': currentUser._id },
        ],
      };
    } else if (role === 'personal') {
      taskFilter = {
        $and: [
          textTaskFilter,
          { $or: [{ assignee: currentUser._id }, { user: currentUser._id }] },
        ],
      };
      userFilter = { $and: [userFilter, { _id: currentUser._id }] };
      deptFilter = { $and: [deptFilter, { _id: null }] };
      teamFilter = {
        $and: [
          teamFilter,
          { $or: [{ owner: currentUser._id }, { 'members.user': currentUser._id }] },
        ],
      };
    } else if (role !== 'admin') {
      taskFilter = {
        $and: [
          textTaskFilter,
          { $or: [{ assignee: currentUser._id }, { user: currentUser._id }] },
        ],
      };
      userFilter = { $and: [userFilter, { _id: currentUser._id }] };
      deptFilter = { $and: [deptFilter, { _id: null }] };
      teamFilter = {
        $and: [
          teamFilter,
          { $or: [{ owner: currentUser._id }, { 'members.user': currentUser._id }] },
        ],
      };
    }
    // Admin has access to all active tasks, users, depts, and projects

    // 2. Perform parallel searches according to requested type
    const tasksPromise = (typeFilter === 'all' || typeFilter === 'tasks')
      ? Task.find(taskFilter)
        .populate('assignee', 'name username email')
        .populate('assignedBy', 'name username email')
        .populate('department', 'name')
        .limit(limit)
        .sort({ updatedAt: -1 })
        .lean()
      : Promise.resolve([]);

    const usersPromise = (typeFilter === 'all' || typeFilter === 'users')
      ? User.find(userFilter)
        .populate('department', 'name')
        .limit(limit)
        .select('_id name username email role department isActive profileImage')
        .sort({ name: 1 })
        .lean()
      : Promise.resolve([]);

    const deptsPromise = (typeFilter === 'all' || typeFilter === 'departments')
      ? Department.find(deptFilter)
        .populate('teamLeader', 'name username')
        .limit(limit)
        .select('_id name description teamLeader isActive')
        .sort({ name: 1 })
        .lean()
      : Promise.resolve([]);

    const teamsPromise = (typeFilter === 'all' || typeFilter === 'projects')
      ? Team.find(teamFilter)
        .populate('owner', 'name username')
        .populate('department', 'name')
        .limit(limit)
        .select('_id name description owner department members')
        .sort({ updatedAt: -1 })
        .lean()
      : Promise.resolve([]);

    const [rawTasks, rawUsers, rawDepts, rawTeams] = await Promise.all([
      tasksPromise,
      usersPromise,
      deptsPromise,
      teamsPromise,
    ]);

    const tasks = rawTasks.map((t) => ({
      id: t._id.toString(),
      title: t.title,
      description: t.description || '',
      category: t.category || 'General',
      priority: t.priority || 'medium',
      status: t.status || (t.completed ? 'completed' : 'assigned'),
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
      assignee: t.assignee ? { id: t.assignee._id?.toString(), name: t.assignee.name } : null,
      department: t.department ? { id: t.department._id?.toString(), name: t.department.name } : null,
    }));

    const users = rawUsers.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      username: u.username,
      email: u.email || '',
      role: u.role || 'team_member',
      department: u.department ? { id: u.department._id?.toString(), name: u.department.name } : null,
    }));

    const departments = rawDepts.map((d) => ({
      id: d._id.toString(),
      name: d.name,
      description: d.description || '',
      teamLeader: d.teamLeader ? { id: d.teamLeader._id?.toString(), name: d.teamLeader.name } : null,
    }));

    const projects = rawTeams.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      description: p.description || '',
      owner: p.owner ? { id: p.owner._id?.toString(), name: p.owner.name } : null,
      department: p.department ? { id: p.department._id?.toString(), name: p.department.name } : null,
      memberCount: (p.members || []).length,
    }));

    const totalCount = tasks.length + users.length + departments.length + projects.length;

    response.json({
      query: rawQuery,
      results: {
        tasks,
        users,
        departments,
        projects,
      },
      totalCount,
    });
  } catch (error) {
    next(error);
  }
}
