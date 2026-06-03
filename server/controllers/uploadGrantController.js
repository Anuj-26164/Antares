/**
 * Upload-grant controller.
 *
 * Endpoints:
 *   POST   /api/events/:id/upload-requests              - viewer submits/replaces
 *   GET    /api/events/:id/upload-requests              - admin / event creator lists
 *   PATCH  /api/events/:id/upload-requests/:userId      - admin / event creator decides
 *   DELETE /api/events/:id/upload-requests/:userId      - admin / event creator revokes
 *   GET    /api/me/upload-requests                      - current user's own requests
 *
 * Authorization for "manage" endpoints: req.user.role === 'admin' OR
 * event.createdBy.equals(req.user._id).
 */
import mongoose from 'mongoose';
import UploadGrant from '../models/UploadGrant.js';
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { notifyUser } from '../sockets/notificationSocket.js';

const PRIVILEGED_ROLES = ['admin', 'photographer', 'club_member'];

/**
 * Check whether the given user is allowed to upload media to the given event.
 * Used by the media upload controller as well as the GET status endpoint.
 *
 * @param {object} user
 * @param {string|mongoose.Types.ObjectId} eventId
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
export async function canUserUploadToEvent(user, eventId) {
  if (!user) return { allowed: false, reason: 'unauthenticated' };
  if (PRIVILEGED_ROLES.includes(user.role)) {
    return { allowed: true, reason: 'role' };
  }
  const grant = await UploadGrant.findOne({
    eventId,
    userId: user._id,
    status: 'approved',
  }).lean();
  if (grant) return { allowed: true, reason: 'grant' };
  return { allowed: false, reason: 'no_grant' };
}

/**
 * Returns true if the requester can manage upload requests for this event:
 * either they are an admin, or they created the event.
 */
function canManageEvent(user, event) {
  if (!user || !event) return false;
  if (user.role === 'admin') return true;
  return String(event.createdBy) === String(user._id);
}

/**
 * POST /api/events/:id/upload-requests
 *
 * Viewer (or any authenticated user) submits a request. If they already have
 * an approved/pending row, this is treated as a no-op or a re-submission of
 * a denied request — we upsert and reset to 'pending'.
 */
export async function submitUploadRequest(req, res) {
  try {
    const { id } = req.params;
    const { message } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid event id' });
    }

    const event = await Event.findById(id).select('_id createdBy title');
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Privileged users don't need a grant.
    if (PRIVILEGED_ROLES.includes(req.user.role)) {
      return res.status(400).json({
        success: false,
        error: 'You already have permission to upload to this event',
      });
    }

    const cleanMessage =
      typeof message === 'string' ? message.trim().slice(0, 500) : '';

    // Upsert: reset back to pending if a previous denied/revoked grant exists.
    const existing = await UploadGrant.findOne({ eventId: id, userId: req.user._id });

    let grant;
    if (existing) {
      if (existing.status === 'approved') {
        return res.status(200).json({
          success: true,
          data: existing,
          info: 'already_approved',
        });
      }
      existing.status = 'pending';
      existing.message = cleanMessage;
      existing.decidedBy = undefined;
      existing.decidedAt = undefined;
      grant = await existing.save();
    } else {
      grant = await UploadGrant.create({
        eventId: id,
        userId: req.user._id,
        message: cleanMessage,
        status: 'pending',
      });
    }

    // Notify the event creator (admins can find requests via the listing UI).
    try {
      const recipientId = String(event.createdBy);
      if (recipientId !== String(req.user._id)) {
        const notif = await Notification.create({
          type: 'upload_request',
          recipient: recipientId,
          relatedUser: req.user._id,
          relatedEvent: id,
          title: 'Upload request',
          message: `${req.user.name} requested upload access for "${event.title}"`,
        });
        notifyUser(recipientId, notif, String(req.user._id));
      }
    } catch (notifErr) {
      console.error('Upload-request notification failed:', notifErr.message);
    }

    return res.status(201).json({ success: true, data: grant });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'Request already exists' });
    }
    console.error('submitUploadRequest failed:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to submit request' });
  }
}

/**
 * GET /api/events/:id/upload-requests
 *
 * Lists every UploadGrant attached to this event. Admin or the event creator
 * only. Includes both pending and decided records so the manage UI can show
 * the full history.
 */
