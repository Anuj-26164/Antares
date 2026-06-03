/**
 * UploadGrant — per-event permission for users to upload media.
 *
 * Lifecycle:
 *   pending  → created by the requester via POST /events/:id/upload-requests
 *   approved → set by event creator or admin; allows uploads to that event
 *   denied   → set by event creator or admin; the requester may resubmit
 *   revoked  → previously approved, now turned off without losing the audit trail
 *
 * A user may have at most one *active* row per event. We enforce that with a
 * compound unique index on (eventId, userId). Resubmissions overwrite the
 * existing row rather than creating duplicates.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

const uploadGrantSchema = new Schema({
  eventId: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'revoked'],
    default: 'pending',
    required: true,
  },
  message: {
    type: String,
    maxlength: 500,
  },
  decidedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  decidedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

uploadGrantSchema.index({ eventId: 1, userId: 1 }, { unique: true });

const UploadGrant = mongoose.model('UploadGrant', uploadGrantSchema);

export default UploadGrant;
