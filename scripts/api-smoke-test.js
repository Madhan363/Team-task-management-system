import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import process from 'node:process';
import {
  Department,
  ActivityEvent,
  ActivitySession,
  ActivityState,
  AuditLog,
  Meeting,
  MeetingRoom,
  Notification,
  Project,
  ProjectImportDraft,
  Task,
  TaskHistory,
  TaskResponse,
  Team,
  TeamNotification,
  TeamTask,  User,
} from '../server/models.js';
import { createFallbackSuggestions } from '../server/goalSuggestions.js';

const baseUrl = `http://127.0.0.1:${process.env.PORT || 4000}/api`;
const suffix = randomBytes(6).toString('hex');
const createdUserIds = [];
const createdTeamIds = [];
const createdDepartmentIds = [];
const createdMeetingIds = [];
const createdMeetingRoomIds = [];
const createdProjectIds = [];
const createdDraftIds = [];
const createdTaskIds = [];
let taskId;
const testProfileImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aYUAAAAASUVORK5CYII=';
const fallbackSuggestions = createFallbackSuggestions('Prepare for my interview');
assert.equal(fallbackSuggestions.length, 5);
assert.ok(fallbackSuggestions.some((task) => /SQL/i.test(task.title)));
assert.ok(fallbackSuggestions.some((task) => /coding/i.test(task.title)));
assert.ok(fallbackSuggestions.every((task) => task.description.includes('Prepare for my interview')));

