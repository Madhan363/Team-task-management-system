import { Buffer } from 'node:buffer';
import mongoose from 'mongoose';
import {
  Department,
  Task,
  TaskHistory,
  TaskResponse,
  User,
  serializeTask,
} from '../models.js';
import { createNotification, logTaskHistory } from '../utils/notify.js';
import { recordAuditEvent } from '../utils/audit.js';

function sameUser(reference, userId) {
  const id = reference?._id || reference;
  return Boolean(id && id.toString() === userId.toString());
}

function hasExpectedFileSignature(mimeType, bytes) {
  if (mimeType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/png') return bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (mimeType === 'image/jpeg') return bytes.subarray(0, 3).toString('hex') === 'ffd8ff';
  if (mimeType === 'text/plain') return !bytes.includes(0);
  return false;
}

async function canAccessTask(task, user) {
  if (user.role === 'admin') return true;
  if ((task.assignees || []).some((assignee) => sameUser(assignee, user._id))) return true;
  if (sameUser(task.assignee, user._id) || sameUser(task.user, user._id)) return true;
  if (user.role !== 'team_leader') return false;
  if (sameUser(task.assignedBy, user._id)) return true;

  const leaderDepartment = await Department.findOne({ teamLeader: user._id }).select('_id');
  const taskDepartmentId = task.department?._id || task.department;
  return Boolean(leaderDepartment && sameUser(taskDepartmentId, leaderDepartment._id));
}

export async function createTask(request, response, next) {
  try {
    const {
      title,
      description = '',
      category = 'General',
      priority = 'medium',
      startDate = null,
      dueDate = null,
      reminderAt = null,
      assignedTo,
      assigneeId,
      assignedMemberIds,
      contributions = [],
      departmentId,
      attachments = [],
    } = request.body || {};

    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanDesc = typeof description === 'string' ? description.trim() : '';
    const cleanCategory = typeof category === 'string' ? category.trim() : 'General';
    const selectedIds = Array.isArray(assignedMemberIds) ? [...new Set(assignedMemberIds.map(String))] : [];
    const targetUserId = selectedIds.length ? selectedIds[0] : (assignedTo || assigneeId);

    if (targetUserId && !['team_leader', 'admin'].includes(request.user.role)) {
      response.status(403).json({ error: 'Only Team Leaders and Admins can assign tasks to other users.' });
      return;
    }

    if (!cleanTitle || cleanTitle.length > 120) {
      response.status(400).json({ error: 'Task title is required and must be 120 characters or fewer.' });
      return;
    }
    if (cleanDesc.length > 2000) {
      response.status(400).json({ error: 'Description must be 2,000 characters or fewer.' });
      return;
    }
    if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
      response.status(400).json({ error: 'Priority must be low, medium, high, or critical.' });
      return;
    }

    const start = startDate ? new Date(startDate) : null;
    const due = dueDate ? new Date(dueDate) : null;
    const reminder = reminderAt ? new Date(reminderAt) : null;
    if (start && Number.isNaN(start.getTime())) {
      response.status(400).json({ error: 'Enter a valid start date.' });
      return;
    }
    if (due && Number.isNaN(due.getTime())) {
      response.status(400).json({ error: 'Enter a valid due date.' });
      return;
    }
    if (start && due && due < start) {
      response.status(400).json({ error: 'Due date must be the same as or later than the start date.' });
      return;
    }

    if (!Array.isArray(attachments) || attachments.length > 5) {
      response.status(400).json({ error: 'Attach no more than five task reference files.' });
      return;
    }
    let parsedAttachments = [];
    let referenceFileBytes = 0;
    for (const attachment of attachments) {
      if (!attachment || typeof attachment.name !== 'string' || typeof attachment.url !== 'string') {
        response.status(400).json({ error: 'Each reference attachment must include a name and URL.' });
        return;
      }
      if (attachment.url.startsWith('data:')) {
        const match = attachment.url.match(/^data:(application\/pdf|image\/png|image\/jpeg|text\/plain);base64,([A-Za-z0-9+/]+=*)$/);
        if (!match) {
          response.status(400).json({ error: 'Reference files must be PDF, PNG, JPEG, or plain text.' });
          return;
        }
        const bytes = Buffer.from(match[2], 'base64');
        referenceFileBytes += bytes.length;
        if (!bytes.length || referenceFileBytes > 1_048_576 || !hasExpectedFileSignature(match[1], bytes)) {
          response.status(400).json({ error: 'Reference files must be valid and total no more than 1 MB.' });
          return;
        }
      } else if (!/^https?:\/\//i.test(attachment.url)) {
        response.status(400).json({ error: 'Reference attachment URLs must use HTTP or HTTPS.' });
        return;
      }
      parsedAttachments.push({
        name: attachment.name.trim().slice(0, 120) || 'reference-file',
        url: attachment.url,
      });
    }

    // Role-based task assignment:
    // If targetUserId is provided, assign to that team member
    if (targetUserId) {
      const assigneeIds = selectedIds.length ? selectedIds : [String(targetUserId)];
      if (assigneeIds.some((id) => !mongoose.isValidObjectId(id)) || (selectedIds.length && selectedIds.length < 2)) {
        response.status(400).json({ error: 'Select at least two distinct team members for a shared task.' });
        return;
      }
      if (!['team_leader', 'admin'].includes(request.user.role)) {
        response.status(403).json({ error: 'Only Team Leaders and Admins can assign tasks to other users.' });
        return;
      }

      const assigneeUsers = await User.find({ _id: { $in: assigneeIds }, isActive: { $ne: false } }).populate('department', 'name');
      if (assigneeUsers.length !== assigneeIds.length || assigneeUsers.some((member) => member.role !== 'team_member')) {
        response.status(400).json({ error: 'Every assignee must be an active Team Member.' });
        return;
      }
      if (new Set(assigneeUsers.map((member) => member._id.toString())).size !== assigneeIds.length) {
        response.status(400).json({ error: 'Select a valid team member to assign this task to.' });
        return;
      }

      // Department enforcement for Team Leaders:
      let deptId = departmentId;
      if (request.user.role === 'team_leader') {
        const leaderDept = await Department.findOne({ teamLeader: request.user._id });
        if (!leaderDept) {
          response.status(403).json({ error: 'You are not assigned as the Team Leader of any active department.' });
          return;
        }
        deptId = leaderDept._id;

        // Verify member belongs to this department
        if (assigneeUsers.some((member) => !member.department || !member.department._id.equals(deptId))) {
          response.status(403).json({
            error: `You can only assign tasks to members in your department (${leaderDept.name}).`,
          });
          return;
        }
      } else if (departmentId && assigneeUsers.some((member) => !member.department?._id.equals(departmentId))) {
        response.status(403).json({ error: 'All assigned members must belong to the selected department.' });
        return;
      }

      const firstAssignee = assigneeUsers[0];
      const shared = assigneeUsers.length > 1;
      const contributionById = new Map((Array.isArray(contributions) ? contributions : [])
        .filter((entry) => entry && mongoose.isValidObjectId(entry.userId))
        .map((entry) => [String(entry.userId), entry]));
      const task = await Task.create({
        title: cleanTitle,
        description: cleanDesc,
        category: cleanCategory,
        priority,
        startDate: start,
        dueDate: due,
        reminderAt: reminder,
        assignedBy: request.user._id,
        assignee: firstAssignee._id,
        assignees: assigneeUsers.map((member) => member._id),
        user: firstAssignee._id,
        department: deptId || firstAssignee.department?._id || null,
        acknowledgmentStatus: 'pending',
        status: 'assigned',
        attachments: parsedAttachments,
        collaborationEnabled: shared,
        contributions: assigneeUsers.map((member) => {
          const input = contributionById.get(member._id.toString()) || {};
          return {
            user: member._id,
            responsibility: typeof input.responsibility === 'string' ? input.responsibility.trim().slice(0, 300) : '',
            description: typeof input.description === 'string' ? input.description.trim().slice(0, 2000) : '',
            status: 'todo',
            progress: 0,
            startDate: start,
            dueDate: due,
          };
        }),
      });

      await task.populate([
        { path: 'assignee', select: 'name username email' },
        { path: 'assignees', select: 'name username email' },
        { path: 'contributions.user', select: 'name username email' },
        { path: 'assignedBy', select: 'name username email' },
        { path: 'department', select: 'name' },
      ]);

      await logTaskHistory({
        taskId: task._id,
        changedBy: request.user._id,
        oldStatus: '',
        newStatus: 'assigned',
        comment: `Task created and assigned to ${assigneeUsers.map((member) => member.name).join(', ')}.`,
      });

      await Promise.all(assigneeUsers.map((member) => createNotification({
        recipientId: member._id,
        taskId: task._id,
        title: shared ? 'New Shared Task Assigned' : 'New Task Assigned',
        message: `${request.user.name} assigned you ${shared ? 'to a shared task' : 'a task'}: "${cleanTitle}".`,
      })));

      await recordAuditEvent({
        actor: request.user,
        action: 'task.created',
        resourceType: 'task',
        resourceId: task._id,
        summary: `Assigned "${task.title}" to ${assigneeUsers.map((member) => member.name).join(', ')}.`,
      });
      response.status(201).json({ task: serializeTask(task) });
      return;
    }

    // Personal / self-assigned task fallback
    const task = await Task.create({
      title: cleanTitle,
      description: cleanDesc,
      category: cleanCategory,
      priority,
      startDate: start,
      dueDate: due,
      reminderAt: reminder,
      user: request.user._id,
      assignee: request.user._id,
      assignedBy: request.user._id,
      department: request.user.department || null,
      acknowledgmentStatus: 'acknowledged',
      status: 'assigned',
      attachments: parsedAttachments,
    });

    await recordAuditEvent({
      actor: request.user,
      action: 'task.created',
      resourceType: 'task',
      resourceId: task._id,
      summary: `Created personal task "${task.title}".`,
    });
    response.status(201).json({ task: serializeTask(task) });
  } catch (error) {
    next(error);
  }
}

