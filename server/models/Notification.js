import mongoose from 'mongoose';

const { Schema } = mongoose;

const notificationSchema = new Schema({
  type: {
    type: String,
    enum: ['media_upload', 'user_registration', 'comment', 'like', 'tag', 'activity'],
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
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
