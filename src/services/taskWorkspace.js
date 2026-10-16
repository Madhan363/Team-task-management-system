import { api } from '../api';

export async function loadTaskWorkspace(role) {
  if (role === 'admin') {
    const [taskResult, userResult, departmentResult] = await Promise.all([
      api.getTeamTasks(),
      api.getUsers({ limit: 100 }),
      api.getDepartments(),
    ]);
    return {
      tasks: taskResult.tasks || [],
      users: userResult.users || [],
      departments: departmentResult.departments || [],
      departmentName: '',
    };
  }

  if (role === 'team_leader') {
    const [taskResult, dashboard] = await Promise.all([
      api.getTeamTasks(),
      api.getTeamLeaderDashboard(),
    ]);
    return {
      tasks: taskResult.tasks || [],
      users: dashboard.members || [],
      departments: dashboard.department ? [dashboard.department] : [],
      departmentName: dashboard.department?.name || '',
    };
  }

  const [taskResult, dashboard] = await Promise.all([
    api.getMyTasks(),
    api.getTeamMemberDashboard(),
  ]);
  const tasks = taskResult.tasks || [];
  const peopleById = new Map();
  tasks.forEach((task) => {
    [task.assignee, task.assignedBy].forEach((person) => {
      if (person?.id) peopleById.set(person.id, person);
    });
  });
  const departmentsById = new Map();
  tasks.forEach((task) => {
    if (task.department?.id) departmentsById.set(task.department.id, task.department);
  });
  return {
    tasks,
    users: [...peopleById.values()],
    departments: [...departmentsById.values()],
    departmentName: '',
    memberStats: dashboard.stats,
  };
}

export function getTaskAssignee(task) {
  return task.assignee || task.assignedTo || null;
}

export function getTaskDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
