import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    maxlength: 128
  },
  googleId: {
    type: String,
    maxlength: 255
  },
  role: {
    type: String,
    enum: ['admin', 'photographer', 'club_member', 'viewer'],
    default: 'viewer'
  },
  avatar: {
    type: String,
    maxlength: 2048
  },
  refreshToken: {
    type: String
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

export default User;
