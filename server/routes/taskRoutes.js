import express from 'express';
import mongoose from 'mongoose';
import {
  createTask,
  getMyTasks,
  getTeamTasks,
  getTaskById,
  acknowledgeTask,
  updateTaskStatus,
  reviewTask,
  addTaskResponse,
  getTaskHistory,
  getTaskChat,
  postTaskChat,
  updateTaskContribution,
  updateTaskContributionAssignment,
  submitTeamTask,
} from '../controllers/taskController.js';
import { requireUser } from '../middleware/auth.js';
import { Department, Task, serializeTask } from '../models.js';
import { recordAuditEvent } from '../utils/audit.js';

const router = express.Router();

router.use(requireUser);

router.param('id', async (request, response, next, id) => {
  try {
    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (await Task.exists({ _id: id, projectPublished: false })) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// General tasks list (supports personal to-do list & fallback)
router.get('/', async (request, response, next) => {
  try {
    const tasks = await Task.find({
      $or: [{ assignee: request.user._id }, { user: request.user._id }, { assignees: request.user._id }],
      deletedAt: null,
      projectPublished: { $ne: false },
    })
      .populate('assignee', 'name username email profileImage')
      .populate('assignees', 'name username email profileImage department')
      .populate('contributions.user', 'name username email')
      .populate('assignedBy', 'name username email')
      .populate('department', 'name')
      .populate('project', 'name description')
      .sort({ createdAt: -1 });
    response.json({ tasks: tasks.map(serializeTask) });
  } catch (error) {
    next(error);
  }
});

router.get('/personal', async (request, response, next) => {
  try {
    const tasks = await Task.find({
      $and: [
        { $or: [{ assignee: request.user._id }, { user: request.user._id }] },
        { $or: [{ assignedBy: request.user._id }, { assignedBy: null }] },
        { deletedAt: null },
        { projectPublished: { $ne: false } },
      ],
    })
      .populate('assignee', 'name username email profileImage')
      .populate('assignedBy', 'name username email')
      .populate('department', 'name')
      .populate('project', 'name description')
      .sort({ createdAt: -1 });
    response.json({ tasks: tasks.map(serializeTask) });
  } catch (error) {
    next(error);
  }
});

router.post('/', createTask);

// Import local tasks (backward compatibility)
router.post('/import-local', async (request, response, next) => {
  try {
    const { tasks } = request.body || {};
    if (!Array.isArray(tasks) || tasks.length > 500) {
      response.status(400).json({ error: 'Import must contain no more than 500 tasks.' });
      return;
    }

    const operations = [];
    for (const localTask of tasks) {
      if (!localTask || typeof localTask.id !== 'string') continue;
      const title = localTask.title || localTask.text || 'Imported Task';
      operations.push({
        updateOne: {
          filter: { user: request.user._id, localImportId: localTask.id },
          update: {
            $setOnInsert: {
              user: request.user._id,
              assignee: request.user._id,
              localImportId: localTask.id,
              title: title.trim().slice(0, 120),
              description: (localTask.description || '').slice(0, 2000),
              category: (localTask.category || 'General').slice(0, 40),
              priority: ['low', 'medium', 'high'].includes(localTask.priority) ? localTask.priority : 'medium',
              dueDate: localTask.dueDate ? new Date(localTask.dueDate) : null,
              completed: Boolean(localTask.completed),
              status: localTask.completed ? 'completed' : 'assigned',
              acknowledgmentStatus: 'acknowledged',
            },
          },
          upsert: true,
        },
      });
    }

    if (operations.length) {
      await Task.bulkWrite(operations, { ordered: true });
    }
    response.json({ importedCount: operations.length });
  } catch (error) {
    next(error);
  }
});

// Clear completed tasks (backward compatibility)
router.delete('/completed', async (request, response, next) => {
  try {
    const result = await Task.deleteMany({
      user: request.user._id,
      assignedBy: { $in: [request.user._id, null] },
      completed: true,
      deletedAt: null,
    });
    response.json({ deletedCount: result.deletedCount });
  } catch (error) {
    next(error);
  }
});

// Specific TaskFlow endpoints
router.get('/my-tasks', getMyTasks);
router.get('/team', getTeamTasks);
router.get('/:id', getTaskById);
router.patch('/:id/acknowledge', acknowledgeTask);
router.patch('/:id/status', updateTaskStatus);
router.post('/:id/responses', addTaskResponse);
router.get('/:id/chat', getTaskChat);
router.post('/:id/chat', postTaskChat);
router.patch('/:id/contribution', updateTaskContribution);
router.patch('/:id/contributions/:memberId', updateTaskContributionAssignment);
router.post('/:id/team-submissions', submitTeamTask);
router.patch('/:id/review', reviewTask);
router.get('/:id/history', getTaskHistory);

router.patch('/:id/dependencies', async (request, response, next) => {
  try {
    if (!['admin', 'team_leader'].includes(request.user.role)) {
      response.status(403).json({ error: 'Only Team Leaders and Admins can change task dependencies.' });
      return;
    }

    const { dependencies } = request.body || {};
    if (!mongoose.isValidObjectId(request.params.id)
      || !Array.isArray(dependencies)
      || dependencies.length > 20
      || dependencies.some((id) => !mongoose.isValidObjectId(id))) {
      response.status(400).json({ error: 'Choose up to 20 valid task dependencies.' });
      return;
    }

    const uniqueDependencies = [...new Set(dependencies.map(String))];
    if (uniqueDependencies.includes(request.params.id)) {
      response.status(400).json({ error: 'A task cannot depend on itself.' });
      return;
    }

    let scope = { deletedAt: null };
    if (request.user.role === 'team_leader') {
      const department = await Department.findOne({ teamLeader: request.user._id }).select('_id');
      if (!department) {
        response.status(403).json({ error: 'You must lead a department to change task dependencies.' });
        return;
      }
      scope = { ...scope, department: department._id };
    }

    const scopedTasks = await Task.find(scope).select('_id dependencies');
    const scopedIds = new Set(scopedTasks.map((task) => task._id.toString()));
    if (!scopedIds.has(request.params.id)
      || uniqueDependencies.some((id) => !scopedIds.has(id))) {
      response.status(404).json({ error: 'Task or dependency not found in your available tasks.' });
      return;
    }

    const dependencyMap = new Map(scopedTasks.map((task) => [
      task._id.toString(),
      task.dependencies.map((id) => id.toString()),
    ]));
    const reachesTask = (startId) => {
      const visited = new Set();
      const pending = [startId];
      while (pending.length) {
        const currentId = pending.pop();
        if (currentId === request.params.id) return true;
        if (visited.has(currentId)) continue;
        visited.add(currentId);
        pending.push(...(dependencyMap.get(currentId) || []));
      }
      return false;
    };

    if (uniqueDependencies.some(reachesTask)) {
      response.status(400).json({ error: 'These dependencies would create a task cycle.' });
      return;
    }

    const task = await Task.findOneAndUpdate(
      { _id: request.params.id, ...scope },
      { $set: { dependencies: uniqueDependencies } },
      { new: true, runValidators: true },
    ).populate('dependencies', 'title');
    if (!task) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    await recordAuditEvent({
      actor: request.user,
      action: 'task.dependencies_updated',
      resourceType: 'task',
      resourceId: task._id,
      summary: `Updated dependencies for task "${task.title}".`,
    });
    response.json({ task: serializeTask(task) });
  } catch (error) {
    next(error);
  }
});

// Task edit and update
router.patch('/:id', async (request, response, next) => {
  try {
    const { id } = request.params;
    const body = request.body || {};

    const allowed = ['title', 'description', 'category', 'priority', 'dueDate', 'reminderAt', 'completed'];
    if (Object.keys(body).some((key) => !allowed.includes(key))) {
      response.status(400).json({ error: 'One or more task fields are not allowed.' });
      return;
    }

    const fields = {};
    if (Object.hasOwn(body, 'title')) {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 120) {
        response.status(400).json({ error: 'Task title is required and must be 120 characters or fewer.' });
        return;
      }
      fields.title = body.title.trim();
    }
    if (Object.hasOwn(body, 'description')) {
      fields.description = (body.description ?? '').trim();
    }
    if (Object.hasOwn(body, 'category')) {
      fields.category = (body.category ?? 'General').trim() || 'General';
    }
    if (Object.hasOwn(body, 'priority')) {
      if (!['low', 'medium', 'high'].includes(body.priority)) {
        response.status(400).json({ error: 'Choose a valid task priority.' });
        return;
      }
      fields.priority = body.priority;
    }
    if (Object.hasOwn(body, 'dueDate')) {
      fields.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }
    if (Object.hasOwn(body, 'reminderAt')) {
      fields.reminderAt = body.reminderAt ? new Date(body.reminderAt) : null;
    }
    if (Object.hasOwn(body, 'completed')) {
      const completed = Boolean(body.completed);
      fields.completed = completed;
      fields.completedAt = completed ? new Date() : null;
      if (completed) {
        fields.status = 'completed';
      } else {
        fields.status = 'in_progress';
      }
    }

    const taskFilter = {
      _id: id,
      $and: [
        { $or: [{ user: request.user._id }, { assignee: request.user._id }] },
        { $or: [{ assignedBy: request.user._id }, { assignedBy: null }] },
      ],
      deletedAt: null,
      ...(Object.hasOwn(body, 'completed') ? {} : { completed: false }),
    };

    const task = await Task.findOneAndUpdate(
      taskFilter,
      { $set: fields },
      { new: true, runValidators: true },
    );

    if (!task) {
      if (taskFilter.completed === false) {
        const completedTask = await Task.exists({
          _id: id,
          $and: [
            { $or: [{ user: request.user._id }, { assignee: request.user._id }] },
            { $or: [{ assignedBy: request.user._id }, { assignedBy: null }] },
          ],
          deletedAt: null,
          completed: true,
        });
        if (completedTask) {
          response.status(409).json({ error: 'Completed tasks cannot be edited. Mark the task incomplete to edit it.' });
          return;
        }
      }
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    await recordAuditEvent({
      actor: request.user,
      action: 'task.updated',
      resourceType: 'task',
      resourceId: task._id,
      summary: `Updated personal task "${task.title}".`,
    });
    response.json({ task: serializeTask(task) });
  } catch (error) {
    if (error.name === 'CastError') {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    next(error);
  }
});

router.delete('/:id', async (request, response, next) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: request.params.id,
      $and: [
        { $or: [{ user: request.user._id }, { assignee: request.user._id }] },
        { $or: [{ assignedBy: request.user._id }, { assignedBy: null }] },
      ],
      deletedAt: null,
    });

    if (!task) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    await recordAuditEvent({
      actor: request.user,
      action: 'task.deleted',
      resourceType: 'task',
      resourceId: task._id,
      summary: `Deleted task "${task.title}".`,
    });
    response.status(204).end();
  } catch (error) {
    if (error.name === 'CastError') {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    next(error);
  }
});

export default router;
