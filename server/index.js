import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { User, Task, serializeUser, serializeTask } from './models.js';

const { MONGODB_URI, JWT_SECRET } = process.env;
const PORT = Number(process.env.PORT || 4000);
const COOKIE_NAME = 'todo_session';
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

if (!MONGODB_URI || !JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('Set MONGODB_URI and a JWT_SECRET of at least 32 characters in .env.');
}

const app = express();
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

function setSessionCookie(response, user) {
  const token = jwt.sign({ sub: user._id.toString() }, JWT_SECRET, {
    expiresIn: SESSION_DURATION_SECONDS,
  });
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DURATION_SECONDS * 1000,
    path: '/',
  });
}

async function requireUser(request, response, next) {
  try {
    const token = request.cookies[COOKIE_NAME];
    if (!token) {
      response.status(401).json({ error: 'Please sign in to continue.' });
      return;
    }
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) {
      response.status(401).json({ error: 'Session is no longer valid. Please sign in again.' });
      return;
    }
    request.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      response.status(401).json({ error: 'Session expired. Please sign in again.' });
      return;
    }
    next(error);
  }
}

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.post('/api/auth/register', async (request, response, next) => {
  try {
    const name = typeof request.body.name === 'string' ? request.body.name.trim() : '';
    const username = typeof request.body.username === 'string'
      ? request.body.username.trim().toLowerCase()
      : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const theme = typeof request.body.theme === 'string' ? request.body.theme : 'aurora';

    if (!name || name.length > 80) {
      response.status(400).json({ error: 'Display name is required and must be under 80 characters.' });
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      response.status(400).json({ error: 'Username must be 3–30 characters using letters, numbers, or underscores.' });
      return;
    }
    if (password.length < 4 || password.length > 100) {
      response.status(400).json({ error: 'Password must be at least 4 characters.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, username, passwordHash, theme });
    await Task.create({
      user: user._id,
      text: `Welcome, ${user.name}! Start organizing your private tasks 🌟`,
    });
    setSessionCookie(response, user);
    response.status(201).json({ user: serializeUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'Username is already taken. Please choose another.' });
      return;
    }
    next(error);
  }
});

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const username = typeof request.body.username === 'string'
      ? request.body.username.trim().toLowerCase()
      : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      response.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    setSessionCookie(response, user);
    response.json({ user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/session', requireUser, (request, response) => {
  response.json({ user: serializeUser(request.user) });
});

app.post('/api/auth/logout', (_request, response) => {
  response.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', path: '/' });
  response.status(204).end();
});

app.get('/api/tasks', requireUser, async (request, response, next) => {
  try {
    const tasks = await Task.find({ user: request.user._id }).sort({ createdAt: -1 });
    response.json({ tasks: tasks.map(serializeTask) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks', requireUser, async (request, response, next) => {
  try {
    const text = typeof request.body.text === 'string' ? request.body.text.trim() : '';
    if (!text || text.length > 500) {
      response.status(400).json({ error: 'Task text is required and must be under 500 characters.' });
      return;
    }
    const task = await Task.create({ user: request.user._id, text });
    response.status(201).json({ task: serializeTask(task) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/tasks/:id', requireUser, async (request, response, next) => {
  try {
    if (typeof request.body.completed !== 'boolean') {
      response.status(400).json({ error: 'Task completion status must be true or false.' });
      return;
    }
    const task = await Task.findOneAndUpdate(
      { _id: request.params.id, user: request.user._id },
      { completed: request.body.completed },
      { new: true, runValidators: true },
    );
    if (!task) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    response.json({ task: serializeTask(task) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tasks/completed', requireUser, async (request, response, next) => {
  try {
    await Task.deleteMany({ user: request.user._id, completed: true });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tasks/:id', requireUser, async (request, response, next) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: request.params.id,
      user: request.user._id,
    });
    if (!task) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, next) => {
  void next;
  console.error('API request failed:', error);
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    response.status(400).json({ error: 'The request contains invalid data.' });
    return;
  }
  response.status(500).json({ error: 'The server could not complete the request.' });
});

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.use(express.static(path.join(projectRoot, 'dist')));
app.use((request, response, next) => {
  if (request.path.startsWith('/api/') || request.method !== 'GET') {
    next();
    return;
  }
  response.sendFile(path.join(projectRoot, 'dist', 'index.html'), (error) => {
    if (error) next(error);
  });
});

await mongoose.connect(MONGODB_URI);
app.listen(PORT, () => {
  console.log(`Todo app API listening on http://localhost:${PORT}`);
});
