const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const responseText = response.status === 204 ? '' : await response.text();
  let result = null;
  if (responseText.trim()) {
    try {
      result = JSON.parse(responseText);
    } catch {
      if (response.ok) throw new Error('The server returned an invalid response.');
    }
  }
  if (!response.ok) {
    const error = new Error(result?.error || `The server could not complete the request (HTTP ${response.status}).`);
    error.status = response.status;
    error.validationErrors = result?.validationErrors || [];
    throw error;
  }
  return result;
}

export const api = {
  // Auth
  session: () => request('/auth/session'),
  me: () => request('/auth/me'),
  register: (account) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(account),
  }),
  signup: (account) => request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(account),
  }),
  login: (identifier, password, requireAdminRole = false) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, requireAdminRole }),
  }),
  updateProfile: (profile) => request('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(profile),
  }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  startActivitySession: () => request('/activity/session', { method: 'POST', body: JSON.stringify({}) }),
  recordActivity: () => request('/activity/activity', { method: 'POST', body: JSON.stringify({}) }),
  recordPresence: () => request('/activity/presence', { method: 'POST', body: JSON.stringify({}) }),
  getActivityReport: (period = 'month') => request(`/activity/report?period=${encodeURIComponent(period)}`),

  // Dashboards
  getAdminDashboard: () => request('/dashboard/admin'),
  getAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/audit-logs${qs ? `?${qs}` : ''}`);
  },
  getTeamLeaderDashboard: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/dashboard/team-leader${qs ? `?${qs}` : ''}`);
  },
  getAvailableTeamMembers: () => request('/dashboard/team-leader/available-members'),
  getProjects: () => request('/projects'),
  getProjectImportMembers: () => request('/projects/import/members'),
  previewProjectImport: (fileName, fileData) => request('/projects/import/preview', {
    method: 'POST',
    body: JSON.stringify({ fileName, fileData }),
  }),
  getProjectImportDraft: (draftId) => request(`/projects/import/${encodeURIComponent(draftId)}`),
  saveProjectImportRows: (draftId, rows) => request(
    `/projects/import/${encodeURIComponent(draftId)}/rows`,
    { method: 'PUT', body: JSON.stringify({ rows }) },
  ),
  saveProjectImportAssignments: (draftId, assignments) => request(
    `/projects/import/${encodeURIComponent(draftId)}/assignments`,
    { method: 'PUT', body: JSON.stringify({ assignments }) },
  ),
  publishProjectImport: (draftId) => request(`/projects/import/${encodeURIComponent(draftId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  cancelProjectImportDraft: (draftId) => request(`/projects/import/${encodeURIComponent(draftId)}`, {
    method: 'DELETE',
  }),
  deleteProject: (projectId) => request(`/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  }),
  addExistingTeamMember: (memberId) => request(
    `/dashboard/team-leader/members/${encodeURIComponent(memberId)}`,
    { method: 'POST', body: JSON.stringify({}) },
  ),
  getTeamMemberDashboard: () => request('/dashboard/team-member'),
  askTeamMemberAssistant: (message, conversation = []) => request('/assistant/team-member', {
    method: 'POST',
    body: JSON.stringify({ message, conversation }),
  }),
  getAssistantConversations: () => request('/assistant/conversations'),
  createAssistantConversation: () => request('/assistant/conversations', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  getAssistantConversation: (id) => request(`/assistant/conversations/${encodeURIComponent(id)}`),
  deleteAssistantConversation: (id) => request(`/assistant/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),
  clearAssistantConversation: (id) => request(`/assistant/conversations/${encodeURIComponent(id)}/messages`, {
    method: 'DELETE',
  }),
  chatWithAssistant: (conversationId, message) => request('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ conversationId, message }),
  }),

  // Users Manager
  getUsers: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== '' && v !== null && v !== undefined),
    );
    const qs = new URLSearchParams(cleanParams).toString();
    return request(`/users${qs ? `?${qs}` : ''}`);
  },
  createUser: (user) => request('/users', {
    method: 'POST',
    body: JSON.stringify(user),
  }),
  getUser: (id) => request(`/users/${encodeURIComponent(id)}`),
  updateUser: (id, changes) => request(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  }),
  toggleUserStatus: (id, isActive) => request(`/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  }),
  deleteUser: (id) => request(`/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),

  // Departments Manager
  getDepartments: () => request('/departments'),
  createDepartment: (department) => request('/departments', {
    method: 'POST',
    body: JSON.stringify(department),
  }),
  getDepartment: (id) => request(`/departments/${encodeURIComponent(id)}`),
  updateDepartment: (id, changes) => request(`/departments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  }),
  deleteDepartment: (id) => request(`/departments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),

  // Tasks
  getPersonalTasks: () => request('/tasks/personal'),
  getMyTasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tasks/my-tasks${qs ? `?${qs}` : ''}`);
  },
  getTeamTasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tasks/team${qs ? `?${qs}` : ''}`);
  },
  getTask: (id) => request(`/tasks/${encodeURIComponent(id)}`),
  createTask: (task) => request('/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  }),
  updateTask: (id, changes) => request(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  }),
  deleteTask: (id) => request(`/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),
  acknowledgeTask: (id) => request(`/tasks/${encodeURIComponent(id)}/acknowledge`, {
    method: 'PATCH',
  }),
  updateTaskStatus: (id, status, comment = '', attachment = null) => request(`/tasks/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, comment, ...(attachment ? { attachment } : {}) }),
  }),
  reviewTask: (id, decision, comment = '') => request(`/tasks/${encodeURIComponent(id)}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, comment }),
  }),
  addTaskResponse: (id, message, responseType = 'comment') => request(`/tasks/${encodeURIComponent(id)}/responses`, {
    method: 'POST',
    body: JSON.stringify({ message, responseType }),
  }),
  getTaskHistory: (id) => request(`/tasks/${encodeURIComponent(id)}/history`),
  getTaskChat: (id) => request(`/tasks/${encodeURIComponent(id)}/chat`),
  sendTaskChat: (id, message) => request(`/tasks/${encodeURIComponent(id)}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  }),
  updateTaskContribution: (id, contribution) => request(`/tasks/${encodeURIComponent(id)}/contribution`, {
    method: 'PATCH',
    body: JSON.stringify(contribution),
  }),
  updateTaskContributionAssignment: (id, memberId, assignment) => request(
    `/tasks/${encodeURIComponent(id)}/contributions/${encodeURIComponent(memberId)}`,
    { method: 'PATCH', body: JSON.stringify(assignment) },
  ),
  submitSharedTask: (id, submission) => request(`/tasks/${encodeURIComponent(id)}/team-submissions`, {
    method: 'POST',
    body: JSON.stringify(submission),
  }),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  }),
  markAllNotificationsRead: () => request('/notifications/read-all', {
    method: 'PATCH',
  }),
  clearNotifications: () => request('/notifications', {
    method: 'DELETE',
  }),

  // Meetings
  getMeetingOptions: () => request('/meetings/options'),
  getMeetings: () => request('/meetings'),
  getMeetingRooms: () => request('/meetings/rooms'),
  createMeetingRoom: (room) => request('/meetings/rooms', {
    method: 'POST',
    body: JSON.stringify(room),
  }),
  updateMeetingRoom: (id, changes) => request(`/meetings/rooms/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  }),
  addRoomAnnouncement: (id, text) => request(`/meetings/rooms/${encodeURIComponent(id)}/announcements`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),
  createMeeting: (meeting) => request('/meetings', {
    method: 'POST',
    body: JSON.stringify(meeting),
  }),
  updateMeeting: (id, changes) => request(`/meetings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  }),
  cancelMeeting: (id) => request(`/meetings/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
  }),
  deleteMeeting: (id) => request(`/meetings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),
  addMeetingNote: (id, type, text) => request(`/meetings/${encodeURIComponent(id)}/notes`, {
    method: 'POST',
    body: JSON.stringify({ type, text }),
  }),
  addMeetingFollowUp: (id, followUp) => request(`/meetings/${encodeURIComponent(id)}/follow-ups`, {
    method: 'POST',
    body: JSON.stringify(followUp),
  }),
  updateMeetingFollowUp: (meetingId, followUpId, status) => request(
    `/meetings/${encodeURIComponent(meetingId)}/follow-ups/${encodeURIComponent(followUpId)}`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  ),

  // Legacy / personal tasks compatibility
  listTasks: () => request('/tasks'),
  suggestTasks: (goal) => request('/assistant/suggestions', {
    method: 'POST',
    body: JSON.stringify({ goal }),
  }),
  importLocalTasks: (tasks) => request('/tasks/import-local', {
    method: 'POST',
    body: JSON.stringify({ tasks }),
  }),
  clearCompletedTasks: () => request('/tasks/completed', { method: 'DELETE' }),
  teamContext: () => request('/team/context'),
  leaderTeamDashboard: () => request('/team/leader/dashboard'),
  memberTeamDashboard: () => request('/team/member/dashboard'),
  createTeam: (team) => request('/team/teams', {
    method: 'POST',
    body: JSON.stringify(team),
  }),
  createTeamMember: (account) => request('/team/members', {
    method: 'POST',
    body: JSON.stringify(account),
  }),
  addTeamMember: (teamId, email) => request(`/team/teams/${encodeURIComponent(teamId)}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  createTeamTask: (teamId, task) => request(`/team/teams/${encodeURIComponent(teamId)}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task),
  }),
  acknowledgeTeamTask: (taskId) => request(`/team/tasks/${encodeURIComponent(taskId)}/acknowledge`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  }),
  updateTeamTaskStatus: (taskId, status) => request(`/team/tasks/${encodeURIComponent(taskId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  submitTeamTask: (taskId) => request(`/team/tasks/${encodeURIComponent(taskId)}/submit`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  }),
  reviewTeamTask: (taskId, decision, comment = '') => request(`/team/tasks/${encodeURIComponent(taskId)}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, comment }),
  }),
  addTeamTaskResponse: (taskId, message, responseType = 'comment') => request(
    `/team/tasks/${encodeURIComponent(taskId)}/responses`,
    { method: 'POST', body: JSON.stringify({ message, responseType }) },
  ),
  getTeamTaskHistory: (taskId) => request(`/team/tasks/${encodeURIComponent(taskId)}/history`),
  markTeamNotificationRead: (notificationId) => request(
    `/team/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: 'PATCH' },
  ),
  adminDashboard: () => request('/admin/dashboard'),
  adminDepartments: () => request('/admin/departments'),
  createManagedUser: (account) => request('/admin/users', {
    method: 'POST',
    body: JSON.stringify(account),
  }),
  updateManagedUser: (userId, changes) => request(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  }),
  deleteManagedUser: (userId) => request(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  }),

  // Global Search
  searchGlobal: (query, params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries({ q: query, ...params }).filter(([_, v]) => v !== '' && v !== null && v !== undefined),
    );
    const qs = new URLSearchParams(cleanParams).toString();
    return request(`/search?${qs}`);
  },
};
