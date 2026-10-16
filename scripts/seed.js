import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import process from 'node:process';
import {
  Department,
  Notification,
  Task,
  TaskHistory,
  TaskResponse,
  User,
} from '../server/models.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/todoapp';

async function seed() {
  console.log('Connecting to MongoDB at:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  console.log('Checking existing accounts...');

  const passwordHash = await bcrypt.hash('TaskFlow@2026', 12);
  const adminPasswordHash = await bcrypt.hash('Admin@12345', 12);
  const leaderPasswordHash = await bcrypt.hash('Leader@12345', 12);
  const memberPasswordHash = await bcrypt.hash('Member@12345', 12);

  // 1. Ensure Admin exists
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = await User.findOne({ username: 'admin' });
  }
  if (!admin) {
    admin = await User.create({
      name: 'System Administrator',
      username: 'admin',
      email: 'admin@taskflow.local',
      passwordHash: adminPasswordHash,
      role: 'admin',
      isActive: true,
    });
    console.log('Created Admin account: username="admin", password="Admin@12345"');
  } else {
    admin.role = 'admin';
    admin.isActive = true;
    admin.passwordHash = adminPasswordHash;
    await admin.save();
    console.log(`Updated Admin user: "${admin.username}", password reset to "Admin@12345"`);
  }

  // 2. Ensure Team Leader exists
  let leader = await User.findOne({ username: 'leader_tech' });
  if (!leader) {
    leader = await User.create({
      name: 'Sarah Connor (Team Leader)',
      username: 'leader_tech',
      email: 'leader.tech@taskflow.local',
      passwordHash: leaderPasswordHash,
      role: 'team_leader',
      isActive: true,
    });
    console.log('Created Team Leader: username="leader_tech", password="Leader@12345"');
  } else {
    leader.role = 'team_leader';
    leader.isActive = true;
    leader.passwordHash = leaderPasswordHash;
    await leader.save();
  }

  // 3. Ensure Department exists
  let dept = await Department.findOne({ name: 'Engineering & Product' });
  if (!dept) {
    dept = await Department.create({
      name: 'Engineering & Product',
      description: 'Core software development, product architecture, and release delivery.',
      teamLeader: leader._id,
      isActive: true,
    });
    console.log('Created Department: "Engineering & Product"');
  } else {
    dept.teamLeader = leader._id;
    await dept.save();
  }

  leader.department = dept._id;
  await leader.save();

  // Create additional departments if none
  if (await Department.countDocuments() < 2) {
    await Department.create({
      name: 'UI/UX Design',
      description: 'Interface design, design systems, and user experience research.',
      teamLeader: leader._id,
      isActive: true,
    });
  }

  // 4. Ensure Team Members exist
  let member1 = await User.findOne({ username: 'member_alex' });
  if (!member1) {
    member1 = await User.create({
      name: 'Alex Rivera',
      username: 'member_alex',
      email: 'alex.rivera@taskflow.local',
      passwordHash: memberPasswordHash,
      role: 'team_member',
      department: dept._id,
      isActive: true,
    });
    console.log('Created Team Member: username="member_alex", password="Member@12345"');
  } else {
    member1.department = dept._id;
    member1.role = 'team_member';
    member1.passwordHash = memberPasswordHash;
    await member1.save();
  }

  let member2 = await User.findOne({ username: 'member_priya' });
  if (!member2) {
    member2 = await User.create({
      name: 'Priya Sharma',
      username: 'member_priya',
      email: 'priya.sharma@taskflow.local',
      passwordHash: memberPasswordHash,
      role: 'team_member',
      department: dept._id,
      isActive: true,
    });
    console.log('Created Team Member: username="member_priya", password="Member@12345"');
  } else {
    member2.department = dept._id;
    member2.role = 'team_member';
    member2.passwordHash = memberPasswordHash;
    await member2.save();
  }

  // 5. Seed sample tasks if department has few tasks
  const existingTasks = await Task.countDocuments({ department: dept._id });
  if (existingTasks < 4) {
    console.log('Seeding sample role-based workflow tasks...');

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Task 1: Awaiting acknowledgment
    const t1 = await Task.create({
      title: 'Implement Dark Navy Sidebar Navigation Layout',
      description: 'Build the collapsible, responsive left sidebar navigation for TaskFlow with role-specific items and icons.',
      assignedBy: leader._id,
      assignee: member1._id,
      user: member1._id,
      department: dept._id,
      priority: 'high',
      startDate: now,
      dueDate: inThreeDays,
      acknowledgmentStatus: 'pending',
      status: 'assigned',
    });
    await TaskHistory.create({
      task: t1._id,
      changedBy: leader._id,
      oldStatus: '',
      newStatus: 'assigned',
      comment: 'Assigned task to Alex Rivera. Initial acknowledgment pending.',
    });
    await Notification.create({
      recipient: member1._id,
      task: t1._id,
      eventKey: `seed-notif-1-${Date.now()}`,
      title: 'New Task Assigned',
      message: `${leader.name} assigned you a new task: "${t1.title}".`,
      isRead: false,
    });

    // Task 2: In progress
    const t2 = await Task.create({
      title: 'Configure MongoDB Aggregation for Admin Summary Stats',
      description: 'Write controller endpoints to compute real-time metrics for users, tasks, and department distributions.',
      assignedBy: leader._id,
      assignee: member1._id,
      user: member1._id,
      department: dept._id,
      priority: 'medium',
      startDate: yesterday,
      dueDate: tomorrow,
      acknowledgmentStatus: 'acknowledged',
      acknowledgedAt: yesterday,
      status: 'in_progress',
    });
    await TaskHistory.create({
      task: t2._id,
      changedBy: member1._id,
      oldStatus: 'assigned',
      newStatus: 'in_progress',
      comment: 'Alex acknowledged and started working on the MongoDB aggregations.',
    });

    // Task 3: Submitted for review
    const t3 = await Task.create({
      title: 'Implement Interactive Logout Confirmation Modal',
      description: 'Add modal popup preventing accidental logout with "Yes, Logout" and "Cancel" buttons.',
      assignedBy: leader._id,
      assignee: member2._id,
      user: member2._id,
      department: dept._id,
      priority: 'high',
      startDate: yesterday,
      dueDate: tomorrow,
      acknowledgmentStatus: 'acknowledged',
      acknowledgedAt: yesterday,
      status: 'submitted_review',
      submittedAt: now,
    });
    await TaskHistory.create({
      task: t3._id,
      changedBy: member2._id,
      oldStatus: 'in_progress',
      newStatus: 'submitted_review',
      comment: 'Completed implementation and test suite. Submitted for leader review.',
    });
    await Notification.create({
      recipient: leader._id,
      task: t3._id,
      eventKey: `seed-notif-2-${Date.now()}`,
      title: 'Task Submitted for Review',
      message: `${member2.name} submitted "${t3.title}" for your review.`,
      isRead: false,
    });

    // Task 4: Completed
    const t4 = await Task.create({
      title: 'Design System Color Palette Tokens',
      description: 'Establish consistent palette tokens: navy sidebar, emerald active badges, amber pending, red overdue.',
      assignedBy: leader._id,
      assignee: member2._id,
      user: member2._id,
      department: dept._id,
      priority: 'low',
      startDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      dueDate: yesterday,
      acknowledgmentStatus: 'acknowledged',
      acknowledgedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      status: 'completed',
      completed: true,
      submittedAt: yesterday,
      completedAt: now,
    });
    await TaskHistory.create({
      task: t4._id,
      changedBy: leader._id,
      oldStatus: 'submitted_review',
      newStatus: 'completed',
      comment: 'Reviewed and approved by Sarah Connor.',
    });
  }

  console.log('Seed completed successfully!');
  console.log('----------------------------------------------------');
  console.log('Credentials Summary:');
  console.log('1. Admin:       Username: admin        Password: Admin@12345');
  console.log('2. Team Leader: Username: leader_tech  Password: Leader@12345');
  console.log('3. Team Member: Username: member_alex  Password: Member@12345');
  console.log('4. Team Member: Username: member_priya Password: Member@12345');
  console.log('----------------------------------------------------');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
