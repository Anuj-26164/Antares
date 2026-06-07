import Notification from '../models/Notification.js';

/**
 * GET /api/notifications
 * Returns the authenticated user's notifications, newest first.
 * Scoped to notifications where recipient === req.user._id.
 * Limit to 50 most recent.
 */
export async function listNotifications(req, res, next) {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('relatedUser', 'name avatar')
      .populate('relatedMedia', '_id type eventId')
      .populate('relatedEvent', '_id title')
      .lean();

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 */
export async function markNotificationRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found.' });
    }

    return res.status(200).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/notifications/read-all
 * Marks all of the user's notifications as read.
 */
export async function markAllNotificationsRead(req, res, next) {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}