async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = response.status === 204 ? '' : await response.text();
  const isJson = response.headers.get('content-type')?.includes('application/json');
  return {
    status: response.status,
    data: text ? (isJson ? JSON.parse(text) : { error: text }) : null,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

async function createTestMember(name, username, email, password) {
  const user = await User.create({
    name,
    username,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'team_member',
  });
  createdUserIds.push(user._id);
  return request('/auth/login', {
    method: 'POST',
    body: { identifier: username, password },
  });
}

try {
  assert.ok(process.env.MONGODB_URI, 'MONGODB_URI must be configured.');
  await mongoose.connect(process.env.MONGODB_URI);

  const publicSignup = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'API Test One',
      username: `test_${suffix}`,
      email: `test_${suffix}@example.com`,
      password: `Pass-${suffix}-secure`,
    },
  });
  assert.equal(publicSignup.status, 401);
  assert.match(publicSignup.data.error, /sign in/i);
  assert.equal(publicSignup.cookie, undefined);

  const firstAccount = await createTestMember(
    'API Test One',
    `test_${suffix}`,
    `test_${suffix}@example.com`,
    `Pass-${suffix}-secure`,
  );
  assert.equal(firstAccount.status, 200);
  assert.ok(firstAccount.cookie);
  assert.equal(Object.hasOwn(firstAccount.data.user, 'passwordHash'), false);
  const activeSession = await request('/auth/session', { cookie: firstAccount.cookie });
  assert.equal(activeSession.status, 200);
  assert.equal(activeSession.data.user.id, firstAccount.data.user.id);
  const trackedSession = await request('/activity/session', { method: 'POST', body: {}, cookie: firstAccount.cookie });
  assert.equal(trackedSession.status, 200);
  const trackedSessionId = trackedSession.data.sessionId;
  const recordedActivity = await request('/activity/activity', {
    method: 'POST',
    body: {},
    cookie: firstAccount.cookie,
  });
  assert.equal(recordedActivity.status, 200);
  assert.equal(recordedActivity.data.recorded, true);
  const concurrentPulseStart = new Date();
  await ActivityState.findOneAndUpdate(
    { user: firstAccount.data.user.id },
    { $set: { lastActivityAt: new Date(Date.now() - 10 * 60_000) } },
  );
  const concurrentActivity = await Promise.all([
    request('/activity/activity', { method: 'POST', body: {}, cookie: firstAccount.cookie }),
    request('/activity/activity', { method: 'POST', body: {}, cookie: firstAccount.cookie }),
  ]);
  assert.ok(concurrentActivity.every((result) => result.status === 200));
  const concurrentActivityEvents = await ActivityEvent.find({
    session: trackedSessionId,
    kind: 'activity',
    createdAt: { $gte: concurrentPulseStart },
  }).select('activeMilliseconds');
  const concurrentActiveMilliseconds = concurrentActivityEvents
    .reduce((total, event) => total + event.activeMilliseconds, 0);
  assert.ok(concurrentActiveMilliseconds >= 299_000);
  assert.ok(concurrentActiveMilliseconds <= 302_000);
  const recordedPresence = await request('/activity/presence', {
    method: 'POST',
    body: {},
    cookie: firstAccount.cookie,
  });
  assert.equal(recordedPresence.status, 204);
  const ownActivityReport = await request('/activity/report?period=today&userId=somebody-else', {
    cookie: firstAccount.cookie,
  });
  assert.equal(ownActivityReport.status, 200);
  assert.equal(ownActivityReport.data.timezone, 'UTC');
  assert.equal(ownActivityReport.data.inactivityThresholdSeconds, 300);
  assert.deepEqual(ownActivityReport.data.users, []);
  assert.ok(ownActivityReport.data.sessions.every((session) => session.userId === firstAccount.data.user.id));
  assert.equal((await request('/activity/report?period=invalid', { cookie: firstAccount.cookie })).status, 400);
  const memberAdminLogin = await request('/auth/login', {
    method: 'POST',
    body: {
      identifier: firstAccount.data.user.username,
      password: `Pass-${suffix}-secure`,
      requireAdminRole: true,
    },
  });
  assert.equal(memberAdminLogin.status, 403);
  assert.equal(memberAdminLogin.cookie, undefined);

  const firstUser = await User.findById(createdUserIds[0]);
  assert.notEqual(firstUser.passwordHash, `Pass-${suffix}-secure`);
  assert.match(firstUser.passwordHash, /^\$2[aby]\$/);

  const secondAccount = await createTestMember(
    'API Test Two',
    `other_${suffix}`,
    `other_${suffix}@example.com`,
    `Pass-${suffix}-secure`,
  );
  assert.equal(secondAccount.status, 200);
  assert.ok(secondAccount.cookie);
  assert.equal(secondAccount.data.user.role, 'team_member');
  assert.notEqual(secondAccount.data.user.id, firstAccount.data.user.id);
  const thirdAccount = await createTestMember(
    'Third API Member',
    `third_${suffix}`,
    `third_${suffix}@example.com`,
    `Pass-${suffix}-secure`,
  );
  assert.equal(thirdAccount.status, 200);
  assert.equal(thirdAccount.data.user.role, 'team_member');
  const adminPassword = `Admin-${suffix}-secure`;
  const adminUser = await User.create({
    name: 'API Test Admin',
    username: `admin_${suffix}`,
    email: `admin_${suffix}@example.com`,
    passwordHash: await bcrypt.hash(adminPassword, 12),
    role: 'admin',
  });
  createdUserIds.push(adminUser._id);
  const adminAccount = await request('/auth/login', {
    method: 'POST',
    body: { identifier: adminUser.username, password: adminPassword },
  });
  assert.equal(adminAccount.status, 200);
  const adminDashboard = await request('/admin/dashboard', { cookie: adminAccount.cookie });
  assert.equal(adminDashboard.status, 200);
  assert.ok(adminDashboard.data.users.some((account) => account.id === firstAccount.data.user.id));
  assert.ok(Object.hasOwn(adminDashboard.data, 'tasks'));
  const managedAccount = await request('/admin/users', {
    method: 'POST',
    cookie: adminAccount.cookie,
    body: {
      name: 'Managed API Account',
      username: `managed_${suffix}`,
      email: `managed_${suffix}@example.com`,
      password: `Managed-${suffix}-secure`,
      role: 'team_member',
    },
  });
  assert.equal(managedAccount.status, 201);
  assert.equal(managedAccount.data.user.role, 'team_member');
  createdUserIds.push(new mongoose.Types.ObjectId(managedAccount.data.user.id));
  const managedAdmin = await request('/admin/users', {
    method: 'POST',
    cookie: adminAccount.cookie,
    body: {
      name: 'Managed API Admin',
      username: `managed_admin_${suffix}`,
      email: `managed_admin_${suffix}@example.com`,
      password: `Managed-${suffix}-secure`,
      role: 'admin',
    },
  });
  assert.equal(managedAdmin.status, 201);
  assert.equal(managedAdmin.data.user.role, 'admin');
  createdUserIds.push(new mongoose.Types.ObjectId(managedAdmin.data.user.id));
  const managedUserEdit = await request(`/admin/users/${managedAccount.data.user.id}`, {
    method: 'PATCH',
    cookie: adminAccount.cookie,
    body: { name: 'Edited Managed Account', role: 'team_leader' },
  });
  assert.equal(managedUserEdit.status, 200);
  assert.equal(managedUserEdit.data.user.role, 'team_leader');
  const managedUserDeactivated = await request(`/admin/users/${managedAccount.data.user.id}`, {
    method: 'PATCH',
    cookie: adminAccount.cookie,
    body: { isActive: false },
  });
  assert.equal(managedUserDeactivated.data.user.isActive, false);
  const deactivatedLogin = await request('/auth/login', {
    method: 'POST',
    body: { identifier: `managed_${suffix}`, password: `Managed-${suffix}-secure` },
  });
  assert.equal(deactivatedLogin.status, 401);
  const managedUserReactivated = await request(`/admin/users/${managedAccount.data.user.id}`, {
    method: 'PATCH',
    cookie: adminAccount.cookie,
    body: { isActive: true },
  });
  assert.equal(managedUserReactivated.data.user.isActive, true);
  const nonAdminCannotManage = await request('/admin/dashboard', { cookie: secondAccount.cookie });
  assert.equal(nonAdminCannotManage.status, 403);
  const publicRoleEscalation = await request('/auth/profile', {
    method: 'PATCH',
    cookie: firstAccount.cookie,
    body: {
      name: 'API Test One',
      username: `test_${suffix}`,
      email: `test_${suffix}@example.com`,
      role: 'admin',
    },
  });
  assert.equal(publicRoleEscalation.status, 400);
  const assignedLeaderRole = await request(`/admin/users/${firstAccount.data.user.id}`, {
    method: 'PATCH',
    cookie: adminAccount.cookie,
    body: { role: 'team_leader' },
  });
  assert.equal(assignedLeaderRole.status, 200);
  const createdDepartment = await request('/departments', {
    method: 'POST',
    cookie: adminAccount.cookie,
    body: {
      name: `Department ${suffix}`,
      description: 'Team assignment smoke test',
      teamLeaderId: firstAccount.data.user.id,
    },
  });
  assert.equal(createdDepartment.status, 201);
  const departmentId = createdDepartment.data.department.id;
  createdDepartmentIds.push(new mongoose.Types.ObjectId(departmentId));
  const leaderActivityReport = await request('/activity/report?period=week', { cookie: firstAccount.cookie });
  assert.equal(leaderActivityReport.status, 200);
  assert.ok(leaderActivityReport.data.users.some((person) => person.id === firstAccount.data.user.id));
  assert.ok(!leaderActivityReport.data.users.some((person) => person.id === adminAccount.data.user.id));
  const adminActivityReport = await request('/activity/report?period=month', { cookie: adminAccount.cookie });
  assert.equal(adminActivityReport.status, 200);
  assert.ok(adminActivityReport.data.users.some((person) => person.id === firstAccount.data.user.id));
  const memberAuditLogsForbidden = await request('/audit-logs', { cookie: secondAccount.cookie });
  assert.equal(memberAuditLogsForbidden.status, 403);
  const adminAuditLogs = await request('/audit-logs?limit=100', { cookie: adminAccount.cookie });
  assert.equal(adminAuditLogs.status, 200);
  assert.ok(adminAuditLogs.data.logs.some((entry) => entry.action === 'department.created'));
  for (const account of [secondAccount, thirdAccount]) {
    const assignedMemberDepartment = await request(`/admin/users/${account.data.user.id}`, {
      method: 'PATCH',
      cookie: adminAccount.cookie,
      body: { departmentId },
    });
    assert.equal(assignedMemberDepartment.status, 200);
    const assignedMember = await User.findById(account.data.user.id);
    assert.ok(assignedMember.department.equals(departmentId));
  }
  assert.equal((await request('/user-stories', { cookie: firstAccount.cookie })).status, 404);
  assert.equal((await request('/projects/import/members', { cookie: secondAccount.cookie })).status, 403);
  const importMembers = await request('/projects/import/members', { cookie: firstAccount.cookie });
  assert.equal(importMembers.status, 200);
  assert.ok(importMembers.data.members.some((member) => member.id === secondAccount.data.user.id));
  assert.ok(importMembers.data.members.every((member) => member.department === createdDepartment.data.department.name));

  const formulaWorkbook = new ExcelJS.Workbook();
  const formulaWorksheet = formulaWorkbook.addWorksheet('Formula check');
  formulaWorksheet.addRow(['Project Name', 'Task Title', 'Priority']);
  formulaWorksheet.addRow(['Formula Project', { formula: '"Calculated title"' }, 'medium']);
  const formulaBuffer = await formulaWorkbook.xlsx.writeBuffer();
  const formulaPreview = await request('/projects/import/preview', {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: {
      fileName: `formula-${suffix}.xlsx`,
      fileData: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${Buffer.from(formulaBuffer).toString('base64')}`,
    },
  });
  assert.equal(formulaPreview.status, 200);
  assert.ok(formulaPreview.data.validationErrors.some((item) => /formula/i.test(item.message)));
  assert.equal(formulaPreview.data.rows[0].title, '');
  assert.ok(formulaPreview.data.rows[0].formulaFields.includes('task title'));
  const correctedFormulaPreview = await request(`/projects/import/${formulaPreview.data.draftId}/rows`, {
    method: 'PUT',
    cookie: firstAccount.cookie,
    body: {
      rows: [{
        ...formulaPreview.data.rows[0],
        title: 'Fixed title',
        formulaFields: [],
      }],
    },
  });
  assert.equal(correctedFormulaPreview.status, 200);
  assert.equal(correctedFormulaPreview.data.validationErrors.length, 0);
  const cancelledFormulaDraft = await request(`/projects/import/${formulaPreview.data.draftId}`, {
    method: 'DELETE',
    cookie: firstAccount.cookie,
  });
  assert.equal(cancelledFormulaDraft.status, 204);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Projects');
  worksheet.addRow([
    'Project Name',
    'Project Description',
    'Task Title',
    'Task Description',
    'Priority',
    'Start Date',
    'Due Date',
  ]);
  worksheet.addRows([
    ['Import Alpha', 'Alpha project', 'Alpha task one', 'First task', 'high', '2030-01-01', '2030-01-10'],
    ['Import Alpha', 'Alpha project', 'Alpha task two', 'Second task', 'medium', '', '2030-01-20'],
    ['Import Beta', 'Beta project', 'Beta task', 'Third task', 'low', '', ''],
  ]);
  const workbookBuffer = await workbook.xlsx.writeBuffer();
  const fileData = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${Buffer.from(workbookBuffer).toString('base64')}`;
  const invalidWorkbook = await request('/projects/import/preview', {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: { fileName: 'not-an-excel.csv', fileData },
  });
  assert.equal(invalidWorkbook.status, 400);
  const preview = await request('/projects/import/preview', {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: { fileName: `project-${suffix}.xlsx`, fileData },
  });
  assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.equal(preview.data.projects.length, 2);
  assert.equal(preview.data.tasks.length, 3);
  assert.equal(preview.data.validationErrors.length, 0);
  const adminDraft = await ProjectImportDraft.create({
    owner: firstAccount.data.user.id,
    department: departmentId,
    projects: [],
    rows: [],
    tasks: [],
    importHash: `admin-delete-${suffix}`,
    sourceName: `admin-delete-${suffix}.xlsx`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  createdDraftIds.push(adminDraft._id);
  const adminDeletesDraft = await request(`/projects/import/${adminDraft._id}`, {
    method: 'DELETE',
    cookie: adminAccount.cookie,
  });
  assert.equal(adminDeletesDraft.status, 204);
  const importDraftId = preview.data.draftId;
  createdDraftIds.push(new mongoose.Types.ObjectId(importDraftId));
  const assignments = [
    { rowNumber: 2, members: [{ memberId: secondAccount.data.user.id, responsibility: 'Frontend', description: 'Build the interface.' }] },
    { rowNumber: 3, members: [
      { memberId: secondAccount.data.user.id, responsibility: 'Testing', description: 'Test the workflow.' },
      { memberId: thirdAccount.data.user.id, responsibility: 'Review', description: 'Review behavior.' },
    ] },
    { rowNumber: 4, members: [{ memberId: thirdAccount.data.user.id, responsibility: 'Backend', description: 'Implement the endpoint.' }] },
  ];
  const crossDepartmentProjectAssignment = await request(`/projects/import/${importDraftId}/assignments`, {
    method: 'PUT',
    cookie: firstAccount.cookie,
    body: { assignments: [{ ...assignments[0], members: [{ memberId: adminAccount.data.user.id, responsibility: '', description: '' }] }, ...assignments.slice(1)] },
  });
  assert.equal(crossDepartmentProjectAssignment.status, 403);
  const savedAssignments = await request(`/projects/import/${importDraftId}/assignments`, {
    method: 'PUT',
    cookie: firstAccount.cookie,
    body: { assignments },
  });
  assert.equal(savedAssignments.status, 200);
  const resumedDraft = await request(`/projects/import/${importDraftId}`, { cookie: firstAccount.cookie });
  assert.equal(resumedDraft.status, 200);
  assert.equal(resumedDraft.data.assignments.length, 3);
  const memberCannotReadDraft = await request(`/projects/import/${importDraftId}`, { cookie: secondAccount.cookie });
  assert.equal(memberCannotReadDraft.status, 403);
  const publishedImport = await request(`/projects/import/${importDraftId}/publish`, {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: {},
  });
  assert.equal(publishedImport.status, 201, JSON.stringify(publishedImport.data));
  assert.equal(publishedImport.data.projects.length, 2);
  publishedImport.data.projects.forEach((project) => {
    createdProjectIds.push(new mongoose.Types.ObjectId(project.id));
  });
  const importedTaskIds = publishedImport.data.projects.flatMap((project) => project.tasks.map((task) => task.id));
  createdTaskIds.push(...importedTaskIds.map((id) => new mongoose.Types.ObjectId(id)));
  assert.equal(publishedImport.data.projects.reduce((total, project) => total + project.taskCount, 0), 3);
  const leaderProjects = await request('/projects', { cookie: firstAccount.cookie });
  assert.equal(leaderProjects.status, 200);
  assert.equal(leaderProjects.data.projects.length, 2);
  const memberProjects = await request('/projects', { cookie: secondAccount.cookie });
  assert.equal(memberProjects.status, 200);
  const memberAlphaProject = memberProjects.data.projects.find((project) => project.name === 'Import Alpha');
  assert.ok(memberAlphaProject);
  assert.equal(memberAlphaProject.tasks.length, 2);
  assert.ok(memberAlphaProject.tasks.every((task) => task.assignees.some((member) => member.id === secondAccount.data.user.id)));
  const individuallyAssignedTask = memberAlphaProject.tasks.find((task) => task.title === 'Alpha task one');
  assert.ok(individuallyAssignedTask);
  assert.equal(individuallyAssignedTask.collaborationEnabled, false);
  const leaderTaskList = await request('/tasks/team', { cookie: firstAccount.cookie });
  assert.equal(leaderTaskList.status, 200);
  const leaderListedIndividualTask = leaderTaskList.data.tasks.find((task) => task.id === individuallyAssignedTask.id);
  assert.ok(leaderListedIndividualTask);
  const listedIndividualContribution = leaderListedIndividualTask.contributions.find(
    (item) => String(item.user) === secondAccount.data.user.id,
  );
  assert.equal(listedIndividualContribution.responsibility, 'Frontend');
  assert.equal(listedIndividualContribution.member.name, secondAccount.data.user.name);
  assert.equal(listedIndividualContribution.progress, 0);
  const leaderSingleMemberAssignment = await request(
    `/tasks/${individuallyAssignedTask.id}/contributions/${secondAccount.data.user.id}`,
    {
      method: 'PATCH',
      cookie: firstAccount.cookie,
      body: { responsibility: 'Login UI', description: 'Implement the responsive login screen.' },
    },
  );
  assert.equal(leaderSingleMemberAssignment.status, 200, JSON.stringify(leaderSingleMemberAssignment.data));
  assert.equal(
    leaderSingleMemberAssignment.data.task.contributions.find((item) => String(item.user) === secondAccount.data.user.id).responsibility,
    'Login UI',
  );
  const unassignedContributionUpdate = await request(`/tasks/${individuallyAssignedTask.id}/contribution`, {
    method: 'PATCH',
    cookie: thirdAccount.cookie,
    body: { status: 'in_progress', progress: 25 },
  });
  assert.equal(unassignedContributionUpdate.status, 403);
  const individualContributionUpdate = await request(`/tasks/${individuallyAssignedTask.id}/contribution`, {
    method: 'PATCH',
    cookie: secondAccount.cookie,
    body: { status: 'in_progress', progress: 25 },
  });
  assert.equal(individualContributionUpdate.status, 200, JSON.stringify(individualContributionUpdate.data));
  const individualTaskAcknowledgment = await request(`/tasks/${individuallyAssignedTask.id}/acknowledge`, {
    method: 'PATCH',
    cookie: secondAccount.cookie,
  });
  assert.equal(individualTaskAcknowledgment.status, 200, JSON.stringify(individualTaskAcknowledgment.data));
  assert.equal(individualTaskAcknowledgment.data.task.acknowledgmentStatus, 'acknowledged');
  assert.ok(individualTaskAcknowledgment.data.task.acknowledgedAt);
  const repeatedAcknowledgment = await request(`/tasks/${individuallyAssignedTask.id}/acknowledge`, {
    method: 'PATCH',
    cookie: secondAccount.cookie,
  });
  assert.equal(repeatedAcknowledgment.status, 200);
  assert.equal(
    repeatedAcknowledgment.data.task.acknowledgedAt,
    individualTaskAcknowledgment.data.task.acknowledgedAt,
  );
  const unassignedAcknowledgment = await request(`/tasks/${individuallyAssignedTask.id}/acknowledge`, {
    method: 'PATCH',
    cookie: thirdAccount.cookie,
  });
  assert.equal(unassignedAcknowledgment.status, 403);
  assert.equal(
    individualContributionUpdate.data.task.contributions.find((item) => String(item.user) === secondAccount.data.user.id).progress,
    25,
  );
  const refreshedLeaderTasks = await request('/tasks/team', { cookie: firstAccount.cookie });
  const refreshedContributionTask = refreshedLeaderTasks.data.tasks.find((task) => task.id === individuallyAssignedTask.id);
  const refreshedContribution = refreshedContributionTask.contributions.find(
    (item) => String(item.user) === secondAccount.data.user.id,
  );
  assert.equal(refreshedContribution.progress, 25);
  assert.equal(refreshedContribution.status, 'in_progress');
  assert.ok(refreshedContribution.updatedAt);
  const secondMemberProjectTaskIds = memberAlphaProject.tasks.map((task) => task.id);
  assert.equal(memberProjects.data.projects.find((project) => project.name === 'Import Beta').tasks.length, 0);
  const duplicateImport = await request('/projects/import/preview', {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: { fileName: `project-${suffix}.xlsx`, fileData },
  });
  assert.equal(duplicateImport.status, 409);
  assert.equal(await ProjectImportDraft.countDocuments({ _id: importDraftId }), 0);
  const projectToDelete = publishedImport.data.projects.find((project) => project.name === 'Import Beta');
  const memberCannotDeleteProject = await request(`/projects/${projectToDelete.id}`, {
    method: 'DELETE',
    cookie: secondAccount.cookie,
  });
  assert.equal(memberCannotDeleteProject.status, 403);
  const leaderDeletesProject = await request(`/projects/${projectToDelete.id}`, {
    method: 'DELETE',
    cookie: firstAccount.cookie,
  });
  assert.equal(leaderDeletesProject.status, 204);
  assert.ok(await Task.exists({ project: projectToDelete.id, deletedAt: { $ne: null }, projectPublished: false }));
  const deletedProjectTask = await request(`/tasks/${projectToDelete.tasks[0].id}`, { cookie: firstAccount.cookie });
  assert.equal(deletedProjectTask.status, 404);
  const deletedProjectDetails = await request(`/projects/${projectToDelete.id}`, { cookie: firstAccount.cookie });
  assert.equal(deletedProjectDetails.status, 404);

  const sharedTaskResponse = await request('/tasks', {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: {
      title: `Shared task ${suffix}`,
      description: 'Verify shared assignment, chat, contribution ownership, and review.',
      priority: 'critical',
      departmentId,
      assignedMemberIds: [secondAccount.data.user.id, thirdAccount.data.user.id],
      contributions: [
        { userId: secondAccount.data.user.id, responsibility: 'Frontend', description: 'Build the UI.' },
        { userId: thirdAccount.data.user.id, responsibility: 'Backend', description: 'Build the API.' },
      ],
    },
  });
  assert.equal(sharedTaskResponse.status, 201, JSON.stringify(sharedTaskResponse.data));
  const sharedTaskId = sharedTaskResponse.data.task.id;
  createdTaskIds.push(new mongoose.Types.ObjectId(sharedTaskId));
  assert.equal(sharedTaskResponse.data.task.collaborationEnabled, true);
  assert.equal(sharedTaskResponse.data.task.assignees.length, 2);
  assert.equal(sharedTaskResponse.data.task.contributions.length, 2);
  const sharedTaskList = await request('/tasks/my-tasks', { cookie: secondAccount.cookie });
  assert.ok(sharedTaskList.data.tasks.some((task) => task.id === sharedTaskId));
  const sharedTaskDetail = await request(`/tasks/${sharedTaskId}`, { cookie: thirdAccount.cookie });
  assert.equal(sharedTaskDetail.status, 200);
  assert.equal(sharedTaskDetail.data.task.contributions.length, 2);
  const memberChatPost = await request(`/tasks/${sharedTaskId}/chat`, {
    method: 'POST',
    cookie: secondAccount.cookie,
    body: { message: 'Starting the frontend work.' },
  });
  assert.equal(memberChatPost.status, 201);
  const malformedTaskChat = await request('/tasks/draft-not-a-task-id/chat', { cookie: secondAccount.cookie });
  assert.equal(malformedTaskChat.status, 404);
  const sharedChatRead = await request(`/tasks/${sharedTaskId}/chat`, { cookie: thirdAccount.cookie });
  assert.equal(sharedChatRead.status, 200);
  assert.equal(sharedChatRead.data.messages[0].message, 'Starting the frontend work.');
  const leaderChatPost = await request(`/tasks/${sharedTaskId}/chat`, {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: { message: 'Team Leader message hidden from member discussion.' },
  });
  assert.equal(leaderChatPost.status, 201);
  const memberChatAfterLeaderPost = await request(`/tasks/${sharedTaskId}/chat`, { cookie: thirdAccount.cookie });
  assert.equal(memberChatAfterLeaderPost.status, 200);
  assert.ok(memberChatAfterLeaderPost.data.messages.every((message) => message.sender.role !== 'team_leader'));
  assert.ok(memberChatAfterLeaderPost.data.messages.some((message) => message.message === 'Starting the frontend work.'));
  const leaderChatRead = await request(`/tasks/${sharedTaskId}/chat`, { cookie: firstAccount.cookie });
  assert.ok(leaderChatRead.data.messages.some((message) => message.message === 'Team Leader message hidden from member discussion.'));
  const outsideDepartmentAccount = await createTestMember(
    'Outside Department Member',
    `outside_${suffix}`,
    `outside_${suffix}@example.com`,
    `Outside-${suffix}-secure`,
  );
  assert.equal(outsideDepartmentAccount.status, 200);
  const outsideProjectAccess = await request(`/projects/${publishedImport.data.projects[0].id}`, {
    cookie: outsideDepartmentAccount.cookie,
  });
  assert.equal(outsideProjectAccess.status, 403);
  const unauthorizedChatRead = await request(`/tasks/${sharedTaskId}/chat`, { cookie: outsideDepartmentAccount.cookie });
  assert.equal(unauthorizedChatRead.status, 403);
  const unauthorizedContributionUpdate = await request(`/tasks/${sharedTaskId}/contribution`, {
    method: 'PATCH',
    cookie: outsideDepartmentAccount.cookie,
    body: { status: 'done', progress: 100 },
  });
  assert.equal(unauthorizedContributionUpdate.status, 403);
  const leaderAssignmentUpdate = await request(`/tasks/${sharedTaskId}/contributions/${thirdAccount.data.user.id}`, {
    method: 'PATCH',
    cookie: firstAccount.cookie,
    body: { responsibility: 'API service', description: 'Implement and test the service layer.' },
  });
  assert.equal(leaderAssignmentUpdate.status, 200);
  assert.equal(
    leaderAssignmentUpdate.data.task.contributions.find((item) => String(item.user) === thirdAccount.data.user.id).responsibility,
    'API service',
  );
  const memberCannotManagePeerAssignment = await request(`/tasks/${sharedTaskId}/contributions/${thirdAccount.data.user.id}`, {
    method: 'PATCH',
    cookie: secondAccount.cookie,
    body: { responsibility: 'Unauthorized change', description: '' },
  });
  assert.equal(memberCannotManagePeerAssignment.status, 403);
  const rejectedSubmissionFile = await request(`/tasks/${sharedTaskId}/team-submissions`, {
    method: 'POST',
    cookie: secondAccount.cookie,
    body: {
      attachments: [{ name: 'bad.html', data: 'data:text/html;base64,PGh0bWw+' }],
    },
  });
  assert.equal(rejectedSubmissionFile.status, 400);
  const incompleteSubmissionNeedsConfirmation = await request(`/tasks/${sharedTaskId}/team-submissions`, {
    method: 'POST',
    cookie: secondAccount.cookie,
    body: { notes: 'Attempt before all members finish.' },
  });
  assert.equal(incompleteSubmissionNeedsConfirmation.status, 409);
  assert.equal(incompleteSubmissionNeedsConfirmation.data.requiresConfirmation, true);
  const firstContributionUpdate = await request(`/tasks/${sharedTaskId}/contribution`, {
    method: 'PATCH',
    cookie: secondAccount.cookie,
    body: { status: 'done', progress: 100, completionNotes: 'Frontend complete.' },
  });
  assert.equal(firstContributionUpdate.status, 200);
  assert.equal(firstContributionUpdate.data.task.contributions.find((item) => String(item.user) === secondAccount.data.user.id).status, 'done');
  assert.notEqual(firstContributionUpdate.data.task.contributions.find((item) => String(item.user) === thirdAccount.data.user.id).status, 'done');
  const secondContributionUpdate = await request(`/tasks/${sharedTaskId}/contribution`, {
    method: 'PATCH',
    cookie: thirdAccount.cookie,
    body: { status: 'done', progress: 100, completionNotes: 'Backend complete.' },
  });
  assert.equal(secondContributionUpdate.status, 200);
  const sharedPdf = 'data:application/pdf;base64,JVBERi0xLjQK';
  const teamSubmission = await request(`/tasks/${sharedTaskId}/team-submissions`, {
    method: 'POST',
    cookie: secondAccount.cookie,
    body: {
      notes: 'The completed work is ready.',
      attachments: [{ name: 'report.pdf', data: sharedPdf }],
    },
  });
  assert.equal(teamSubmission.status, 201, JSON.stringify(teamSubmission.data));
  assert.equal(teamSubmission.data.task.status, 'submitted_review');
  assert.equal(teamSubmission.data.task.submissions[0].attachments[0].url, sharedPdf);
  const completedBeforeReview = await request(`/tasks/${sharedTaskId}/status`, {
    method: 'PATCH',
    cookie: secondAccount.cookie,
    body: { status: 'completed' },
  });
  assert.equal(completedBeforeReview.status, 403);
  const requestedTaskChanges = await request(`/tasks/${sharedTaskId}/review`, {
    method: 'PATCH',
    cookie: firstAccount.cookie,
    body: { decision: 'changes_requested', comment: 'Please include API test evidence.' },
  });
  assert.equal(requestedTaskChanges.status, 200, JSON.stringify(requestedTaskChanges.data));
  assert.equal(requestedTaskChanges.data.task.status, 'in_progress');
  assert.equal(requestedTaskChanges.data.task.submissions[0].decision, 'changes_requested');
  const resubmittedTask = await request(`/tasks/${sharedTaskId}/team-submissions`, {
    method: 'POST',
    cookie: thirdAccount.cookie,
    body: { notes: 'Included the requested evidence.' },
  });
  assert.equal(resubmittedTask.status, 201);
  assert.equal(resubmittedTask.data.task.submissions[1].version, 2);
  const approvedSharedTask = await request(`/tasks/${sharedTaskId}/review`, {
    method: 'PATCH',
    cookie: firstAccount.cookie,
    body: { decision: 'approve', comment: 'Accepted.' },
  });
  assert.equal(approvedSharedTask.status, 200, JSON.stringify(approvedSharedTask.data));
  assert.equal(approvedSharedTask.data.task.status, 'completed');
  assert.equal(approvedSharedTask.data.task.submissions[1].decision, 'approved');
  const cannotResubmitCompleted = await request(`/tasks/${sharedTaskId}/team-submissions`, {
    method: 'POST',
    cookie: secondAccount.cookie,
    body: { notes: 'Should not reopen completed task.' },
  });
  assert.equal(cannotResubmitCompleted.status, 409);
  const removedStoryEndpoint = await request('/user-stories', { cookie: firstAccount.cookie });
  assert.equal(removedStoryEndpoint.status, 404);

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    const leadershipRoom = await request('/meetings/rooms', {
      method: 'POST',
      cookie: adminAccount.cookie,
      body: {
        name: `Leadership ${suffix}`,
        participantIds: [firstAccount.data.user.id],
      },
    });
    assert.equal(leadershipRoom.status, 201);
    assert.equal(leadershipRoom.data.room.type, 'leadership');
    createdMeetingRoomIds.push(new mongoose.Types.ObjectId(leadershipRoom.data.room.id));
    const leaderRooms = await request('/meetings/rooms', { cookie: firstAccount.cookie });
    assert.equal(leaderRooms.status, 200);
    assert.ok(leaderRooms.data.rooms.some((room) => room.id === leadershipRoom.data.room.id));

    const teamRoom = await request('/meetings/rooms', {
      method: 'POST',
      cookie: firstAccount.cookie,
      body: {
        name: `Team ${suffix}`,
        departmentId,
        participantIds: [secondAccount.data.user.id],
      },
    });
    assert.equal(teamRoom.status, 201);
    assert.equal(teamRoom.data.room.type, 'team');
    createdMeetingRoomIds.push(new mongoose.Types.ObjectId(teamRoom.data.room.id));

    const scheduledMeeting = await request('/meetings', {
      method: 'POST',
      cookie: firstAccount.cookie,
      body: {
        title: `Planning ${suffix}`,
        description: 'Meeting API smoke test',
        agenda: 'Review the implementation',
        startsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        durationMinutes: 30,
        timezone: 'UTC',
        roomId: teamRoom.data.room.id,
        participantIds: [secondAccount.data.user.id],
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      },
    });
    assert.equal(scheduledMeeting.status, 201);
    assert.equal(scheduledMeeting.data.meeting.room.id, teamRoom.data.room.id);
    createdMeetingIds.push(new mongoose.Types.ObjectId(scheduledMeeting.data.meeting.id));
    const invitedMemberMeetings = await request('/meetings', { cookie: secondAccount.cookie });
    assert.ok(invitedMemberMeetings.data.meetings.some((meeting) => meeting.id === scheduledMeeting.data.meeting.id));
    const nonParticipantNote = await request(`/meetings/${scheduledMeeting.data.meeting.id}/notes`, {
      method: 'POST',
      cookie: thirdAccount.cookie,
      body: { text: 'Should be denied.' },
    });
    assert.equal(nonParticipantNote.status, 403);
    const note = await request(`/meetings/${scheduledMeeting.data.meeting.id}/notes`, {
      method: 'POST',
      cookie: secondAccount.cookie,
      body: { type: 'decision', text: 'Keep the API scoped to room members.' },
    });
    assert.equal(note.status, 201);
    assert.equal(note.data.meeting.notes[0].type, 'decision');
    const followUp = await request(`/meetings/${scheduledMeeting.data.meeting.id}/follow-ups`, {
      method: 'POST',
      cookie: secondAccount.cookie,
      body: { title: 'Verify room permissions', assignedTo: secondAccount.data.user.id },
    });
    assert.equal(followUp.status, 201);
    assert.equal(followUp.data.meeting.followUps[0].status, 'open');
    const completedFollowUp = await request(
      `/meetings/${scheduledMeeting.data.meeting.id}/follow-ups/${followUp.data.meeting.followUps[0].id}`,
      { method: 'PATCH', cookie: secondAccount.cookie, body: { status: 'completed' } },
    );
    assert.equal(completedFollowUp.status, 200);
    assert.equal(completedFollowUp.data.meeting.followUps[0].status, 'completed');
    const nonAdminRoomCreate = await request('/meetings/rooms', {
      method: 'POST',
      cookie: secondAccount.cookie,
      body: { name: `Unauthorized ${suffix}`, participantIds: [thirdAccount.data.user.id] },
    });
    assert.equal(nonAdminRoomCreate.status, 403);
    const meetingAuditLogs = await request('/audit-logs?limit=100', { cookie: adminAccount.cookie });
    assert.ok(meetingAuditLogs.data.logs.some((entry) => entry.action === 'meeting.created'));
    assert.ok(meetingAuditLogs.data.logs.some((entry) => entry.action === 'meeting.room.created'));
  }
  const assignedTaskFromTaskApi = await request('/tasks', {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: {
      title: 'Leader-assigned task permission test',
      assignedTo: secondAccount.data.user.id,
      departmentId,
    },
  });
  assert.equal(assignedTaskFromTaskApi.status, 201);
  const memberPersonalTasks = await request('/tasks/personal', { cookie: secondAccount.cookie });
  assert.equal(memberPersonalTasks.status, 200);
  assert.equal(memberPersonalTasks.data.tasks.some((task) => task.id === assignedTaskFromTaskApi.data.task.id), false);
  const memberCannotCompleteAssignedTask = await request(
    `/tasks/${assignedTaskFromTaskApi.data.task.id}`,
    { method: 'PATCH', cookie: secondAccount.cookie, body: { completed: true } },
  );
  assert.equal(memberCannotCompleteAssignedTask.status, 404);
  const otherMemberTaskHistory = await request(
    `/tasks/${assignedTaskFromTaskApi.data.task.id}/history`,
    { cookie: thirdAccount.cookie },
  );
  assert.equal(otherMemberTaskHistory.status, 403);
  const otherMemberTaskComment = await request(
    `/tasks/${assignedTaskFromTaskApi.data.task.id}/responses`,
    { method: 'POST', cookie: thirdAccount.cookie, body: { message: 'Unauthorized comment' } },
  );
  assert.equal(otherMemberTaskComment.status, 403);
  const nonAdminDepartments = await request('/departments', { cookie: secondAccount.cookie });
  assert.equal(nonAdminDepartments.status, 403);
  const nonAdminUserDetails = await request(`/users/${firstAccount.data.user.id}`, { cookie: secondAccount.cookie });
  assert.equal(nonAdminUserDetails.status, 403);

  const usernameLogin = await request('/auth/login', {
    method: 'POST',
    body: { identifier: `other_${suffix}`, password: `Pass-${suffix}-secure` },
  });
  assert.equal(usernameLogin.status, 200);
  const emailLogin = await request('/auth/login', {
    method: 'POST',
    body: { identifier: `test_${suffix}@example.com`, password: `Pass-${suffix}-secure` },
  });
  assert.equal(emailLogin.status, 200);

  const createdTeam = await request('/team/teams', {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: { name: `Team ${suffix}`, description: 'Assignment smoke test' },
  });
  assert.equal(createdTeam.status, 201);
  const teamId = createdTeam.data.team.id;
  createdTeamIds.push(new mongoose.Types.ObjectId(teamId));
  const addedMember = await request(`/team/teams/${teamId}/members`, {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: { email: `other_${suffix}@example.com` },
  });
  assert.equal(addedMember.status, 201);
  assert.equal(addedMember.data.member.id, secondAccount.data.user.id);
  const addedSecondMember = await request(`/team/teams/${teamId}/members`, {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: { email: `third_${suffix}@example.com` },
  });
  assert.equal(addedSecondMember.status, 201);

  const firstTeamTask = await request(`/team/teams/${teamId}/tasks`, {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: {
      title: 'Task assigned to member one',
      description: 'Review this task and acknowledge receipt.',
      priority: 'high',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      assigneeId: secondAccount.data.user.id,
    },
  });
  assert.equal(firstTeamTask.status, 201);
  assert.equal(firstTeamTask.data.task.assignee.id, secondAccount.data.user.id);
  assert.ok(firstTeamTask.data.task.assignedAt);
  const secondTeamTask = await request(`/team/teams/${teamId}/tasks`, {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: {
      title: 'Task assigned to member two',
      assigneeId: thirdAccount.data.user.id,
    },
  });
  assert.equal(secondTeamTask.status, 201);
  const memberCannotAssignTasks = await request(`/team/teams/${teamId}/tasks`, {
    method: 'POST',
    cookie: secondAccount.cookie,
    body: { title: 'Member cannot assign', assigneeId: thirdAccount.data.user.id },
  });
  assert.equal(memberCannotAssignTasks.status, 403);
  const memberDashboard = await request('/team/member/dashboard', { cookie: secondAccount.cookie });
  assert.equal(memberDashboard.status, 200);
  assert.deepEqual(memberDashboard.data.tasks.map((task) => task.id), [firstTeamTask.data.task.id]);
  assert.equal(JSON.stringify(memberDashboard.data).includes(thirdAccount.data.user.id), false);
  const unauthorizedAcknowledgement = await request(
    `/team/tasks/${firstTeamTask.data.task.id}/acknowledge`,
    { method: 'PATCH', cookie: thirdAccount.cookie, body: {} },
  );
  assert.equal(unauthorizedAcknowledgement.status, 404);
  const unauthorizedStatusChange = await request(`/team/tasks/${firstTeamTask.data.task.id}/status`, {
    method: 'PATCH',
    cookie: thirdAccount.cookie,
    body: { status: 'in_progress' },
  });
  assert.equal(unauthorizedStatusChange.status, 404);
  const acknowledgement = await request(
    `/team/tasks/${firstTeamTask.data.task.id}/acknowledge`,
    { method: 'PATCH', cookie: secondAccount.cookie, body: {} },
  );
  assert.equal(acknowledgement.status, 200);
  assert.ok(acknowledgement.data.task.acknowledgedAt);
  const duplicateAcknowledgement = await request(
    `/team/tasks/${firstTeamTask.data.task.id}/acknowledge`,
    { method: 'PATCH', cookie: secondAccount.cookie, body: {} },
  );
  assert.equal(duplicateAcknowledgement.status, 200);
  const leaderDashboard = await request('/team/leader/dashboard', { cookie: firstAccount.cookie });
  assert.equal(leaderDashboard.status, 200);
  assert.ok(leaderDashboard.data.tasks.find((task) => task.id === firstTeamTask.data.task.id).acknowledgedAt);
  assert.equal(leaderDashboard.data.notifications.length, 1);
  assert.match(leaderDashboard.data.notifications[0].message, /API Test Two acknowledged/);
  const updatedTeamTaskStatus = await request(`/team/tasks/${firstTeamTask.data.task.id}/status`, {
    method: 'PATCH',
    cookie: secondAccount.cookie,
    body: { status: 'in_progress' },
  });
  assert.equal(updatedTeamTaskStatus.status, 200);
  assert.equal(updatedTeamTaskStatus.data.task.status, 'in_progress');
  const teamNotificationsAfterRead = await request(
    `/team/notifications/${leaderDashboard.data.notifications[0].id}/read`,
    { method: 'PATCH', cookie: firstAccount.cookie },
  );
  assert.equal(teamNotificationsAfterRead.status, 200);
  assert.equal(teamNotificationsAfterRead.data.read, true);

  const clearTestNotifications = await Notification.create([
    {
      recipient: firstUser._id,
      title: 'Clear test notification',
      message: 'This notification belongs to the first API test account.',
    },
    {
      recipient: new mongoose.Types.ObjectId(secondAccount.data.user.id),
      title: 'Retained test notification',
      message: 'This notification belongs to the second API test account.',
    },
  ]);
  const firstAccountNotificationCount = await Notification.countDocuments({
    recipient: firstUser._id,
  });
  const clearOwnNotifications = await request('/notifications', {
    method: 'DELETE',
    cookie: firstAccount.cookie,
  });
  assert.equal(clearOwnNotifications.status, 200);
  assert.equal(clearOwnNotifications.data.deletedCount, firstAccountNotificationCount);
  assert.equal(await Notification.exists({ recipient: firstUser._id }), null);
  assert.ok(await Notification.exists({ _id: clearTestNotifications[1]._id }));

  const updatedProfile = await request('/auth/profile', {
    method: 'PATCH',
    cookie: firstAccount.cookie,
    body: {
      name: 'Updated API Test One',
      username: `edited_${suffix}`,
      email: `edited_${suffix}@example.com`,
      phoneNumber: '+1 (555) 123-4567',
      profileImage: testProfileImage,
    },
  });
  assert.equal(updatedProfile.status, 200);
  assert.equal(updatedProfile.data.user.name, 'Updated API Test One');
  assert.equal(updatedProfile.data.user.username, `edited_${suffix}`);
  assert.equal(updatedProfile.data.user.email, `edited_${suffix}@example.com`);
  assert.equal(updatedProfile.data.user.phoneNumber, '+1 (555) 123-4567');
  assert.equal(updatedProfile.data.user.profileImage, testProfileImage);
  const refreshedSession = await request('/auth/session', { cookie: firstAccount.cookie });
  assert.equal(refreshedSession.data.user.username, `edited_${suffix}`);
  assert.equal(refreshedSession.data.user.email, `edited_${suffix}@example.com`);
  assert.equal(refreshedSession.data.user.phoneNumber, '+1 (555) 123-4567');
  assert.equal(refreshedSession.data.user.profileImage, testProfileImage);

  const invalidProfileImage = await request('/auth/profile', {
    method: 'PATCH',
    cookie: firstAccount.cookie,
    body: {
      name: 'Updated API Test One',
      username: `edited_${suffix}`,
      email: `edited_${suffix}@example.com`,
      profileImage: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    },
  });
  assert.equal(invalidProfileImage.status, 400);

  const duplicateProfile = await request('/auth/profile', {
    method: 'PATCH',
    cookie: firstAccount.cookie,
    body: {
      name: 'Should Not Be Saved',
      username: `edited_${suffix}`,
      email: `other_${suffix}@example.com`,
    },
  });
  assert.equal(duplicateProfile.status, 409);
  const profileAfterConflict = await request('/auth/session', { cookie: firstAccount.cookie });
  assert.equal(profileAfterConflict.data.user.name, 'Updated API Test One');

  const unauthenticatedTasks = await request('/tasks');
  assert.equal(unauthenticatedTasks.status, 401);
  const unauthenticatedSuggestions = await request('/assistant/suggestions', {
    method: 'POST',
    body: { goal: 'Prepare for my interview' },
  });
  assert.equal(unauthenticatedSuggestions.status, 401);
  const invalidSuggestionGoal = await request('/assistant/suggestions', {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: { goal: 'x' },
  });
  assert.equal(invalidSuggestionGoal.status, 400);

  const createdTask = await request('/tasks', {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: {
      title: 'Owned task',
      description: 'Task details',
      category: 'Work',
      priority: 'high',
      dueDate: '2030-06-10T12:00:00.000Z',
      reminderAt: '2030-06-10T10:00:00.000Z',
    },
  });
  assert.equal(createdTask.status, 201);
  taskId = createdTask.data.task.id;
  assert.equal(createdTask.data.task.priority, 'high');
  assert.equal(createdTask.data.task.description, 'Task details');

  const importedTasks = await request('/tasks/import-local', {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: {
      tasks: [{
        id: `legacy_${suffix}`,
        text: 'Task from browser storage',
        completed: true,
      }],
    },
  });
  assert.equal(importedTasks.status, 200);
  assert.equal(importedTasks.data.importedCount, 1);
  const repeatedImport = await request('/tasks/import-local', {
    method: 'POST',
    cookie: firstAccount.cookie,
    body: {
      tasks: [{
        id: `legacy_${suffix}`,
        text: 'Task from browser storage',
        completed: true,
      }],
    },
  });
  assert.equal(repeatedImport.data.importedCount, 1);

  const secondUsersTasks = await request('/tasks', { cookie: secondAccount.cookie });
  assert.equal(secondUsersTasks.status, 200);
  assert.deepEqual(
    secondUsersTasks.data.tasks.map((task) => task.id).sort(),
    [assignedTaskFromTaskApi.data.task.id, sharedTaskId, ...secondMemberProjectTaskIds].sort(),
  );
  const adminProjects = await request('/projects', { cookie: adminAccount.cookie });
  assert.equal(adminProjects.status, 200);
  assert.ok(adminProjects.data.projects.some((project) => project.id === memberAlphaProject.id));
  const adminDeletesProject = await request(`/projects/${memberAlphaProject.id}`, {
    method: 'DELETE',
    cookie: adminAccount.cookie,
  });
  assert.equal(adminDeletesProject.status, 204);
  const memberCannotAssignPersonalTasks = await request('/tasks', {
    method: 'POST',
    cookie: secondAccount.cookie,
    body: { title: 'Unauthorized personal assignment', assignedTo: thirdAccount.data.user.id },
  });
  assert.equal(memberCannotAssignPersonalTasks.status, 403);

  const crossAccountUpdate = await request(`/tasks/${taskId}`, {
    method: 'PATCH',
    cookie: secondAccount.cookie,
    body: { title: 'Unauthorized update' },
  });
  assert.equal(crossAccountUpdate.status, 404);

  const taskList = await request('/tasks', { cookie: firstAccount.cookie });
  assert.equal(taskList.data.tasks.length, 2);
  assert.ok(taskList.data.tasks.some((task) => task.title === 'Owned task'));
  assert.ok(taskList.data.tasks.some((task) => task.title === 'Task from browser storage'));

  const completedTask = await request(`/tasks/${taskId}`, {
    method: 'PATCH',
    cookie: firstAccount.cookie,
    body: { completed: true },
  });
  assert.equal(completedTask.status, 200);
  assert.equal(completedTask.data.task.completed, true);
  assert.ok(completedTask.data.task.completedAt);
  assert.ok(Math.abs(Date.now() - new Date(completedTask.data.task.completedAt).getTime()) < 10_000);

  const completedTaskEdit = await request(`/tasks/${taskId}`, {
    method: 'PATCH',
    cookie: firstAccount.cookie,
    body: { title: 'Cannot edit completed task' },
  });
  assert.equal(completedTaskEdit.status, 409);

  const reopenedTask = await request(`/tasks/${taskId}`, {
    method: 'PATCH',
    cookie: firstAccount.cookie,
    body: { completed: false },
  });
  assert.equal(reopenedTask.data.task.completed, false);
  assert.equal(reopenedTask.data.task.completedAt, null);

  const completedAgain = await request(`/tasks/${taskId}`, {
    method: 'PATCH',
    cookie: firstAccount.cookie,
    body: { completed: true },
  });
  assert.equal(completedAgain.data.task.completed, true);
  assert.ok(completedAgain.data.task.completedAt);

  const crossAccountDelete = await request(`/tasks/${taskId}`, {
    method: 'DELETE',
    cookie: secondAccount.cookie,
  });
  assert.equal(crossAccountDelete.status, 404);

  const deletedTask = await request(`/tasks/${taskId}`, {
    method: 'DELETE',
    cookie: firstAccount.cookie,
  });
  assert.equal(deletedTask.status, 204);

  const clearedTasks = await request('/tasks/completed', {
    method: 'DELETE',
    cookie: firstAccount.cookie,
  });
  assert.equal(clearedTasks.status, 200);
  assert.equal(clearedTasks.data.deletedCount, 1);

  const loggedOut = await request('/auth/logout', {
    method: 'POST',
    cookie: firstAccount.cookie,
  });
  assert.equal(loggedOut.status, 204);
  const loggedOutSession = await ActivitySession.findById(trackedSessionId);
  assert.ok(loggedOutSession.endedAt);
  assert.equal(loggedOutSession.endReason, 'logout');
  assert.ok(await ActivityEvent.exists({ session: trackedSessionId, kind: 'logout' }));

  console.log('API smoke test passed: auth, project Excel preview/assignment/publication/deletion, retired User Story endpoint, activity, shared-task access, contributions, chat, submissions, review, and legacy task flows.');
} finally {
  if (createdDraftIds.length) {
    await ProjectImportDraft.deleteMany({ _id: { $in: createdDraftIds } });
  }
  if (createdProjectIds.length) {
    await Project.deleteMany({ _id: { $in: createdProjectIds } });
  }
  if (createdTaskIds.length) {
    await Notification.deleteMany({ task: { $in: createdTaskIds } });
    await TaskHistory.deleteMany({ task: { $in: createdTaskIds } });
    await TaskResponse.deleteMany({ task: { $in: createdTaskIds } });
    await Task.deleteMany({ _id: { $in: createdTaskIds } });
  }
  if (createdMeetingIds.length || createdMeetingRoomIds.length) {
    await Notification.deleteMany({
      $or: [
        { meeting: { $in: createdMeetingIds } },
        { room: { $in: createdMeetingRoomIds } },
      ],
    });
    await Meeting.deleteMany({ _id: { $in: createdMeetingIds } });
    await MeetingRoom.deleteMany({ _id: { $in: createdMeetingRoomIds } });
  }
  if (createdTeamIds.length) {
    await TeamNotification.deleteMany({ team: { $in: createdTeamIds } });
    const teamTasks = await TeamTask.find({ team: { $in: createdTeamIds } }).select('_id');
    const teamTaskIds = teamTasks.map((task) => task._id);
    await TaskHistory.deleteMany({ task: { $in: teamTaskIds } });
    await TaskResponse.deleteMany({ task: { $in: teamTaskIds } });
    await TeamTask.deleteMany({ team: { $in: createdTeamIds } });
    await Team.deleteMany({ _id: { $in: createdTeamIds } });
  }
  if (createdDepartmentIds.length) {
    await Department.deleteMany({ _id: { $in: createdDepartmentIds } });
  }
  if (createdUserIds.length) {
    await ActivityEvent.deleteMany({ user: { $in: createdUserIds } });
    await ActivitySession.deleteMany({ user: { $in: createdUserIds } });
    await ActivityState.deleteMany({ user: { $in: createdUserIds } });
    await AuditLog.deleteMany({ actor: { $in: createdUserIds } });
    await Task.deleteMany({ user: { $in: createdUserIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
  }
  if (mongoose.connection.readyState) await mongoose.disconnect();
}
