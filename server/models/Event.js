import mongoose from 'mongoose';

const { Schema } = mongoose;

const eventSchema = new Schema({
  title: {
    type: String,
    required: true,
    maxlength: 150
  },
  description: {
    type: String,
    maxlength: 2000
  },
  category: {
    type: String,
    maxlength: 50
  },
  date: {
    type: Date
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  coverImage: {
    type: String,
    maxlength: 2048
  },
  tags: {
    type: [String],
    validate: [
      {
        validator: function (v) {
          return v.length <= 20;
        },
        message: 'Max 20 tags'
      },
      {
        validator: function (v) {
          return v.every(tag => tag.length <= 50);
        },
        message: 'Each tag must be at most 50 characters'
      }
    ]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Event = mongoose.model('Event', eventSchema);

export default Event;
