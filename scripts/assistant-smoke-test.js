import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import process from 'node:process';
import { AssistantConversation, Task, User } from '../server/models.js';

const baseUrl = `http://127.0.0.1:${process.env.PORT || 4000}/api`;
const suffix = randomBytes(6).toString('hex');
const password = `Assistant-${suffix}-secure`;
const createdUserIds = [];
let createdTaskId;
let conversationId;

async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = response.status === 204 ? '' : await response.text();
  return {
    status: response.status,
    data: text ? JSON.parse(text) : null,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

async function createAccount(name, username) {
  const account = await User.create({
    name,
    username,
    email: `${username}@example.com`,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'team_member',
  });
  createdUserIds.push(account._id);
  const login = await request('/auth/login', {
    method: 'POST',
    body: { identifier: username, password },
  });
  assert.equal(login.status, 200);
  assert.ok(login.cookie);
  return { account, cookie: login.cookie };
}

try {
  assert.ok(process.env.MONGODB_URI, 'MONGODB_URI must be configured.');
  await mongoose.connect(process.env.MONGODB_URI);
  const first = await createAccount('Assistant Test One', `assistant_${suffix}`);
  const second = await createAccount('Assistant Test Two', `assistant_other_${suffix}`);

  await Task.create({
    title: 'Private task belonging to another test account',
    description: 'Must not be visible to the first user assistant.',
    user: second.account._id,
    assignee: second.account._id,
    assignedBy: second.account._id,
  }).then((task) => { createdTaskId = task._id; });

  const unauthenticatedHistory = await request('/assistant/conversations');
  assert.equal(unauthenticatedHistory.status, 401);

  const created = await request('/assistant/conversations', {
    method: 'POST',
    body: {},
    cookie: first.cookie,
  });
  assert.equal(created.status, 201);
  conversationId = created.data.conversation.id;

  const unauthorizedRead = await request(`/assistant/conversations/${conversationId}`, {
    cookie: second.cookie,
  });
  assert.equal(unauthorizedRead.status, 404);

  const invalidChat = await request('/assistant/chat', {
    method: 'POST',
    cookie: first.cookie,
    body: { conversationId: 'invalid-id', message: 'Summarize my workload' },
  });
  assert.equal(invalidChat.status, 400);

  const answer = await request('/assistant/chat', {
    method: 'POST',
    cookie: first.cookie,
    body: { conversationId, message: 'Summarize my current workload' },
  });
  assert.equal(answer.status, 200);
  assert.equal(answer.data.mode, 'rule-based');
  assert.match(answer.data.answer, /\*\*Total:\*\*\s*0/);
  assert.deepEqual(answer.data.taskCards, []);

  const saved = await request(`/assistant/conversations/${conversationId}`, {
    cookie: first.cookie,
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.conversation.messages.length, 2);

  const unauthorizedDelete = await request(`/assistant/conversations/${conversationId}`, {
    method: 'DELETE',
    cookie: second.cookie,
  });
  assert.equal(unauthorizedDelete.status, 404);

  const cleared = await request(`/assistant/conversations/${conversationId}/messages`, {
    method: 'DELETE',
    cookie: first.cookie,
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.data.conversation.messageCount, 0);

  const deleted = await request(`/assistant/conversations/${conversationId}`, {
    method: 'DELETE',
    cookie: first.cookie,
  });
  assert.equal(deleted.status, 204);
  conversationId = null;
  console.log('Assistant smoke test passed: authentication, role-scoped workload, persistent chats, history ownership, clear, and delete.');
} finally {
  if (conversationId) {
    await AssistantConversation.deleteOne({ _id: conversationId });
  }
  if (createdUserIds.length) {
    await AssistantConversation.deleteMany({ user: { $in: createdUserIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
  }
  if (createdTaskId) await Task.deleteOne({ _id: createdTaskId });
  if (mongoose.connection.readyState) await mongoose.disconnect();
}
