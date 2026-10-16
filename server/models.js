import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 30 },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true, maxlength: 254 },
  phoneNumber: { type: String, trim: true, maxlength: 20, default: '' },
  profileImage: { type: String, default: null, maxlength: 1_400_000 },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'team_leader', 'team_member', 'personal'], default: 'team_member', index: true },
  isActive: { type: Boolean, default: true, index: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

userSchema.virtual('departmentId')
  .get(function () { return this.department ? (this.department._id || this.department) : null; })
  .set(function (val) { this.department = val; });

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

departmentSchema.virtual('teamLeaderId')
  .get(function () { return this.teamLeader ? (this.teamLeader._id || this.teamLeader) : null; })
  .set(function (val) { this.teamLeader = val; });

const activitySessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startedAt: { type: Date, required: true, default: Date.now, index: true },
  endedAt: { type: Date, default: null, index: true },
  lastActivityAt: { type: Date, required: true, default: Date.now },
  lastSeenAt: { type: Date, required: true, default: Date.now },
  tokenExpiresAt: { type: Date, required: true },
  activeMilliseconds: { type: Number, default: 0, min: 0 },
  endReason: { type: String, enum: ['logout', 'expired'], default: null },
}, { timestamps: true });

activitySessionSchema.index({ user: 1, startedAt: -1 });
activitySessionSchema.index({ endedAt: 1, tokenExpiresAt: 1 });

const activityStateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  lastActivityAt: { type: Date, required: true },
}, { timestamps: true });

const activityEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'ActivitySession', required: true, index: true },
  kind: { type: String, enum: ['login', 'activity', 'logout', 'expired'], required: true },
  day: { type: String, required: true, index: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  activeMilliseconds: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

activityEventSchema.index({ user: 1, day: 1 });

const taskAttachmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  url: { type: String, required: true, trim: true },
}, { _id: false });

const taskContributionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  responsibility: { type: String, trim: true, maxlength: 300, default: '' },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  status: { type: String, enum: ['todo', 'in_progress', 'in_review', 'done'], default: 'todo' },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  startDate: { type: Date, default: null },
  dueDate: { type: Date, default: null },
  completionNotes: { type: String, trim: true, maxlength: 2000, default: '' },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const taskChatMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true });

const taskSubmissionSchema = new mongoose.Schema({
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, required: true },
  notes: { type: String, trim: true, maxlength: 4000, default: '' },
  summary: { type: String, trim: true, maxlength: 8000, default: '' },
  attachments: { type: [taskAttachmentSchema], default: [] },
  submittedAt: { type: Date, default: Date.now },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  acknowledgedAt: { type: Date, default: null },
  reviewComment: { type: String, trim: true, maxlength: 2000, default: '' },
  decision: { type: String, enum: ['pending', 'approved', 'changes_requested'], default: 'pending' },
}, { timestamps: true });

const storyContributionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  responsibility: { type: String, trim: true, maxlength: 300, default: '' },
  status: { type: String, enum: ['todo', 'in_progress', 'in_review', 'done'], default: 'todo' },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const storyCommentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true });

const storyActivitySchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, trim: true, maxlength: 80 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const storyLinkSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  url: { type: String, required: true, trim: true, maxlength: 2048 },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  // Link to user for personal tasks or assignee
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  localImportId: { type: String, default: null },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  category: { type: String, trim: true, maxlength: 40, default: 'General' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium', index: true },
  startDate: { type: Date, default: null },
  dueDate: { type: Date, default: null },
  reminderAt: { type: Date, default: null },
  acknowledgmentStatus: { type: String, enum: ['pending', 'acknowledged'], default: 'pending', index: true },
  acknowledgedAt: { type: Date, default: null },
  status: { type: String, enum: ['assigned', 'in_progress', 'submitted_review', 'completed'], default: 'assigned', index: true },
  submittedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  completed: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null, index: true },

  // Role-based task tracking fields
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  projectPublished: { type: Boolean, default: true, index: true },
  contributions: { type: [taskContributionSchema], default: [] },
  collaborationEnabled: { type: Boolean, default: false },
  chatMessages: { type: [taskChatMessageSchema], default: [] },
  submissions: { type: [taskSubmissionSchema], default: [] },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
  dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  attachments: { type: [taskAttachmentSchema], default: [] },
  recurrence: { type: String, enum: ['none', 'daily', 'weekly', 'biweekly', 'monthly'], default: 'none', index: true },
  recurrenceInterval: { type: Number, default: 1 },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

