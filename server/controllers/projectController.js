import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import {
  Department,
  Project,
  ProjectImportDraft,
  Task,
  User,
  serializeTask,
} from '../models.js';
import { createNotification, logTaskHistory } from '../utils/notify.js';
import { recordAuditEvent } from '../utils/audit.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TASKS = 200;
const REQUIRED_COLUMNS = ['project name', 'task title', 'priority'];
const COLUMNS = [
  'project name',
  'project description',
  'task title',
  'task description',
  'priority',
  'start date',
  'due date',
];
const PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cellText(value) {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (value.formula || value.sharedFormula) return '';
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('').trim();
    if ('text' in value) return String(value.text ?? '').trim();
    if ('result' in value) return String(value.result ?? '').trim();
  }
  return String(value).trim();
}

function parseDate(value) {
  if (!value) return { value: null };
  const text = cellText(value);
  let parts;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) {
    parts = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (!match) return { error: 'Use an Excel date, YYYY-MM-DD, or MM/DD/YYYY.' };
    parts = [Number(match[3]), Number(match[1]), Number(match[2])];
  }
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { error: 'Enter a valid calendar date.' };
  }
  return { value: date };
}

async function getLeaderDepartment(user) {
  if (user.role !== 'team_leader') return null;
  return Department.findOne({ teamLeader: user._id }).select('_id name');
}

function groupKey(projectName) {
  return createHash('sha256').update(projectName.trim().toLowerCase()).digest('hex').slice(0, 24);
}

