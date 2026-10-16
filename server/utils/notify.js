import { Notification, TaskHistory } from '../models.js';

export async function createNotification({ recipientId, taskId, storyId, title, message, eventKey }) {
  try {
    if (!recipientId || !message) return null;
    const key = eventKey || `${recipientId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    return await Notification.create({
      recipient: recipientId,
      task: taskId || null,
      story: storyId || null,
      title: title || 'TaskFlow Notification',
      message,
      eventKey: key,
      isRead: false,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate eventKey handled gracefully
      return null;
    }
    console.error('Failed to create notification:', error);
    return null;
  }
}

export async function logTaskHistory({ taskId, changedBy, oldStatus, newStatus, comment = '' }) {
  try {
    if (!taskId || !changedBy) return null;
    return await TaskHistory.create({
      task: taskId,
      changedBy: changedBy._id || changedBy,
      oldStatus: oldStatus || '',
      newStatus: newStatus || '',
      comment: comment || '',
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to record task history:', error);
    return null;
  }
}
