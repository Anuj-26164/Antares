import mongoose from 'mongoose';

const { Schema } = mongoose;

const mediaSchema = new Schema({
  eventId: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  url: {
    type: String,
    required: true,
    maxlength: 2048
  },
  r2Key: {
    type: String,
    required: true,
    maxlength: 512
  },
  type: {
    type: String,
    enum: ['photo', 'video'],
    required: true
  },
  thumbnailUrl: {
    type: String,
    maxlength: 2048
  },
  thumbnailR2Key: {
    type: String,
    maxlength: 512
  },
  tags: {
    type: [String],
    validate: [
      {
        validator: function (v) {
          return v.length <= 30;
        },
        message: 'Max 30 tags'
      },
      {
        validator: function (v) {
          return v.every(tag => tag.length <= 50);
        },
        message: 'Each tag must be 50 characters or fewer'
      }
    ]
  },
  likes: {
    type: Number,
    default: 0,
    min: 0
  },
  comments: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  favouritedBy: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Media = mongoose.model('Media', mediaSchema);

export default Media;