export async function getMyTasks(request, response, next) {
  try {
    const { search = '', status = '', priority = '', ack = '' } = request.query;

    const filter = {
      $or: [{ assignee: request.user._id }, { user: request.user._id }, { assignees: request.user._id }],
      deletedAt: null,
      projectPublished: { $ne: false },
    };

    if (search && search.trim()) {
      filter.title = { $regex: search.trim(), $options: 'i' };
    }
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (priority && priority !== 'all') {
      filter.priority = priority;
    }
    if (ack && ack !== 'all') {
      filter.acknowledgmentStatus = ack;
    }

    const tasks = await Task.find(filter)
      .populate('assignedBy', 'name username email role')
      .populate('assignee', 'name username email profileImage')
      .populate('assignees', 'name username email profileImage department')
      .populate('contributions.user', 'name username email')
      .populate('department', 'name')
      .populate('project', 'name description')
      .populate('dependencies', 'title')
      .sort({ createdAt: -1 });

    response.json({ tasks: tasks.map(serializeTask) });
  } catch (error) {
    next(error);
  }
}

export async function getTeamTasks(request, response, next) {
  try {
    const { search = '', status = '', priority = '', member = '' } = request.query;

    let filter = { deletedAt: null, projectPublished: { $ne: false } };

    if (request.user.role === 'team_leader') {
      const leaderDept = await Department.findOne({ teamLeader: request.user._id });
      if (!leaderDept) {
        response.json({ tasks: [] });
        return;
      }
      filter.department = leaderDept._id;
    } else if (request.user.role === 'admin') {
      // Admin sees all or filtered
    } else {
      response.status(403).json({ error: 'Team task tracking is only accessible to Team Leaders and Admins.' });
      return;
    }

    if (member && mongoose.isValidObjectId(member)) {
      filter.$and = [...(filter.$and || []), { $or: [{ assignee: member }, { assignees: member }] }];
    }
    const searchTerm = typeof search === 'string' ? search.trim().slice(0, 100) : '';
    if (searchTerm) {
      const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      const memberFilter = { $or: [{ name: searchRegex }, { username: searchRegex }] };
      if (request.user.role === 'team_leader' && filter.department) {
        memberFilter.department = filter.department;
      }
      const matchingMembers = await User.find(memberFilter).select('_id');
      filter.$and = [...(filter.$and || []), { $or: [
        { title: searchRegex },
        { assignee: { $in: matchingMembers.map((user) => user._id) } },
        { assignees: { $in: matchingMembers.map((user) => user._id) } },
      ] }];
    }
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (priority && priority !== 'all') {
      filter.priority = priority;
    }

    const tasks = await Task.find(filter)
      .populate('assignee', 'name username email profileImage department')
      .populate('assignees', 'name username email profileImage department')
      .populate('contributions.user', 'name username email')
      .populate('assignedBy', 'name username email')
      .populate('department', 'name')
      .populate('project', 'name description')
      .populate('dependencies', 'title')
      .sort({ createdAt: -1 });

    response.json({ tasks: tasks.map(serializeTask) });
  } catch (error) {
    next(error);
  }
}

