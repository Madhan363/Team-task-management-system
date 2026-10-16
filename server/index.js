import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import assistantRoutes from './routes/assistantRoutes.js';
import auditLogRoutes from './routes/auditLogRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import adminRoutes from './adminRoutes.js';
import teamRoutes from './teamRoutes.js';

import { requireUser, requireAdmin } from './middleware/auth.js';
import { createFallbackSuggestions } from './goalSuggestions.js';
import { sendMeetingReminders } from './controllers/meetingController.js';
import { closeExpiredActivitySessions } from './services/activityTracking.js';

const { MONGODB_URI, JWT_SECRET } = process.env;
const PORT = Number(process.env.PORT || 4000);
const SERVER_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIRECTORY = path.resolve(SERVER_DIRECTORY, '../dist');
const FRONTEND_ENTRY = path.join(DIST_DIRECTORY, 'index.html');

if (!MONGODB_URI || !JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('Set MONGODB_URI and a JWT_SECRET of at least 32 characters in .env.');
}

const app = express();

app.use('/api/auth/profile', express.json({ limit: '2mb' }));
app.use('/api/tasks', express.json({ limit: '2mb' }));
app.use('/api/projects', express.json({ limit: '7mb' }));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// Health check
app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Standard REST endpoints for TaskFlow
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/projects', projectRoutes);

// Legacy and backwards-compatible routes for existing smoke tests and modules
app.use('/api/team', requireUser, teamRoutes);
app.use('/api/admin', requireUser, requireAdmin, adminRoutes);

// AI Assistant endpoint
app.post('/api/assistant/suggestions', requireUser, async (request, response) => {
  const goal = typeof request.body?.goal === 'string' ? request.body.goal.trim() : '';
  if (goal.length < 3 || goal.length > 500) {
    response.status(400).json({ error: 'Enter a goal between 3 and 500 characters.' });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    response.json({
      tasks: createFallbackSuggestions(goal),
      source: 'fallback',
    });
    return;
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        max_output_tokens: 1200,
        input: [
          {
            role: 'developer',
            content: 'Break the user’s goal into 3 to 6 concrete, manageable next steps. Return a JSON object with a "tasks" array. Each task must include an actionable title under 120 characters, a concise description, a priority (low, medium, or high), and an optional category.',
          },
          { role: 'user', content: goal },
        ],
        text: { format: { type: 'json_object' } },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      console.error(`AI goal breakdown request failed with HTTP ${upstream.status}.`);
      response.json({
        tasks: createFallbackSuggestions(goal),
        source: 'fallback',
      });
      return;
    }

    const payload = await upstream.json();
    const responseText = payload.output_text || (payload.output || [])
      .flatMap((item) => item.content || [])
      .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('');
    const parsedResponse = responseText ? JSON.parse(responseText) : payload;
    const tasks = Array.isArray(parsedResponse?.tasks)
      ? parsedResponse.tasks.filter((task) => (
        task && typeof task.title === 'string' && task.title.trim()
      ))
      : [];
    if (!tasks.length) {
      console.error('AI goal breakdown returned no valid tasks; using fallback suggestions.');
      response.json({
        tasks: createFallbackSuggestions(goal),
        source: 'fallback',
      });
      return;
    }
    response.json({ tasks, source: 'openai' });
  } catch (error) {
    console.error('AI assistant error, using fallback:', error);
    response.json({
      tasks: createFallbackSuggestions(goal),
      source: 'fallback',
    });
  }
});

// 404 for unmatched API routes
app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API endpoint not found.' });
});

// Static assets
app.use(express.static(DIST_DIRECTORY));

// SPA catch-all fallback
app.get('/{*path}', (request, response, next) => {
  if (!request.accepts('html')) {
    next();
    return;
  }
  if (!existsSync(FRONTEND_ENTRY)) {
    response
      .status(503)
      .type('text/plain')
      .send('Frontend build not found. Run "npm run build", then restart the server.');
    return;
  }
  response.sendFile(FRONTEND_ENTRY);
});

app.use((_request, response) => {
  response.status(404).type('text/plain').send('Not found.');
});

// Global error handler
app.use((error, _request, response, next) => {
  console.error('API request error:', error);
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error.type === 'entity.too.large') {
    response.status(413).json({ error: 'Payload too large.' });
    return;
  }
  response.status(500).json({ error: 'The server could not complete the request.' });
});

await mongoose.connect(MONGODB_URI);
const activitySessionCleanupInterval = setInterval(() => {
  closeExpiredActivitySessions().catch((error) => {
    console.error('Failed to close expired activity sessions:', error);
  });
}, 60_000);
activitySessionCleanupInterval.unref();
closeExpiredActivitySessions().catch((error) => {
  console.error('Failed to close expired activity sessions:', error);
});
const reminderInterval = setInterval(() => {
  sendMeetingReminders().catch((error) => {
    console.error('Failed to send meeting reminders:', error);
  });
}, 60_000);
reminderInterval.unref();
sendMeetingReminders().catch((error) => {
  console.error('Failed to send meeting reminders:', error);
});
app.listen(PORT, () => {
  console.log(`TaskFlow Server listening on http://localhost:${PORT}`);
});
