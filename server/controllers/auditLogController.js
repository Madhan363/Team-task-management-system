import mongoose from 'mongoose';
import { AuditLog } from '../models.js';

export async function listAuditLogs(request, response, next) {
  try {
    const page = Math.max(1, Number.parseInt(request.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(request.query.limit, 10) || 25));
    const filter = {};

    if (typeof request.query.action === 'string' && request.query.action.trim()) {
      filter.action = request.query.action.trim().slice(0, 80);
    }
    if (typeof request.query.actor === 'string' && mongoose.isValidObjectId(request.query.actor)) {
      filter.actor = request.query.actor;
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .populate('actor', 'name username')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    response.json({
      logs: logs.map((entry) => ({
        id: entry._id.toString(),
        actor: entry.actor ? {
          id: entry.actor._id.toString(),
          name: entry.actor.name,
          username: entry.actor.username,
        } : null,
        actorRole: entry.actorRole,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId?.toString() || null,
        summary: entry.summary,
        createdAt: entry.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    next(error);
  }
}
