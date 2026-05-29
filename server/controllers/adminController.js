import User from '../models/User.js';
import Event from '../models/Event.js';
import Media from '../models/Media.js';
import Notification from '../models/Notification.js';
import Settings from '../models/Settings.js';

/**
 * GET /api/admin/analytics
 * Returns aggregate counts and time-series data for the last 30 days.
 */
export async function getAnalytics(req, res) {
  try {
    const [totalEvents, totalMedia, totalUsers] = await Promise.all([
      Event.countDocuments(),
      Media.countDocuments(),
      User.countDocuments()
    ]);

    // Estimate total storage: average ~5MB per media item (placeholder calculation)
    const totalStorage = totalMedia * 5;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [rawUploadsPerDay, rawRegistrationsPerDay] = await Promise.all([
      Media.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } }
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } }
      ])
    ]);

    // Fill in all 30 days with 0 for days that have no data
    const allDays = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      allDays.push(d.toISOString().split('T')[0]);
    }

    const uploadMap = Object.fromEntries(rawUploadsPerDay.map(d => [d.date, d.count]));
    const regMap = Object.fromEntries(rawRegistrationsPerDay.map(d => [d.date, d.count]));

    const uploadsPerDay = allDays.map(date => ({ date, count: uploadMap[date] || 0 }));
    const registrationsPerDay = allDays.map(date => ({ date, count: regMap[date] || 0 }));

    res.json({
      success: true,
      data: {
        totalEvents,
        totalMedia,
        totalUsers,
        totalStorage,
        uploadsPerDay,
        registrationsPerDay
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/admin/users
 * Returns paginated user list with optional search and role filter.
 */
export async function getUsers(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const { search, role } = req.query;

    const filter = {};

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ name: regex }, { email: regex }];
    }

    if (role) {
      filter.role = role;
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshToken')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: { users, total, page, limit }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * PATCH /api/admin/users/:id/role
 * Updates a user's role. Prevents demoting the last admin.
 */
export async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['admin', 'photographer', 'club_member', 'viewer'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be one of: admin, photographer, club_member, viewer'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Prevent demoting the last admin
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(403).json({
          success: false,
          error: 'At least one admin must remain in the system. Promote another user to admin first.'
        });
      }
    }

    user.role = role;
    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;
    delete updatedUser.refreshToken;

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * PATCH /api/admin/users/:id/block
 * Toggles a user's blocked status.
 */
export async function toggleBlockUser(req, res) {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Prevent blocking other admins
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, error: 'Cannot block an admin user' });
    }

    user.isBlocked = !user.isBlocked;
    // Clear refresh token when blocking to force logout
    if (user.isBlocked) {
      user.refreshToken = null;
    }
    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;
    delete updatedUser.refreshToken;

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}/**
 * GET /api/admin/notifications
 * Returns paginated notifications sorted by createdAt descending.
 */
export async function getNotifications(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('relatedUser', 'name avatar'),
      Notification.countDocuments()
    ]);

    res.json({
      success: true,
      data: { notifications, total, page, limit }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * PATCH /api/admin/notifications/:id/read
 * Marks a notification as read.
 */
export async function markNotificationRead(req, res) {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    notification.isRead = true;
    await notification.save();

    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/admin/notifications/unread-count
 * Returns the count of unread notifications.
 */
export async function getUnreadCount(req, res) {
  try {
    const count = await Notification.countDocuments({ isRead: false });
    res.json({ success: true, data: { count } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/admin/settings
 * Returns platform settings, creating defaults if not found.
 */
export async function getSettings(req, res) {
  try {
    let settings = await Settings.findOne({ key: 'platform_settings' });

    if (!settings) {
      settings = await Settings.create({ key: 'platform_settings' });
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * PUT /api/admin/settings
 * Updates platform settings with validation.
 */
export async function updateSettings(req, res) {
  try {
    const {
      uploadSizeLimit,
      maxBulkUploadCount,
      allowedImageTypes,
      allowedVideoTypes,
      defaultVisibility
    } = req.body;

    // Validation
    const errors = [];

    if (uploadSizeLimit !== undefined && (typeof uploadSizeLimit !== 'number' || uploadSizeLimit <= 0)) {
      errors.push('uploadSizeLimit must be a positive number');
    }

    if (allowedImageTypes !== undefined && (!Array.isArray(allowedImageTypes) || allowedImageTypes.length < 1)) {
      errors.push('allowedImageTypes must have at least 1 item');
    }

    if (allowedVideoTypes !== undefined && (!Array.isArray(allowedVideoTypes) || allowedVideoTypes.length < 1)) {
      errors.push('allowedVideoTypes must have at least 1 item');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    let settings = await Settings.findOne({ key: 'platform_settings' });
    if (!settings) {
      settings = await Settings.create({ key: 'platform_settings' });
    }

    if (uploadSizeLimit !== undefined) settings.uploadSizeLimit = uploadSizeLimit;
    if (maxBulkUploadCount !== undefined) settings.maxBulkUploadCount = maxBulkUploadCount;
    if (allowedImageTypes !== undefined) settings.allowedImageTypes = allowedImageTypes;
    if (allowedVideoTypes !== undefined) settings.allowedVideoTypes = allowedVideoTypes;
    if (defaultVisibility !== undefined) settings.defaultVisibility = defaultVisibility;
    settings.updatedAt = new Date();

    await settings.save();

    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