function validateRows(rows) {
  const errors = [];
  const projects = new Map();
  const tasks = [];
  const seenTasks = new Map();
  const normalizedRows = [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { projects: [], tasks: [], rows: [], errors: [{ row: 0, column: 'Workbook', message: 'Add at least one task row.' }] };
  }
  if (rows.length > MAX_TASKS) {
    errors.push({ row: 0, column: 'Workbook', message: `A workbook may contain no more than ${MAX_TASKS} task rows.` });
  }

  for (const input of rows.slice(0, MAX_TASKS)) {
    const row = {
      rowNumber: Number(input?.rowNumber),
      projectName: String(input?.projectName ?? '').trim(),
      projectDescription: String(input?.projectDescription ?? '').trim(),
      title: String(input?.title ?? '').trim(),
      description: String(input?.description ?? '').trim(),
      priority: String(input?.priority ?? '').trim().toLowerCase(),
      startDate: String(input?.startDate ?? '').trim(),
      dueDate: String(input?.dueDate ?? '').trim(),
      formulaFields: Array.isArray(input?.formulaFields) ? input.formulaFields : [],
    };
    normalizedRows.push(row);
    const rowNumber = Number.isInteger(row.rowNumber) ? row.rowNumber : 0;
    const hasContent = COLUMNS.some((column) => {
      const key = ({
        'project name': 'projectName',
        'project description': 'projectDescription',
        'task title': 'title',
        'task description': 'description',
        priority: 'priority',
        'start date': 'startDate',
        'due date': 'dueDate',
      })[column];
      return row[key] !== '';
    });
    if (!hasContent) {
      errors.push({ row: rowNumber, column: 'Row', message: 'This row is empty. Remove it or enter task details.' });
      continue;
    }
    for (const field of row.formulaFields) {
      errors.push({ row: rowNumber, column: field, message: 'Replace the formula with a fixed value; spreadsheet formulas are not imported.' });
    }
    if (!row.projectName) errors.push({ row: rowNumber, column: 'Project Name', message: 'Project Name is required.' });
    if (!row.title) errors.push({ row: rowNumber, column: 'Task Title', message: 'Task Title is required.' });
    if (!PRIORITIES.has(row.priority)) {
      errors.push({ row: rowNumber, column: 'Priority', message: 'Priority must be High, Medium, Low, or Critical.' });
    }
    if (row.projectName.length > 120) errors.push({ row: rowNumber, column: 'Project Name', message: 'Project Name must be 120 characters or fewer.' });
    if (row.projectDescription.length > 2000) errors.push({ row: rowNumber, column: 'Project Description', message: 'Project Description must be 2,000 characters or fewer.' });
    if (row.title.length > 120) errors.push({ row: rowNumber, column: 'Task Title', message: 'Task Title must be 120 characters or fewer.' });
    if (row.description.length > 2000) errors.push({ row: rowNumber, column: 'Task Description', message: 'Task Description must be 2,000 characters or fewer.' });

    const start = parseDate(row.startDate);
    const due = parseDate(row.dueDate);
    if (start.error) errors.push({ row: rowNumber, column: 'Start Date', message: start.error });
    if (due.error) errors.push({ row: rowNumber, column: 'Due Date', message: due.error });
    if (start.value && due.value && due.value < start.value) {
      errors.push({ row: rowNumber, column: 'Due Date', message: 'Due Date cannot be earlier than Start Date.' });
    }

    const normalizedName = row.projectName.toLowerCase();
    let key = '';
    if (row.projectName) {
      key = groupKey(row.projectName);
      const prior = projects.get(key);
      if (prior && prior.description !== row.projectDescription) {
        errors.push({ row: rowNumber, column: 'Project Description', message: 'Rows with the same project name must use the same description.' });
      } else if (!prior) {
        projects.set(key, { key, name: row.projectName, description: row.projectDescription });
      }
    }
    const rowFingerprint = JSON.stringify([
      normalizedName,
      row.projectDescription.toLowerCase(),
      row.title.toLowerCase(),
      row.description.toLowerCase(),
      row.priority,
      start.value?.toISOString() || row.startDate,
      due.value?.toISOString() || row.dueDate,
    ]);
    if (seenTasks.has(rowFingerprint)) {
      errors.push({
        row: rowNumber,
        column: 'Task',
        message: `Duplicate task row (matches row ${seenTasks.get(rowFingerprint)}). Remove the duplicate or change its details.`,
      });
    } else {
      seenTasks.set(rowFingerprint, rowNumber);
    }
    if (!row.formulaFields.length && row.projectName && row.title && PRIORITIES.has(row.priority)
      && !start.error && !due.error && row.projectName.length <= 120 && row.title.length <= 120
      && row.description.length <= 2000 && row.projectDescription.length <= 2000
      && !(start.value && due.value && due.value < start.value)) {
      tasks.push({
        rowNumber,
        projectKey: key,
        title: row.title,
        description: row.description,
        priority: row.priority,
        startDate: start.value,
        dueDate: due.value,
      });
    }
  }
  const projectsWithTasks = [...projects.values()].filter((project) => tasks.some((task) => task.projectKey === project.key));
  return { projects: projectsWithTasks, tasks, rows: normalizedRows, errors };
}

function taskProgress(task) {
  if (task.status === 'completed') return 100;
  const contributions = task.contributions || [];
  if (!contributions.length) return 0;
  return Math.round(contributions.reduce((sum, item) => sum + Number(item.progress || 0), 0) / contributions.length);
}

function projectStatus(tasks) {
  if (tasks.length && tasks.every((task) => task.status === 'completed')) return 'Completed';
  if (tasks.some((task) => taskProgress(task) > 0 || ['in_progress', 'submitted_review', 'completed'].includes(task.status))) {
    return 'In Progress';
  }
  return 'Published';
}

function serializeProject(project, tasks, status = projectStatus(tasks)) {
  const serializedTasks = tasks.map(serializeTask);
  const members = new Map();
  for (const task of tasks) {
    for (const assignee of task.assignees || []) {
      if (assignee?._id) {
        members.set(assignee._id.toString(), {
          id: assignee._id.toString(),
          name: assignee.name || '',
          username: assignee.username || '',
          profileImage: assignee.profileImage || null,
          department: assignee.department?.name || '',
        });
      }
    }
  }
  return {
    id: project._id?.toString() || project.id,
    draftId: project.draftId || null,
    key: project.key || null,
    name: project.name,
    description: project.description || '',
    department: project.department?.name || project.department || '',
    sourceName: project.sourceName || '',
    importedAt: project.importedAt || null,
    status,
    taskCount: tasks.length,
    overallProgress: tasks.length
      ? Math.round(tasks.reduce((sum, task) => sum + taskProgress(task), 0) / tasks.length)
      : 0,
    members: [...members.values()],
    tasks: serializedTasks,
  };
}

