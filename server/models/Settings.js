import mongoose from 'mongoose';

const { Schema } = mongoose;

const settingsSchema = new Schema({
  key: {
    type: String,
    default: 'platform_settings',
    unique: true
  },
  uploadSizeLimit: {
    type: Number,
    min: 1,
    default: 50
  },
  maxBulkUploadCount: {
    type: Number,
    min: 1,
    default: 20
  },
  allowedImageTypes: {
    type: [String],
    default: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  },
  allowedVideoTypes: {
    type: [String],
    default: ['video/mp4', 'video/webm', 'video/quicktime']
  },
  defaultVisibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
