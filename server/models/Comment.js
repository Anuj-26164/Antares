import mongoose from 'mongoose';

const { Schema } = mongoose;

const commentSchema = new Schema({
  mediaId: { type: Schema.Types.ObjectId, ref: 'Media', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, minlength: 1, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
});

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;