export async function getImportMembers(request, response, next) {
  try {
    const department = await getLeaderDepartment(request.user);
    if (!department) {
      response.status(403).json({ error: 'You must lead a department to import a project.' });
      return;
    }
    const members = await User.find({
      department: department._id,
      role: 'team_member',
      isActive: { $ne: false },
    }).select('_id name username email profileImage department').populate('department', 'name').sort({ name: 1 });
    response.json({
      members: members.map((member) => ({
        id: member._id.toString(),
        name: member.name,
        username: member.username,
        email: member.email || '',
        profileImage: member.profileImage || null,
        department: member.department?.name || '',
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function previewProjectImport(request, response, next) {
  try {
    const department = await getLeaderDepartment(request.user);
    if (!department) {
      response.status(403).json({ error: 'You must lead a department to import a project.' });
      return;
    }
    const { fileName, fileData } = request.body || {};
    if (typeof fileName !== 'string' || !/\.xlsx$/i.test(fileName) || typeof fileData !== 'string') {
      response.status(400).json({ error: 'Upload a valid .xlsx workbook.' });
      return;
    }
    const base64 = fileData.replace(/^data:.*?;base64,/, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 4) {
      response.status(400).json({ error: 'The workbook must be no larger than 5 MB.' });
      return;
    }
    const file = Buffer.from(base64, 'base64');
    if (!file.length || file.length > MAX_FILE_BYTES) {
      response.status(400).json({ error: 'The workbook must be no larger than 5 MB.' });
      return;
    }
    if (file[0] !== 0x50 || file[1] !== 0x4b) {
      response.status(400).json({ error: 'The uploaded file is not a valid .xlsx workbook.' });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file, { ignoreNodes: ['extLst'] });
    } catch {
      response.status(400).json({ error: 'The workbook could not be read. Check that it is a valid .xlsx file.' });
      return;
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      response.status(400).json({ error: 'The workbook must contain a worksheet.' });
      return;
    }
    if (sheet.actualRowCount > MAX_TASKS + 1 || sheet.columnCount > 100) {
      response.status(400).json({ error: `The first worksheet may contain no more than ${MAX_TASKS} tasks and 100 columns.` });
      return;
    }

    const headerColumns = new Map();
    sheet.getRow(1).eachCell((cell, columnNumber) => {
      const normalized = normalizeHeader(cellText(cell.value));
      if (normalized) headerColumns.set(normalized, columnNumber);
    });
    const missing = REQUIRED_COLUMNS.filter((column) => !headerColumns.has(column));
    if (missing.length) {
      response.status(400).json({ error: `Missing required columns: ${missing.join(', ')}.` });
      return;
    }

    const rows = [];
    let dataSeenAfterBlank = false;
    for (let rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
      const sheetRow = sheet.getRow(rowNumber);
      const values = Object.fromEntries(COLUMNS.map((column) => [
        column,
        headerColumns.has(column) ? sheetRow.getCell(headerColumns.get(column)).value : '',
      ]));
      const formulaFields = [];
      for (const column of COLUMNS) {
        const value = values[column];
        if (value && typeof value === 'object' && (value.formula || value.sharedFormula)) {
          formulaFields.push(column);
        }
      }
      const isBlank = COLUMNS.every((column) => cellText(values[column]) === '' && !formulaFields.includes(column));
      if (isBlank && !dataSeenAfterBlank) continue;
      if (!isBlank) dataSeenAfterBlank = true;
      rows.push({
        rowNumber,
        projectName: cellText(values['project name']),
        projectDescription: cellText(values['project description']),
        title: cellText(values['task title']),
        description: cellText(values['task description']),
        priority: cellText(values.priority),
        startDate: cellText(values['start date']),
        dueDate: cellText(values['due date']),
        formulaFields,
      });
    }
    if (!rows.length) {
      response.status(400).json({ error: 'Add at least one task below the header row.' });
      return;
    }

    const sourceHash = createHash('sha256').update(file).digest('hex');
    if (await Project.exists({ department: department._id, sourceHash })) {
      response.status(409).json({ error: 'This workbook has already been published for your department.' });
      return;
    }
    let draft = await ProjectImportDraft.findOne({
      owner: request.user._id,
      department: department._id,
      importHash: sourceHash,
      expiresAt: { $gt: new Date() },
    });
    const validation = validateRows(rows);
    if (draft) {
      draft.rows = validation.rows;
      draft.projects = validation.projects;
      draft.tasks = validation.tasks;
      draft.validationErrors = validation.errors;
      draft.assignments = [];
      await draft.save();
    } else {
      const otherDraft = await ProjectImportDraft.exists({
        department: department._id,
        importHash: sourceHash,
        expiresAt: { $gt: new Date() },
      });
      if (otherDraft) {
        response.status(409).json({ error: 'This workbook already has an active import draft in your department.' });
        return;
      }
      draft = await ProjectImportDraft.create({
        owner: request.user._id,
        department: department._id,
        projects: validation.projects,
        rows: validation.rows,
        tasks: validation.tasks,
        assignments: [],
        validationErrors: validation.errors,
        importHash: sourceHash,
        sourceName: fileName.replace(/[\\/]/g, '_').slice(-255),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }
    response.json({
      draftId: draft._id.toString(),
      projects: draft.projects,
      rows: draft.rows,
      tasks: draft.tasks,
      sourceName: draft.sourceName,
      validationErrors: draft.validationErrors,
      expiresAt: draft.expiresAt,
    });
  } catch (error) {
    next(error);
  }
}

async function getOwnedDraft(request) {
  const department = await getLeaderDepartment(request.user);
  if (!department) return null;
  return ProjectImportDraft.findOne({
    _id: request.params.draftId,
    owner: request.user._id,
    department: department._id,
    expiresAt: { $gt: new Date() },
  }).populate('assignments.members.user', 'name username email profileImage department');
}

export async function getProjectImportDraft(request, response, next) {
  try {
    const draft = await getOwnedDraft(request);
    if (!draft) {
      response.status(404).json({ error: 'Import draft not found or expired.' });
      return;
    }
    response.json({
      draftId: draft._id.toString(),
      projects: draft.projects,
      rows: draft.rows,
      tasks: draft.tasks,
      sourceName: draft.sourceName,
      validationErrors: draft.validationErrors,
      assignments: draft.assignments.map((assignment) => ({
        rowNumber: assignment.rowNumber,
        members: assignment.members.map((item) => ({
          memberId: item.user._id.toString(),
          name: item.user.name,
          profileImage: item.user.profileImage || null,
          responsibility: item.responsibility,
          description: item.description,
        })),
      })),
      expiresAt: draft.expiresAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function saveProjectImportRows(request, response, next) {
  try {
    const draft = await getOwnedDraft(request);
    if (!draft) {
      response.status(404).json({ error: 'Import draft not found or expired.' });
      return;
    }
    const { rows } = request.body || {};
    if (!Array.isArray(rows) || !rows.length || rows.length > MAX_TASKS
      || rows.some((row) => !Number.isInteger(row?.rowNumber) || !draft.rows.some((saved) => saved.rowNumber === row.rowNumber))
      || new Set(rows.map((row) => row.rowNumber)).size !== rows.length) {
      response.status(400).json({ error: 'The corrected preview rows are invalid.' });
      return;
    }
    const validation = validateRows(rows);
    draft.rows = validation.rows;
    draft.projects = validation.projects;
    draft.tasks = validation.tasks;
    draft.validationErrors = validation.errors;
    draft.assignments = [];
    await draft.save();
    response.json({
      projects: draft.projects,
      rows: draft.rows,
      tasks: draft.tasks,
      validationErrors: draft.validationErrors,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelProjectImportDraft(request, response, next) {
  try {
    const draft = request.user.role === 'admin'
      ? await ProjectImportDraft.findOne({
        _id: request.params.draftId,
        expiresAt: { $gt: new Date() },
      })
      : await getOwnedDraft(request);
    if (!draft) {
      response.status(404).json({ error: 'Import draft not found or expired.' });
      return;
    }
    await ProjectImportDraft.deleteOne({
      _id: draft._id,
      ...(request.user.role === 'admin' ? {} : { owner: request.user._id }),
    });
    await recordAuditEvent({
      actor: request.user,
      action: 'project.import_draft_deleted',
      resourceType: 'project_import_draft',
      resourceId: draft._id,
      summary: `Deleted project import draft "${draft.sourceName}".`,
    });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function saveProjectImportAssignments(request, response, next) {
  try {
    const draft = await getOwnedDraft(request);
    if (!draft) {
      response.status(404).json({ error: 'Import draft not found or expired.' });
      return;
    }
    if (draft.validationErrors.some((item) => item.row !== 0)) {
      response.status(422).json({ error: 'Correct all spreadsheet errors before assigning tasks.', validationErrors: draft.validationErrors });
      return;
    }
    const { assignments } = request.body || {};
    if (!Array.isArray(assignments) || assignments.length > draft.tasks.length) {
      response.status(400).json({ error: 'Task assignment data is invalid.' });
      return;
    }
    const taskRows = new Set(draft.tasks.map((task) => task.rowNumber));
    const assignmentRows = new Set();
    const selectedIds = new Set();
    for (const item of assignments) {
      if (!Number.isInteger(item?.rowNumber) || !taskRows.has(item.rowNumber) || assignmentRows.has(item.rowNumber)
        || !Array.isArray(item.members) || item.members.length > 20) {
        response.status(400).json({ error: 'Check each task’s selected member assignments.' });
        return;
      }
      assignmentRows.add(item.rowNumber);
      for (const member of item.members) {
        if (!mongoose.isValidObjectId(member.memberId)
          || selectedIds.has(`${item.rowNumber}:${member.memberId}`)
          || typeof member.responsibility !== 'string'
          || member.responsibility.length > 300
          || typeof (member.description || '') !== 'string'
          || (member.description || '').length > 2000) {
          response.status(400).json({ error: 'Selected member IDs or responsibility details are invalid.' });
          return;
        }
        selectedIds.add(`${item.rowNumber}:${member.memberId}`);
      }
    }
    const department = await getLeaderDepartment(request.user);
    const uniqueMemberIds = [...new Set(assignments.flatMap((item) => item.members.map((member) => member.memberId)))];
    const members = await User.find({
      _id: { $in: uniqueMemberIds },
      department: department._id,
      role: 'team_member',
      isActive: { $ne: false },
    }).select('_id');
    if (members.length !== uniqueMemberIds.length) {
      response.status(403).json({ error: 'One or more selected members are not active members of your department.' });
      return;
    }
    draft.assignments = assignments.map((item) => ({
      rowNumber: item.rowNumber,
      members: item.members.map((member) => ({
        user: member.memberId,
        responsibility: member.responsibility.trim(),
        description: (member.description || '').trim(),
      })),
    }));
    await draft.save();
    response.json({ message: 'Draft assignments saved.' });
  } catch (error) {
    next(error);
  }
}

export async function publishProjectImport(request, response, next) {
  let createdProjects = [];
  let createdTaskIds = [];
  try {
    const draft = await getOwnedDraft(request);
    if (!draft) {
      response.status(404).json({ error: 'Import draft not found or expired.' });
      return;
    }
    if (draft.validationErrors.length) {
      response.status(422).json({ error: 'Correct all spreadsheet errors before publishing.', validationErrors: draft.validationErrors });
      return;
    }
    if (!draft.tasks.length || draft.projects.length === 0
      || draft.tasks.some((task) => !draft.assignments.some((assignment) => (
        assignment.rowNumber === task.rowNumber && assignment.members.length > 0
      )))) {
      response.status(400).json({ error: 'Assign at least one eligible member to every task before publishing.' });
      return;
    }
    const department = await getLeaderDepartment(request.user);
    if (await Project.exists({ department: department._id, sourceHash: draft.importHash })) {
      response.status(409).json({ error: 'This workbook has already been published for your department.' });
      return;
    }

    const memberIds = [...new Set(draft.assignments.flatMap((item) => item.members.map((member) => (
      (member.user?._id || member.user).toString()
    ))))];
    const eligible = await User.find({
      _id: { $in: memberIds },
      department: department._id,
      role: 'team_member',
      isActive: { $ne: false },
    }).select('_id name username email profileImage');
    const memberById = new Map(eligible.map((member) => [member._id.toString(), member]));
    if (memberById.size !== memberIds.length) {
      response.status(403).json({ error: 'Selected team membership changed. Reassign tasks and try again.' });
      return;
    }

    for (const group of draft.projects) {
      const projectHash = createHash('sha256').update(`${draft.importHash}:${group.key}`).digest('hex');
      const project = await Project.create({
        name: group.name,
        description: group.description,
        department: department._id,
        status: 'staging',
        importedBy: request.user._id,
        importedAt: null,
        importHash: projectHash,
        sourceHash: draft.importHash,
        sourceName: draft.sourceName,
      });
      createdProjects.push(project);
    }
    const projectsByKey = new Map(createdProjects.map((project) => [
      groupKey(project.name),
      project,
    ]));
    const assignmentByRow = new Map(draft.assignments.map((item) => [item.rowNumber, item]));
    for (const taskRow of draft.tasks) {
      const project = projectsByKey.get(taskRow.projectKey);
      const assignment = assignmentByRow.get(taskRow.rowNumber);
      if (!project || !assignment?.members.length) throw new Error('A project task is missing its project or assignment.');
      const assignees = assignment.members;
      const assigneeIds = assignees.map((item) => item.user?._id || item.user);
      const createdTask = await Task.create({
        title: taskRow.title,
        description: taskRow.description,
        category: 'Project',
        priority: taskRow.priority,
        startDate: taskRow.startDate,
        dueDate: taskRow.dueDate,
        assignedBy: request.user._id,
        assignee: assigneeIds[0],
        assignees: assigneeIds,
        user: assigneeIds[0],
        department: department._id,
        project: project._id,
        projectPublished: false,
        acknowledgmentStatus: 'pending',
        status: 'assigned',
        collaborationEnabled: assignees.length > 1,
        contributions: assignees.map((item, index) => ({
          user: assigneeIds[index],
          responsibility: item.responsibility,
          description: item.description,
          status: 'todo',
          progress: 0,
          startDate: taskRow.startDate,
          dueDate: taskRow.dueDate,
        })),
      });
      createdTaskIds.push(createdTask._id);
    }

    await Project.updateMany({ _id: { $in: createdProjects.map((item) => item._id) } }, {
      $set: { status: 'published', importedAt: new Date() },
    });
    await Task.updateMany({ _id: { $in: createdTaskIds } }, { $set: { projectPublished: true } });
    await recordAuditEvent({
      actor: request.user,
      action: 'project.imported',
      resourceType: 'project',
      resourceId: createdProjects[0]._id,
      summary: `Imported ${createdProjects.length} project${createdProjects.length === 1 ? '' : 's'} and ${createdTaskIds.length} tasks from "${draft.sourceName}".`,
    });

    await Promise.all(draft.tasks.flatMap((taskRow, taskIndex) => {
      const taskId = createdTaskIds[taskIndex];
      const project = projectsByKey.get(taskRow.projectKey);
      const assignment = assignmentByRow.get(taskRow.rowNumber);
      const memberNames = assignment.members.map((item) => {
        const id = (item.user?._id || item.user).toString();
        return memberById.get(id).name;
      });
      return [
        logTaskHistory({
          taskId,
          changedBy: request.user._id,
          oldStatus: '',
          newStatus: 'assigned',
          comment: `Imported in project "${project.name}" and assigned to ${memberNames.join(', ')}.`,
        }),
        ...assignment.members.map((item) => createNotification({
          recipientId: item.user?._id || item.user,
          taskId,
          title: 'New Project Task Assigned',
          message: `${request.user.name} assigned you a task in project "${project.name}": "${taskRow.title}".`,
        })),
      ];
    }));

    const publishedIds = createdProjects.map((project) => project._id);
    const resultProjects = await Project.find({ _id: { $in: publishedIds } })
      .populate('department', 'name')
      .sort({ name: 1 });
    const result = await Promise.all(resultProjects.map(async (project) => {
      const tasks = await Task.find({ project: project._id, projectPublished: true, deletedAt: null })
        .populate('assignee', 'name username email profileImage')
        .populate('assignees', 'name username email profileImage department')
        .populate('contributions.user', 'name username email')
        .populate('assignedBy', 'name username email')
        .populate('department', 'name')
        .populate('project', 'name description')
        .sort({ createdAt: 1 });
      return serializeProject(project, tasks);
    }));
    await ProjectImportDraft.deleteOne({ _id: draft._id });
    response.status(201).json({ projects: result });
  } catch (error) {
    if (createdProjects.length) {
      try {
        await Project.updateMany({ _id: { $in: createdProjects.map((project) => project._id) } }, { $set: { status: 'staging' } });
        if (createdTaskIds.length) await Task.deleteMany({ _id: { $in: createdTaskIds } });
        await Project.deleteMany({ _id: { $in: createdProjects.map((project) => project._id) } });
      } catch (cleanupError) {
        console.error('Failed to clean up an incomplete project import:', cleanupError);
      }
    }
    next(error);
  }
}

export async function listProjects(request, response, next) {
  try {
    let departmentIds;
    if (request.user.role === 'admin') {
      departmentIds = undefined;
    } else if (request.user.role === 'team_leader') {
      const department = await getLeaderDepartment(request.user);
      if (!department) {
        response.json({ projects: [] });
        return;
      }
      departmentIds = [department._id];
    } else if (request.user.role === 'team_member') {
      departmentIds = request.user.department ? [request.user.department._id || request.user.department] : [];
    } else {
      response.status(403).json({ error: 'You are not authorized to view projects.' });
      return;
    }
    const filter = {
      status: 'published',
      ...(departmentIds ? { department: { $in: departmentIds } } : {}),
    };
    const publishedProjects = await Project.find(filter).populate('department', 'name').sort({ importedAt: -1 });
    const serialized = await Promise.all(publishedProjects.map(async (project) => {
      const taskFilter = { project: project._id, projectPublished: true, deletedAt: null };
      if (request.user.role === 'team_member') {
        taskFilter.$or = [
          { assignee: request.user._id },
          { user: request.user._id },
          { assignees: request.user._id },
        ];
      }
      const tasks = await Task.find(taskFilter)
        .populate('assignee', 'name username email profileImage')
        .populate('assignees', 'name username email profileImage department')
        .populate('contributions.user', 'name username email')
        .populate('department', 'name')
        .populate('project', 'name description')
        .sort({ createdAt: 1 });
      return serializeProject(project, tasks);
    }));

    if (request.user.role === 'team_leader') {
      const department = await getLeaderDepartment(request.user);
      const drafts = await ProjectImportDraft.find({
        owner: request.user._id,
        department: department._id,
        expiresAt: { $gt: new Date() },
      }).populate('assignments.members.user', 'name username email profileImage department');
      for (const draft of drafts) {
        for (const group of draft.projects) {
          const tasks = draft.tasks.filter((task) => task.projectKey === group.key).map((task) => {
            const assignment = draft.assignments.find((item) => item.rowNumber === task.rowNumber);
            const assignees = (assignment?.members || []).map((item) => item.user).filter(Boolean);
            return {
              id: `draft-${draft._id}-${task.rowNumber}`,
              title: task.title,
              description: task.description,
              priority: task.priority,
              startDate: task.startDate,
              dueDate: task.dueDate,
              status: 'draft',
              progress: 0,
              assignees: assignees.map((member) => ({
                _id: member._id,
                name: member.name,
                username: member.username,
                email: member.email,
                profileImage: member.profileImage,
                department: member.department,
              })),
              contributions: [],
            };
          });
          serialized.push(serializeProject({
            id: `${draft._id}-${group.key}`,
            draftId: draft._id.toString(),
            key: group.key,
            name: group.name,
            description: group.description,
            sourceName: draft.sourceName,
            department: department.name,
          }, tasks, 'Draft'));
        }
      }
    }
    response.json({ projects: serialized });
  } catch (error) {
    next(error);
  }
}

export async function getProject(request, response, next) {
  try {
    if (!['admin', 'team_leader', 'team_member'].includes(request.user.role)) {
      response.status(403).json({ error: 'You are not authorized to view projects.' });
      return;
    }
    if (!mongoose.isValidObjectId(request.params.projectId)) {
      response.status(404).json({ error: 'Project not found.' });
      return;
    }
    const project = await Project.findOne({ _id: request.params.projectId, status: 'published' })
      .populate('department', 'name');
    if (!project) {
      response.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (request.user.role !== 'admin') {
      const userDepartment = request.user.role === 'team_leader'
        ? await getLeaderDepartment(request.user)
        : request.user.department;
      const userDepartmentId = userDepartment?._id || userDepartment;
      if (!userDepartmentId || userDepartmentId.toString() !== project.department._id.toString()) {
        response.status(403).json({ error: 'You are not authorized to view this project.' });
        return;
      }
    }

    const filter = { project: project._id, projectPublished: true, deletedAt: null };
    if (request.user.role === 'team_member') {
      filter.$or = [
        { assignee: request.user._id },
        { user: request.user._id },
        { assignees: request.user._id },
      ];
    }
    const tasks = await Task.find(filter)
      .populate('assignee', 'name username email profileImage')
      .populate('assignees', 'name username email profileImage department')
      .populate('contributions.user', 'name username email')
      .populate('department', 'name')
      .populate('project', 'name description')
      .sort({ createdAt: 1 });
    response.json({ project: serializeProject(project, tasks) });
  } catch (error) {
    next(error);
  }
}

export async function deleteProject(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.projectId)) {
      response.status(404).json({ error: 'Project not found.' });
      return;
    }
    const project = await Project.findOne({
      _id: request.params.projectId,
      status: 'published',
    });
    if (!project) {
      response.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (request.user.role === 'team_leader') {
      const department = await getLeaderDepartment(request.user);
      if (!department || department._id.toString() !== project.department.toString()) {
        response.status(403).json({ error: 'You are not authorized to delete this project.' });
        return;
      }
    } else if (request.user.role !== 'admin') {
      response.status(403).json({ error: 'You are not authorized to delete projects.' });
      return;
    }

    await Task.updateMany(
      { project: project._id, deletedAt: null },
      { $set: { deletedAt: new Date(), projectPublished: false } },
    );
    await Project.deleteOne({ _id: project._id, status: 'published' });
    await recordAuditEvent({
      actor: request.user,
      action: 'project.deleted',
      resourceType: 'project',
      resourceId: project._id,
      summary: `Deleted project "${project.name}" and hid its tasks.`,
    });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
}
