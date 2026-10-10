import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 30 },
  passwordHash: { type: String, required: true },
  theme: { type: String, default: 'aurora' },
  createdAt: { type: Date, default: Date.now },
});

const taskSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true, trim: true, maxlength: 500 },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model('User', userSchema);
export const Task = mongoose.model('Task', taskSchema);

export function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    theme: user.theme,
    createdAt: user.createdAt.getTime(),
  };
}

export function serializeTask(task) {
  return {
    id: task._id.toString(),
    text: task.text,
    completed: task.completed,
    createdAt: task.createdAt.getTime(),
  };
}