taskSchema.virtual('assignedTo')
  .get(function () { return this.assignee || this.user || null; })
  .set(function (val) {
    this.assignee = val;
    if (!this.user) this.user = val;
  });

taskSchema.virtual('departmentId')
  .get(function () { return this.department ? (this.department._id || this.department) : null; })
  .set(function (val) { this.department = val; });

taskSchema.index({ user: 1, deletedAt: 1, createdAt: -1 });
taskSchema.index({ assignee: 1, status: 1, dueDate: 1 });
taskSchema.index({ department: 1, status: 1 });
taskSchema.index(
  { user: 1, localImportId: 1 },
  { unique: true, partialFilterExpression: { localImportId: { $type: 'string' } } },
);

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

// TeamTask uses taskSchema for unified storage while maintaining collection compatibility
const teamTaskSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  dueDate: { type: Date, default: null },
  status: { type: String, enum: ['assigned', 'in_progress', 'submitted_review', 'completed'], default: 'assigned' },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  startDate: { type: Date, default: null },
  acknowledgmentStatus: { type: String, enum: ['pending', 'acknowledged'], default: 'pending' },
  acknowledgedAt: { type: Date, default: null },
  submittedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  attachments: { type: [taskAttachmentSchema], default: [] },
}, { timestamps: true });

const teamNotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  story: { type: mongoose.Schema.Types.ObjectId, ref: 'UserStory', default: null },
  meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', default: null },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'MeetingRoom', default: null },
  eventKey: { type: String, required: true, default: () => new mongoose.Types.ObjectId().toString(), unique: true },
  title: { type: String, default: 'Task Update', maxlength: 120 },
  message: { type: String, required: true, maxlength: 500 },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

teamNotificationSchema.virtual('recipientId')
  .get(function () { return this.recipient; })
  .set(function (val) { this.recipient = val; });

teamNotificationSchema.virtual('taskId')
  .get(function () { return this.task; })
  .set(function (val) { this.task = val; });

