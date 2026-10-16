import { AuditLog } from '../models.js';

export function recordAuditEvent({ actor, action, resourceType, resourceId, summary }) {
  return AuditLog.create({
    actor: actor?._id || actor || null,
    actorRole: actor?.role || 'unknown',
    action,
    resourceType,
    resourceId: resourceId || null,
    summary: String(summary).trim().slice(0, 500),
  });
}
