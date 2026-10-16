import mongoose from 'mongoose';
import { Notification } from '../models.js';

export async function getNotifications(request, response, next) {
  try {
    const notifications = await Notification.find({ recipient: request.user._id, story: null })
      .populate('task', 'title status priority')
      .populate('meeting', 'title startsAt status')
      .populate('room', 'name type')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      recipient: request.user._id,
      isRead: false,
    });

    response.json({
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        taskId: n.task?._id?.toString() || n.task?.toString() || null,
        taskTitle: n.task?.title || '',
        meetingId: n.meeting?._id?.toString() || n.meeting?.toString() || null,
        meetingTitle: n.meeting?.title || '',
        roomId: n.room?._id?.toString() || n.room?.toString() || null,
        roomName: n.room?.name || '',
        title: n.title || 'Notification',
        message: n.message,
        isRead: n.isRead || Boolean(n.readAt),
        read: n.isRead || Boolean(n.readAt),
        createdAt: n.createdAt?.toISOString(),
      })),
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(404).json({ error: 'Notification not found.' });
      return;
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: request.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    );

    if (!notification) {
      response.status(404).json({ error: 'Notification not found.' });
      return;
    }

    response.json({ message: 'Notification marked as read.' });
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(request, response, next) {
  try {
    await Notification.updateMany(
      { recipient: request.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );

    response.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
}

export async function clearNotifications(request, response, next) {
  try {
    const result = await Notification.deleteMany({ recipient: request.user._id });
    response.json({ message: 'Your notifications cleared.', deletedCount: result.deletedCount });
  } catch (error) {
    next(error);
  }
}