export async function getTaskById(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    const task = await Task.findOne({ _id: id, projectPublished: { $ne: false } })
      .populate('assignee', 'name username email profileImage department')
      .populate('assignees', 'name username email profileImage department')
      .populate('contributions.user', 'name username email')
      .populate('submissions.submittedBy', 'name username')
      .populate('submissions.acknowledgedBy', 'name username')
      .populate('assignedBy', 'name username email')
      .populate('department', 'name')
      .populate('project', 'name description');

    if (!task || task.deletedAt) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    if (!(await canAccessTask(task, request.user))) {
      response.status(403).json({ error: 'You are not authorized to access this task.' });
      return;
    }
    response.json({
      task: serializeTask(task, { includeSubmissions: true }),
      currentUserId: request.user._id.toString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function acknowledgeTask(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    const task = await Task.findById(id)
      .populate('assignee', 'name username email')
      .populate('assignedBy', 'name username email');

    if (!task || task.deletedAt) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    // Team Member must not acknowledge a task assigned to another user
    const isAssignee = (task.assignee && task.assignee._id.equals(request.user._id))
      || (task.assignees || []).some((member) => sameUser(member, request.user._id))
      || (task.user && task.user.equals(request.user._id));

    if (!isAssignee) {
      response.status(403).json({ error: 'You can only acknowledge tasks assigned to you.' });
      return;
    }

    if (task.acknowledgmentStatus === 'acknowledged') {
      response.json({
        task: serializeTask(task),
        message: 'Task is already acknowledged.',
      });
      return;
    }

    task.acknowledgmentStatus = 'acknowledged';
    task.acknowledgedAt = new Date();
    await task.save();

    // Log in task history
    await logTaskHistory({
      taskId: task._id,
      changedBy: request.user._id,
      oldStatus: 'assigned (pending acknowledgment)',
      newStatus: 'assigned (acknowledged)',
      comment: `${request.user.name} acknowledged receipt of the task.`,
    });

    // Notify assigning Team Leader
    if (task.assignedBy) {
      await createNotification({
        recipientId: task.assignedBy._id || task.assignedBy,
        taskId: task._id,
        title: 'Task Acknowledged',
        message: `${request.user.name} acknowledged task: "${task.title}".`,
      });
    }

    await recordAuditEvent({
      actor: request.user,
      action: 'task.acknowledged',
      resourceType: 'task',
      resourceId: task._id,
      summary: `Acknowledged "${task.title}".`,
    });
    response.json({
      task: serializeTask(task),
      message: 'Task acknowledged successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTaskStatus(request, response, next) {
  try {
    const { id } = request.params;
    const { status, comment = '', attachment } = request.body || {};

    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    const validStatuses = ['assigned', 'in_progress', 'submitted_review', 'completed'];
    if (!validStatuses.includes(status)) {
      response.status(400).json({ error: 'Choose a valid task status.' });
      return;
    }

    const task = await Task.findById(id)
      .populate('assignee', 'name username email')
      .populate('assignedBy', 'name username email');

    if (!task || task.deletedAt) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    const isAssignee = (task.assignee && task.assignee._id.equals(request.user._id))
      || (task.assignees || []).some((member) => sameUser(member, request.user._id))
      || (task.user && task.user.equals(request.user._id));
    const isAdmin = request.user.role === 'admin';
    const isLeader = request.user.role === 'team_leader';

    if (!(await canAccessTask(task, request.user))) {
      response.status(403).json({ error: 'You are not authorized to update this task.' });
      return;
    }

    if (status === 'completed') {
      response.status(403).json({ error: 'Tasks must be completed through the review approval workflow.' });
      return;
    }

    // Permission enforcement:
    // Team Members cannot mark tasks as officially Completed without Team Leader approval
    if (!isAdmin && !isLeader && isAssignee) {
      if (status === 'completed') {
        response.status(403).json({
          error: 'Team Members cannot mark tasks directly as Completed. Please submit the task for review.',
        });
        return;
      }
      if (!['in_progress', 'submitted_review'].includes(status)) {
        response.status(403).json({ error: 'You can update status to In Progress or Submit for Review.' });
        return;
      }
    }

    if (!isAdmin && !isLeader && !isAssignee) {
      response.status(403).json({ error: 'You are not authorized to update this task.' });
      return;
    }
    if (task.collaborationEnabled && !isAdmin && !isLeader && status === 'submitted_review') {
      response.status(400).json({ error: 'Submit the shared task using the team submission form.' });
      return;
    }

    let submittedAttachment = null;
    if (attachment !== undefined) {
      if (status !== 'submitted_review' || !isAssignee || request.user.role !== 'team_member') {
        response.status(400).json({ error: 'A PDF can only be attached when a Team Member submits a task for review.' });
        return;
      }
      if (!attachment || typeof attachment.name !== 'string' || typeof attachment.data !== 'string') {
        response.status(400).json({ error: 'Provide a PDF file to attach to the submission.' });
        return;
      }

      const dataUrlMatch = attachment.data.match(/^data:application\/pdf;base64,([A-Za-z0-9+/]+=*)$/);
      if (!dataUrlMatch) {
        response.status(400).json({ error: 'The deliverable must be a valid PDF file.' });
        return;
      }
      const pdfBytes = Buffer.from(dataUrlMatch[1], 'base64');
      if (pdfBytes.length === 0 || pdfBytes.length > 1_048_576
        || pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
        response.status(400).json({ error: 'PDF files must be valid and 1 MB or smaller.' });
        return;
      }
      submittedAttachment = {
        name: attachment.name.trim().slice(0, 120) || 'deliverable.pdf',
        url: attachment.data,
      };
    }

    const oldStatus = task.status;
    task.status = status;

    if (status === 'in_progress' && !task.startDate) {
      task.startDate = new Date();
    }
    if (status === 'submitted_review') {
      task.submittedAt = new Date();
    }
    if (status === 'completed') {
      task.completedAt = new Date();
      task.completed = true;
    } else {
      task.completed = false;
    }

    await task.save();

    if (submittedAttachment) {
      await TaskResponse.create({
        task: task._id,
        user: request.user._id,
        responseType: 'deliverable',
        message: 'PDF deliverable submitted for Team Leader review.',
        attachments: [submittedAttachment],
      });
    }

    await logTaskHistory({
      taskId: task._id,
      changedBy: request.user._id,
      oldStatus,
      newStatus: status,
      comment: comment ? String(comment).trim() : `Status changed to ${status.replace('_', ' ')}.`,
    });

    await recordAuditEvent({
      actor: request.user,
      action: status === 'submitted_review' ? 'task.submitted' : `task.status.${status}`,
      resourceType: 'task',
      resourceId: task._id,
      summary: `Changed "${task.title}" from ${oldStatus} to ${status}.`,
    });

    // Notify relevant recipient
    if (status === 'submitted_review' && task.assignedBy) {
      await createNotification({
        recipientId: task.assignedBy._id || task.assignedBy,
        taskId: task._id,
        title: 'Task Submitted for Review',
        message: `${request.user.name} submitted task: "${task.title}" for review.`,
      });
    }

    response.json({
      task: serializeTask(task),
      message: `Task updated to ${status.replace('_', ' ')}.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function reviewTask(request, response, next) {
  try {
    const { id } = request.params;
    const { decision, comment = '' } = request.body || {};

    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    if (!['approve', 'changes_requested'].includes(decision)) {
      response.status(400).json({ error: 'Decision must be "approve" or "changes_requested".' });
      return;
    }
    if (typeof comment !== 'string' || comment.trim().length > 2000) {
      response.status(400).json({ error: 'Review comments must be 2,000 characters or fewer.' });
      return;
    }

    // Role check: Team Leader or Admin
    if (request.user.role !== 'team_leader' && request.user.role !== 'admin') {
      response.status(403).json({ error: 'Only Team Leaders and Admins can review tasks.' });
      return;
    }

    const task = await Task.findById(id)
      .populate('assignee', 'name username email')
      .populate('assignedBy', 'name username email')
      .populate('department', 'name');

    if (!task || task.deletedAt) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    // Verify leader is authorized in this department
    if (request.user.role === 'team_leader') {
      const leaderDept = await Department.findOne({ teamLeader: request.user._id });
      if (!leaderDept || !task.department || !task.department._id.equals(leaderDept._id)) {
        if (!task.assignedBy || !task.assignedBy._id.equals(request.user._id)) {
          response.status(403).json({ error: 'You are not authorized to review tasks for this department.' });
          return;
        }
      }
    }

    const oldStatus = task.status;
    const cleanComment = typeof comment === 'string' ? comment.trim() : '';

    if (decision === 'approve') {
      const currentSubmission = task.submissions?.[task.submissions.length - 1];
      if (task.collaborationEnabled && (!currentSubmission || currentSubmission.decision !== 'pending')) {
        response.status(400).json({ error: 'There is no pending team submission to review.' });
        return;
      }
      if (currentSubmission) {
        currentSubmission.decision = 'approved';
        currentSubmission.acknowledgedBy = request.user._id;
        currentSubmission.acknowledgedAt = new Date();
        currentSubmission.reviewComment = cleanComment;
      }
      task.status = 'completed';
      task.completed = true;
      task.completedAt = new Date();
      await task.save();

      await logTaskHistory({
        taskId: task._id,
        changedBy: request.user._id,
        oldStatus,
        newStatus: 'completed',
        comment: cleanComment ? `Approved: ${cleanComment}` : 'Work approved and completed.',
      });

      const recipients = task.assignees?.length ? task.assignees : (task.assignee ? [task.assignee] : []);
      await Promise.all(recipients.map((recipientId) => createNotification({
          recipientId: recipientId._id || recipientId,
          taskId: task._id,
          title: 'Task Approved',
          message: `Your task "${task.title}" was approved by ${request.user.name}.`,
        })));
    } else {
      const currentSubmission = task.submissions?.[task.submissions.length - 1];
      if (task.collaborationEnabled && (!currentSubmission || currentSubmission.decision !== 'pending')) {
        response.status(400).json({ error: 'There is no pending team submission to review.' });
        return;
      }
      if (currentSubmission) {
        currentSubmission.decision = 'changes_requested';
        currentSubmission.acknowledgedBy = request.user._id;
        currentSubmission.acknowledgedAt = new Date();
        currentSubmission.reviewComment = cleanComment;
      }
      // Changes requested: return to in_progress
      task.status = 'in_progress';
      task.completed = false;
      task.completedAt = null;
      await task.save();

      await logTaskHistory({
        taskId: task._id,
        changedBy: request.user._id,
        oldStatus,
        newStatus: 'in_progress',
        comment: cleanComment ? `Changes requested: ${cleanComment}` : 'Changes requested by leader.',
      });

      const recipients = task.assignees?.length ? task.assignees : (task.assignee ? [task.assignee] : []);
      await Promise.all(recipients.map((recipientId) => createNotification({
          recipientId: recipientId._id || recipientId,
          taskId: task._id,
          title: 'Changes Requested on Task',
          message: `${request.user.name} requested changes on "${task.title}": ${cleanComment || 'Please review feedback.'}`,
        })));
    }

    await recordAuditEvent({
      actor: request.user,
      action: decision === 'approve' ? 'task.review.approved' : 'task.review.changes_requested',
      resourceType: 'task',
      resourceId: task._id,
      summary: `${decision === 'approve' ? 'Approved' : 'Requested changes for'} "${task.title}".`,
    });
    response.json({
      task: serializeTask(task),
      message: decision === 'approve' ? 'Task approved and completed.' : 'Changes requested. Task returned to In Progress.',
    });
  } catch (error) {
    next(error);
  }
}

export async function addTaskResponse(request, response, next) {
  try {
    const { id } = request.params;
    const { message, responseType = 'comment' } = request.body || {};

    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    const cleanMessage = typeof message === 'string' ? message.trim() : '';
    if (!cleanMessage || cleanMessage.length > 2000) {
      response.status(400).json({ error: 'Enter a response between 1 and 2,000 characters.' });
      return;
    }

    if (!['comment', 'clarification', 'review', 'deliverable'].includes(responseType)) {
      response.status(400).json({ error: 'Response type must be comment, clarification, review, or deliverable.' });
      return;
    }

    const task = await Task.findById(id);
    if (!task || task.deletedAt) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (!(await canAccessTask(task, request.user))) {
      response.status(403).json({ error: 'You are not authorized to respond to this task.' });
      return;
    }

    const taskResponse = await TaskResponse.create({
      task: task._id,
      user: request.user._id,
      responseType,
      message: cleanMessage,
    });

    await logTaskHistory({
      taskId: task._id,
      changedBy: request.user._id,
      oldStatus: task.status,
      newStatus: task.status,
      comment: `[${responseType.toUpperCase()}] ${cleanMessage}`,
    });

    await recordAuditEvent({
      actor: request.user,
      action: 'task.comment.added',
      resourceType: 'task',
      resourceId: task._id,
      summary: `Added a ${responseType} to "${task.title}".`,
    });

    // Notify counterpart
    const isAssignee = task.assignee && task.assignee.equals(request.user._id);
    const recipientId = isAssignee ? task.assignedBy : task.assignee;
    if (recipientId && !recipientId.equals(request.user._id)) {
      const typeLabel = responseType === 'clarification' ? 'Clarification Request' : 'New Comment';
      await createNotification({
        recipientId,
        taskId: task._id,
        title: `${typeLabel} on Task`,
        message: `${request.user.name} added a ${responseType} on "${task.title}": "${cleanMessage.slice(0, 80)}"`,
      });
    }

    response.status(201).json({
      response: {
        id: taskResponse._id.toString(),
        taskId: task._id.toString(),
        userId: request.user._id.toString(),
        userName: request.user.name,
        userRole: request.user.role,
        responseType,
        message: cleanMessage,
        createdAt: taskResponse.createdAt?.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTaskHistory(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    const task = await Task.findById(id);
    if (!task || task.deletedAt) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (!(await canAccessTask(task, request.user))) {
      response.status(403).json({ error: 'You are not authorized to view this task history.' });
      return;
    }

    const [history, responses] = await Promise.all([
      TaskHistory.find({ task: id })
        .populate('changedBy', 'name username role')
        .sort({ timestamp: -1 }),
      TaskResponse.find({ task: id })
        .populate('user', 'name username role')
        .sort({ createdAt: 1 }),
    ]);

    response.json({
      history: history.map((item) => ({
        id: item._id.toString(),
        changedBy: item.changedBy ? {
          id: item.changedBy._id.toString(),
          name: item.changedBy.name,
          username: item.changedBy.username,
          role: item.changedBy.role,
        } : null,
        oldStatus: item.oldStatus,
        newStatus: item.newStatus,
        comment: item.comment,
        timestamp: item.timestamp?.toISOString() || item.createdAt?.toISOString(),
      })),
      responses: responses.map((r) => ({
        id: r._id.toString(),
        user: r.user ? {
          id: r.user._id.toString(),
          name: r.user.name,
          username: r.user.username,
          role: r.user.role,
        } : null,
        responseType: r.responseType,
        message: r.message,
        attachments: r.attachments || [],
        createdAt: r.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getTaskChat(request, response, next) {
  try {
    const task = await Task.findById(request.params.id)
      .populate('chatMessages.sender', 'name username role');
    if (!task || task.deletedAt) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (!(await canAccessTask(task, request.user))) {
      response.status(403).json({ error: 'You are not authorized to access this task chat.' });
      return;
    }
    if (!task.collaborationEnabled) {
      response.status(400).json({ error: 'Task chat is available only for shared tasks.' });
      return;
    }
    const visibleMessages = (task.chatMessages || []).filter((entry) => (
      request.user.role !== 'team_member' || entry.sender?.role !== 'team_leader'
    ));
    response.json({
      messages: visibleMessages.map((entry) => ({
        id: entry._id.toString(),
        sender: entry.sender ? {
          id: entry.sender._id.toString(),
          name: entry.sender.name,
          role: entry.sender.role,
        } : null,
        message: entry.message,
        createdAt: entry.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function postTaskChat(request, response, next) {
  try {
    const message = typeof request.body?.message === 'string' ? request.body.message.trim() : '';
    if (!message || message.length > 2000) {
      response.status(400).json({ error: 'Enter a chat message between 1 and 2,000 characters.' });
      return;
    }
    const task = await Task.findById(request.params.id);
    if (!task || task.deletedAt) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (!(await canAccessTask(task, request.user))) {
      response.status(403).json({ error: 'You are not authorized to send messages in this task chat.' });
      return;
    }
    if (!task.collaborationEnabled) {
      response.status(400).json({ error: 'Task chat is available only for shared tasks.' });
      return;
    }
    if (task.chatMessages.length >= 3000) {
      response.status(409).json({ error: 'This task chat has reached its message limit.' });
      return;
    }
    task.chatMessages.push({ sender: request.user._id, message });
    await task.save();
    const saved = task.chatMessages[task.chatMessages.length - 1];
    const recipients = (task.assignees || []).filter((id) => !sameUser(id, request.user._id));
    await Promise.all(recipients.map((recipientId) => createNotification({
      recipientId,
      taskId: task._id,
      title: 'New Shared Task Message',
      message: `${request.user.name} sent a message in "${task.title}".`,
    })));
    response.status(201).json({
      message: {
        id: saved._id.toString(),
        sender: { id: request.user._id.toString(), name: request.user.name, role: request.user.role },
        message: saved.message,
        createdAt: saved.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTaskContribution(request, response, next) {
  try {
    if (request.user.role !== 'team_member') {
      response.status(403).json({ error: 'Only assigned Team Members can update their own contribution.' });
      return;
    }
    const task = await Task.findById(request.params.id);
    if (!task || task.deletedAt) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    const contribution = task.contributions.find((entry) => sameUser(entry.user, request.user._id));
    if (!contribution) {
      response.status(403).json({ error: 'You do not have a contribution assigned to this task.' });
      return;
    }
    const oldContributionStatus = contribution.status;
    const { responsibility, description, status, progress, completionNotes } = request.body || {};
    if (responsibility !== undefined) {
      if (typeof responsibility !== 'string' || responsibility.trim().length > 300) {
        response.status(400).json({ error: 'Responsibility must be 300 characters or fewer.' });
        return;
      }
      contribution.responsibility = responsibility.trim();
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length > 2000) {
        response.status(400).json({ error: 'Description must be 2,000 characters or fewer.' });
        return;
      }
      contribution.description = description.trim();
    }
    if (status !== undefined) {
      if (!['todo', 'in_progress', 'in_review', 'done'].includes(status)) {
        response.status(400).json({ error: 'Choose a valid contribution status.' });
        return;
      }
      contribution.status = status;
      if (status === 'done') contribution.progress = 100;
    }
    if (progress !== undefined) {
      const numericProgress = Number(progress);
      if (!Number.isInteger(numericProgress) || numericProgress < 0 || numericProgress > 100) {
        response.status(400).json({ error: 'Progress must be a whole number from 0 to 100.' });
        return;
      }
      contribution.progress = numericProgress;
    }
    if (contribution.status === 'done') contribution.progress = 100;
    if (completionNotes !== undefined) {
      if (typeof completionNotes !== 'string' || completionNotes.trim().length > 2000) {
        response.status(400).json({ error: 'Completion notes must be 2,000 characters or fewer.' });
        return;
      }
      contribution.completionNotes = completionNotes.trim();
    }
    contribution.updatedAt = new Date();
    const previousTaskStatus = task.status;
    if (task.status === 'assigned') task.status = 'in_progress';
    await task.save();
    await logTaskHistory({
      taskId: task._id,
      changedBy: request.user._id,
      oldStatus: previousTaskStatus,
      newStatus: task.status,
      comment: `${request.user.name} updated their work distribution contribution.`,
    });
    if (contribution.status !== oldContributionStatus && ['in_review', 'done'].includes(contribution.status)) {
      const department = task.department ? await Department.findById(task.department).select('teamLeader') : null;
      const recipients = [...new Set([
        task.assignedBy?.toString(),
        department?.teamLeader?.toString(),
      ].filter(Boolean))];
      await Promise.all(recipients.map((recipientId) => createNotification({
        recipientId,
        taskId: task._id,
        title: 'Team Contribution Updated',
        message: `${request.user.name} marked their contribution on "${task.title}" as ${contribution.status.replace('_', ' ')}.`,
      })));
    }
    response.json({ task: serializeTask(task), message: 'Your contribution was updated.' });
  } catch (error) {
    next(error);
  }
}

export async function updateTaskContributionAssignment(request, response, next) {
  try {
    if (!['team_leader', 'admin'].includes(request.user.role)) {
      response.status(403).json({ error: 'Only Team Leaders and Admins can manage contribution assignments.' });
      return;
    }
    if (!mongoose.isValidObjectId(request.params.memberId)) {
      response.status(400).json({ error: 'Choose a valid assigned team member.' });
      return;
    }
    const task = await Task.findById(request.params.id);
    if (!task || task.deletedAt) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (!(await canAccessTask(task, request.user))) {
      response.status(403).json({ error: 'You are not authorized to manage this task assignment.' });
      return;
    }
    const contribution = task.contributions.find((entry) => sameUser(entry.user, request.params.memberId));
    if (!contribution) {
      response.status(404).json({ error: 'No contribution exists for this assigned member.' });
      return;
    }
    const { responsibility, description } = request.body || {};
    if (typeof responsibility !== 'string' || responsibility.trim().length > 300
      || typeof description !== 'string' || description.trim().length > 2000) {
      response.status(400).json({ error: 'Responsibility and description are required and must fit their length limits.' });
      return;
    }
    contribution.responsibility = responsibility.trim();
    contribution.description = description.trim();
    contribution.updatedAt = new Date();
    await task.save();
    await logTaskHistory({
      taskId: task._id,
      changedBy: request.user._id,
      oldStatus: task.status,
      newStatus: task.status,
      comment: `${request.user.name} updated a team contribution assignment.`,
    });
    await createNotification({
      recipientId: contribution.user,
      taskId: task._id,
      title: 'Work Assignment Updated',
      message: `${request.user.name} updated your responsibility on "${task.title}".`,
    });
    response.json({ task: serializeTask(task), message: 'Contribution assignment updated.' });
  } catch (error) {
    next(error);
  }
}

export async function submitTeamTask(request, response, next) {
  try {
    const task = await Task.findById(request.params.id);
    if (!task || task.deletedAt) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (!task.collaborationEnabled || !(await canAccessTask(task, request.user))
      || request.user.role !== 'team_member') {
      response.status(403).json({ error: 'Only assigned Team Members can submit a shared task.' });
      return;
    }
    const contributions = task.contributions || [];
    if (!contributions.some((item) => sameUser(item.user, request.user._id))) {
      response.status(403).json({ error: 'You are not assigned a contribution to this task.' });
      return;
    }
    const { notes = '', summary = '', attachments = [], confirmIncomplete = false } = request.body || {};
    if (typeof notes !== 'string' || notes.trim().length > 4000
      || typeof summary !== 'string' || summary.trim().length > 8000) {
      response.status(400).json({ error: 'Submission notes or summary exceed the allowed length.' });
      return;
    }
    if (!Array.isArray(attachments) || attachments.length > 3) {
      response.status(400).json({ error: 'Attach no more than three supporting files.' });
      return;
    }
    const submittedFiles = [];
    let totalFileBytes = 0;
    for (const attachment of attachments) {
      if (!attachment || typeof attachment.name !== 'string' || typeof attachment.data !== 'string') {
        response.status(400).json({ error: 'Each attachment must include a name and file data.' });
        return;
      }
      const match = attachment.data.match(/^data:(application\/pdf|image\/png|image\/jpeg|text\/plain);base64,([A-Za-z0-9+/]+=*)$/);
      if (!match) {
        response.status(400).json({ error: 'Supported submission files are PDF, PNG, JPEG, and plain text.' });
        return;
      }
      const bytes = Buffer.from(match[2], 'base64');
      totalFileBytes += bytes.length;
      if (!bytes.length || bytes.length > 1_048_576 || totalFileBytes > 1_048_576
        || !hasExpectedFileSignature(match[1], bytes)) {
        response.status(400).json({ error: 'Submission files must be valid and total no more than 1 MB.' });
        return;
      }
      submittedFiles.push({
        name: attachment.name.trim().slice(0, 120) || 'submission-file',
        url: attachment.data,
      });
    }
    const allDone = contributions.length > 0 && contributions.every((item) => item.status === 'done');
    if (!allDone && confirmIncomplete !== true) {
      response.status(409).json({
        error: 'Some member contributions are not marked Done. Confirm to submit the work in its current state.',
        requiresConfirmation: true,
      });
      return;
    }
    const latest = task.submissions[task.submissions.length - 1];
    if (task.status === 'completed') {
      response.status(409).json({ error: 'A completed task cannot receive another submission.' });
      return;
    }
    if (latest?.decision === 'pending') {
      response.status(409).json({ error: 'This task already has a submission awaiting review.' });
      return;
    }
    const contributionSummary = contributions.map((item) => {
      const memberId = item.user?._id || item.user;
      const member = task.assignees.find((assignee) => sameUser(assignee, memberId));
      return `${member?.name || 'Team member'}: ${item.responsibility || item.description || 'Contribution'} — ${item.status} (${item.progress}%)`;
    }).join('\n');
    task.submissions.push({
      submittedBy: request.user._id,
      version: task.submissions.length + 1,
      notes: notes.trim(),
      summary: summary.trim() || contributionSummary,
      attachments: submittedFiles,
      submittedAt: new Date(),
      decision: 'pending',
    });
    task.status = 'submitted_review';
    task.submittedAt = new Date();
    task.completed = false;
    await task.save();
    await logTaskHistory({
      taskId: task._id,
      changedBy: request.user._id,
      oldStatus: 'in_progress',
      newStatus: 'submitted_review',
      comment: `Team submission v${task.submissions.length} submitted by ${request.user.name}.`,
    });
    const department = task.department
      ? await Department.findById(task.department).select('teamLeader')
      : null;
    const reviewRecipients = [...new Set([
      task.assignedBy?.toString(),
      department?.teamLeader?.toString(),
    ].filter(Boolean))];
    await Promise.all(reviewRecipients.map((recipientId) => createNotification({
        recipientId,
        taskId: task._id,
        title: 'Shared Task Submitted',
        message: `${request.user.name} submitted "${task.title}" for Team Leader review.`,
      })));
    response.status(201).json({ task: serializeTask(task, { includeSubmissions: true }), message: 'Shared task submitted for review.' });
  } catch (error) {
    next(error);
  }
}
