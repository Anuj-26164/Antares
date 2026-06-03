import mongoose from 'mongoose';

const { Schema } = mongoose;

const notificationSchema = new Schema({
  type: {
    type: String,
    enum: ['media_upload', 'user_registration', 'comment', 'like', 'tag', 'activity', 'upload_request', 'upload_request_decided'],
    required: true
  },
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  // Most recent actor — kept for backward compatibility and as a quick
  // reference for icons/links. For aggregated notifications, the full set
  // lives in `actors`.
  relatedUser: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  relatedMedia: {
    type: Schema.Types.ObjectId,
    ref: 'Media'
  },
  relatedEvent: {
    type: Schema.Types.ObjectId,
    ref: 'Event'
  },
  // Aggregation fields. For non-aggregated types these stay at their defaults
  // (single actor, count 1) and behave like before.
  actors: {
    type: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String },
        at:   { type: Date, default: Date.now },
      },
    ],
    default: [],
  },
  actorCount: {
    type: Number,
    default: 1,
    min: 1,
  },
  lastActorAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Speeds up the aggregation lookup (find an unread, recent row for the same
// recipient/type/target).
notificationSchema.index({ recipient: 1, type: 1, relatedMedia: 1, isRead: 1, lastActorAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