export async function listEventUploadRequests(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid event id' });
    }
    const event = await Event.findById(id).select('_id createdBy');
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    if (!canManageEvent(req.user, event)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const grants = await UploadGrant.find({ eventId: id })
      .populate('userId', 'name avatar email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: grants });
  } catch (err) {
    console.error('listEventUploadRequests failed:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to list requests' });
  }
}

/**
 * PATCH /api/events/:id/upload-requests/:userId
 *
 * Body: { status: 'approved' | 'denied' }
 * Admin or event creator only. Notifies the requester via socket + DB
 * notification.
 */
export async function decideUploadRequest(req, res) {
  try {
    const { id, userId } = req.params;
    const { status } = req.body || {};

    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'status must be "approved" or "denied"',
      });
    }
    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({ success: false, error: 'Invalid id' });
    }

    const event = await Event.findById(id).select('_id createdBy title');
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    if (!canManageEvent(req.user, event)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const grant = await UploadGrant.findOne({ eventId: id, userId });
    if (!grant) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    grant.status = status;
    grant.decidedBy = req.user._id;
    grant.decidedAt = new Date();
    await grant.save();

    // Notify the requester.
    try {
      const notif = await Notification.create({
        type: 'upload_request_decided',
        recipient: userId,
        relatedUser: req.user._id,
        relatedEvent: id,
        title:
          status === 'approved'
            ? 'Upload access approved'
            : 'Upload access denied',
        message:
          status === 'approved'
            ? `You can now upload to "${event.title}"`
            : `Your request to upload to "${event.title}" was declined`,
      });
      notifyUser(String(userId), notif, String(req.user._id));
    } catch (notifErr) {
      console.error('Upload-decision notification failed:', notifErr.message);
    }

    return res.status(200).json({ success: true, data: grant });
  } catch (err) {
    console.error('decideUploadRequest failed:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update request' });
  }
}

/**
 * DELETE /api/events/:id/upload-requests/:userId
 *
 * Revokes an existing approval. Sets status to 'revoked' rather than deleting
 * the row so the audit trail stays intact.
 */
export async function revokeUploadGrant(req, res) {
  try {
    const { id, userId } = req.params;
    const event = await Event.findById(id).select('_id createdBy title');
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    if (!canManageEvent(req.user, event)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const grant = await UploadGrant.findOne({ eventId: id, userId });
    if (!grant) {
      return res.status(404).json({ success: false, error: 'Grant not found' });
    }

    grant.status = 'revoked';
    grant.decidedBy = req.user._id;
    grant.decidedAt = new Date();
    await grant.save();

    try {
      const notif = await Notification.create({
        type: 'upload_request_decided',
        recipient: userId,
        relatedUser: req.user._id,
        relatedEvent: id,
        title: 'Upload access revoked',
        message: `Your upload access to "${event.title}" has been revoked`,
      });
      notifyUser(String(userId), notif, String(req.user._id));
    } catch (notifErr) {
      console.error('Upload-revoke notification failed:', notifErr.message);
    }

    return res.status(200).json({ success: true, data: grant });
  } catch (err) {
    console.error('revokeUploadGrant failed:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to revoke grant' });
  }
}

/**
 * GET /api/me/upload-requests
 *
 * The current user's own requests across all events. Used by the user-facing
 * status pill on the album page to know which events they have access to.
 */
export async function listMyUploadRequests(req, res) {
  try {
    const grants = await UploadGrant.find({ userId: req.user._id })
      .populate('eventId', 'title coverImage date')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data: grants });
  } catch (err) {
    console.error('listMyUploadRequests failed:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch requests' });
  }
}

/**
 * GET /api/events/:id/upload-status
 *
 * Returns the current user's upload eligibility for the event. Cheap helper
 * the album page calls to decide whether to render the UploadZone, the
 * "Request access" button, or a status pill.
 */
export async function getMyUploadStatus(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid event id' });
    }
    const { allowed, reason } = await canUserUploadToEvent(req.user, id);

    let grant = null;
    if (!allowed) {
      grant = await UploadGrant.findOne({ eventId: id, userId: req.user._id }).lean();
    }

    return res.status(200).json({
      success: true,
      data: {
        allowed,
        reason,
        grantStatus: grant?.status ?? null,
      },
    });
  } catch (err) {
    console.error('getMyUploadStatus failed:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch status' });
  }
}