const taskResponseSchema = new mongoose.Schema({
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  responseType: { type: String, enum: ['comment', 'clarification', 'review', 'deliverable'], default: 'comment' },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  attachments: { type: [taskAttachmentSchema], default: [] },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

taskResponseSchema.virtual('taskId')
  .get(function () { return this.task; })
  .set(function (val) { this.task = val; });

taskResponseSchema.virtual('userId')
  .get(function () { return this.user; })
  .set(function (val) { this.user = val; });

const taskHistorySchema = new mongoose.Schema({
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  oldStatus: { type: String, default: '' },
  newStatus: { type: String, default: '' },
  comment: { type: String, trim: true, maxlength: 2000, default: '' },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

taskHistorySchema.virtual('taskId')
  .get(function () { return this.task; })
  .set(function (val) { this.task = val; });

const assistantMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  text: { type: String, required: true, maxlength: 6000 },
  mode: { type: String, enum: ['openai', 'rule-based'], default: 'rule-based' },
  taskCards: [{
    title: { type: String, required: true, maxlength: 120 },
    status: { type: String, maxlength: 40 },
    priority: { type: String, maxlength: 20 },
    dueDate: { type: Date, default: null },
  }],
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const assistantConversationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, trim: true, maxlength: 100, default: 'New chat' },
  messages: { type: [assistantMessageSchema], default: [] },
}, { timestamps: true });

assistantConversationSchema.index({ user: 1, updatedAt: -1 });

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  actorRole: { type: String, required: true, maxlength: 30 },
  action: { type: String, required: true, maxlength: 80, index: true },
  resourceType: { type: String, required: true, maxlength: 40, index: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  summary: { type: String, required: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false });

auditLogSchema.index({ createdAt: -1, _id: -1 });

const roomAnnouncementSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const meetingRoomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  purpose: { type: String, trim: true, maxlength: 1000, default: '' },
  type: { type: String, enum: ['leadership', 'team'], required: true, index: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  announcements: { type: [roomAnnouncementSchema], default: [] },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

meetingRoomSchema.index({ participants: 1, isActive: 1 });

const meetingNoteSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['note', 'decision', 'blocker'], default: 'note' },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const meetingFollowUpSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  dueAt: { type: Date, default: null },
  status: { type: String, enum: ['open', 'completed'], default: 'open' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  agenda: { type: String, trim: true, maxlength: 5000, default: '' },
  startsAt: { type: Date, required: true, index: true },
  endsAt: { type: Date, required: true },
  timezone: { type: String, required: true, maxlength: 80, default: 'UTC' },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'MeetingRoom', default: null, index: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null, index: true },
  meetingUrl: { type: String, trim: true, maxlength: 2048, default: '' },
  calendarEventId: { type: String, default: null },
  status: { type: String, enum: ['scheduled', 'cancelled'], default: 'scheduled', index: true },
  notes: { type: [meetingNoteSchema], default: [] },
  followUps: { type: [meetingFollowUpSchema], default: [] },
  reminderSentAt: { type: Date, default: null },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

meetingSchema.index({ participants: 1, startsAt: -1 });
meetingSchema.index({ department: 1, startsAt: -1, status: 1 });

const userStorySchema = new mongoose.Schema({
  storyId: { type: String, required: true, unique: true, immutable: true, maxlength: 27 },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  acceptanceCriteria: { type: String, required: true, trim: true, maxlength: 5000 },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true, index: true },
  status: { type: String, enum: ['todo', 'in_progress', 'in_review', 'done'], default: 'todo', index: true },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  contributions: { type: [storyContributionSchema], default: [] },
  comments: { type: [storyCommentSchema], default: [] },
  activity: { type: [storyActivitySchema], default: [] },
  links: { type: [storyLinkSchema], default: [] },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  reviewComment: { type: String, trim: true, maxlength: 2000, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  startDate: { type: Date, required: true },
  dueDate: { type: Date, required: true, index: true },
}, { timestamps: true });

userStorySchema.index({ department: 1, status: 1, dueDate: 1 });

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  status: { type: String, enum: ['staging', 'published'], default: 'staging', index: true },
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  importedAt: { type: Date, default: null },
  importHash: { type: String, required: true },
  sourceHash: { type: String, required: true, index: true },
  sourceName: { type: String, required: true, maxlength: 255 },
}, { timestamps: true });

projectSchema.index({ department: 1, importHash: 1 }, { unique: true });
projectSchema.index({ department: 1, status: 1, importedAt: -1 });

const projectImportDraftSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  projects: [{ key: { type: String, required: true }, name: { type: String, default: '' }, description: { type: String, default: '' } }],
  rows: { type: [mongoose.Schema.Types.Mixed], default: [] },
  tasks: [{
    rowNumber: { type: Number, required: true },
    projectKey: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
  }],
  validationErrors: { type: [mongoose.Schema.Types.Mixed], default: [] },
  assignments: [{
    rowNumber: { type: Number, required: true },
    members: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      responsibility: { type: String, trim: true, maxlength: 300, default: '' },
      description: { type: String, trim: true, maxlength: 2000, default: '' },
    }],
  }],
  importHash: { type: String, required: true },
  sourceName: { type: String, required: true, maxlength: 255 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

projectImportDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
projectImportDraftSchema.index({ owner: 1, importHash: 1 });

export const User = mongoose.model('User', userSchema);
export const ActivitySession = mongoose.model('ActivitySession', activitySessionSchema);
export const ActivityState = mongoose.model('ActivityState', activityStateSchema);
export const ActivityEvent = mongoose.model('ActivityEvent', activityEventSchema);
export const Task = mongoose.model('Task', taskSchema);
export const Team = mongoose.model('Team', teamSchema);
export const TeamTask = mongoose.model('TeamTask', teamTaskSchema);
export const TeamNotification = mongoose.model('TeamNotification', teamNotificationSchema);
export const Notification = TeamNotification;
export const Department = mongoose.model('Department', departmentSchema);
export const TaskResponse = mongoose.model('TaskResponse', taskResponseSchema);
export const TaskHistory = mongoose.model('TaskHistory', taskHistorySchema);
export const AssistantConversation = mongoose.model('AssistantConversation', assistantConversationSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const Meeting = mongoose.model('Meeting', meetingSchema);
export const MeetingRoom = mongoose.model('MeetingRoom', meetingRoomSchema);
export const UserStory = mongoose.model('UserStory', userStorySchema);
export const Project = mongoose.model('Project', projectSchema);
export const ProjectImportDraft = mongoose.model('ProjectImportDraft', projectImportDraftSchema);

export function serializeUser(user) {
  if (!user) return null;
  const dept = user.department;
  const departmentData = dept && typeof dept === 'object' && dept.name
    ? { id: dept._id ? dept._id.toString() : dept.id, name: dept.name }
    : (dept ? { id: dept.toString() } : null);

  return {
    id: user._id ? user._id.toString() : user.id,
    name: user.name,
    username: user.username,
    email: user.email || '',
    phoneNumber: user.phoneNumber || '',
    profileImage: user.profileImage || null,
    role: user.role || 'team_member',
    isActive: user.isActive !== false,
    department: departmentData,
    departmentId: departmentData?.id || (user.department ? user.department.toString() : null),
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
    updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : null,
  };
}

export function serializeTask(task, { includeSubmissions = false } = {}) {
  if (!task) return null;
  const isCompleted = Boolean(task.completed ?? (task.status === 'completed'));
  const ackStatus = task.acknowledgmentStatus || (task.acknowledgedAt ? 'acknowledged' : 'pending');
  const taskStatus = task.status || (isCompleted ? 'completed' : 'assigned');

  const assigneeUser = task.assignee || task.user;
  const assigneeUsers = task.assignees?.length ? task.assignees : (assigneeUser ? [assigneeUser] : []);
  const assignedByUser = task.assignedBy;
  const dept = task.department;

  return {
    id: task._id ? task._id.toString() : task.id,
    title: task.title,
    text: task.title,
    description: task.description || '',
    category: task.category || 'General',
    project: task.project && task.project.name
      ? {
        id: task.project._id?.toString() || task.project.id,
        name: task.project.name || '',
        description: task.project.description || '',
      }
      : (task.project ? { id: task.project.toString(), name: '', description: '' } : null),
    priority: task.priority || 'medium',
    startDate: task.startDate ? new Date(task.startDate).toISOString() : null,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    reminderAt: task.reminderAt ? new Date(task.reminderAt).toISOString() : null,
    acknowledgmentStatus: ackStatus,
    acknowledgedAt: task.acknowledgedAt ? new Date(task.acknowledgedAt).toISOString() : null,
    status: taskStatus,
    completed: isCompleted,
    recurrence: task.recurrence || 'none',
    recurrenceInterval: task.recurrenceInterval || 1,
    submittedAt: task.submittedAt ? new Date(task.submittedAt).toISOString() : null,
    completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
    attachments: task.attachments || [],
    collaborationEnabled: Boolean(task.collaborationEnabled),
    assignees: assigneeUsers.map((user) => ({
      id: user._id ? user._id.toString() : user.id || user.toString(),
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
      profileImage: user.profileImage || null,
      department: user.department?.name || '',
    })),
    contributions: (task.contributions || []).map((contribution) => ({
      user: contribution.user?._id || contribution.user,
      member: contribution.user && typeof contribution.user === 'object' ? {
        id: contribution.user._id?.toString() || contribution.user.id,
        name: contribution.user.name || '',
        username: contribution.user.username || '',
      } : null,
      responsibility: contribution.responsibility || '',
      description: contribution.description || '',
      status: contribution.status || 'todo',
      progress: contribution.progress || 0,
      startDate: contribution.startDate || null,
      dueDate: contribution.dueDate || null,
      completionNotes: contribution.completionNotes || '',
      updatedAt: contribution.updatedAt || null,
    })),
    submissions: (task.submissions || []).map((submission) => ({
      id: submission._id?.toString(),
      submittedBy: submission.submittedBy?._id?.toString() || submission.submittedBy?.toString(),
      submitter: submission.submittedBy && typeof submission.submittedBy === 'object' ? {
        id: submission.submittedBy._id?.toString() || submission.submittedBy.id,
        name: submission.submittedBy.name || '',
      } : null,
      version: submission.version,
      notes: submission.notes || '',
      summary: submission.summary || '',
      attachments: includeSubmissions ? (submission.attachments || []) : (submission.attachments || []).map(({ name }) => ({ name })),
      submittedAt: submission.submittedAt,
      acknowledgedBy: submission.acknowledgedBy?._id?.toString() || submission.acknowledgedBy?.toString() || null,
      acknowledgedAt: submission.acknowledgedAt || null,
      reviewComment: submission.reviewComment || '',
      decision: submission.decision || 'pending',
    })),
    createdAt: task.createdAt ? new Date(task.createdAt).getTime() : Date.now(),
    updatedAt: task.updatedAt ? new Date(task.updatedAt).getTime() : Date.now(),
    assignedAt: task.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
    assignedTo: assigneeUser ? {
      id: assigneeUser._id ? assigneeUser._id.toString() : assigneeUser.id || assigneeUser.toString(),
      name: assigneeUser.name || '',
      username: assigneeUser.username || '',
      email: assigneeUser.email || '',
    } : null,
    assignee: assigneeUser ? {
      id: assigneeUser._id ? assigneeUser._id.toString() : assigneeUser.id || assigneeUser.toString(),
      name: assigneeUser.name || '',
      username: assigneeUser.username || '',
      email: assigneeUser.email || '',
    } : null,
    assignedBy: assignedByUser ? {
      id: assignedByUser._id ? assignedByUser._id.toString() : assignedByUser.id || assignedByUser.toString(),
      name: assignedByUser.name || '',
      username: assignedByUser.username || '',
      email: assignedByUser.email || '',
      role: assignedByUser.role || '',
    } : null,
    dependencies: (task.dependencies || []).map((dependency) => ({
      id: dependency._id ? dependency._id.toString() : dependency.toString(),
      title: dependency.title || '',
    })),
    department: dept && typeof dept === 'object' && dept.name ? {
      id: dept._id ? dept._id.toString() : dept.id,
      name: dept.name,
    } : (dept ? { id: dept.toString() } : null),
    departmentId: dept ? (dept._id ? dept._id.toString() : dept.toString()) : null,
  };
}

export function serializeTeamTask(task, { includeAssignee = false } = {}) {
  const serialized = serializeTask(task);
  return {
    ...serialized,
    teamId: task.team ? (task.team._id ? task.team._id.toString() : task.team.toString()) : null,
    ...(includeAssignee && task.assignee ? {
      assignee: {
        id: task.assignee._id ? task.assignee._id.toString() : task.assignee.toString(),
        name: task.assignee.name || '',
        email: task.assignee.email || '',
        username: task.assignee.username || '',
      },
    } : {}),
  };
}
