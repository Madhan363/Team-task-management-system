import { ActivityEvent, ActivitySession, ActivityState } from '../models.js';
import process from 'node:process';

function readDuration(name, fallback, maximum) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 10_000 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 10000 and ${maximum} milliseconds.`);
  }
  return parsed;
}

export const ACTIVITY_INACTIVITY_MS = readDuration('ACTIVITY_INACTIVITY_MS', 5 * 60_000, 60 * 60_000);
export const ACTIVITY_PRESENCE_INTERVAL_MS = readDuration('ACTIVITY_PRESENCE_INTERVAL_MS', 2 * 60_000, 5 * 60_000);

function utcDay(date) {
  return date.toISOString().slice(0, 10);
}

async function createEventRecords({ userId, sessionId, kind, startedAt, endedAt, activeMilliseconds }) {
  const events = [];
  let segmentStart = new Date(startedAt);
  const segmentEnd = new Date(endedAt);
  const duration = Math.max(0, activeMilliseconds || 0);

  if (segmentStart.getTime() === segmentEnd.getTime()) {
    events.push({
      user: userId,
      session: sessionId,
      kind,
      day: utcDay(segmentEnd),
      startedAt: segmentStart,
      endedAt: segmentEnd,
      activeMilliseconds: duration,
    });
  } else {
    while (segmentStart < segmentEnd) {
      const nextDay = new Date(Date.UTC(
        segmentStart.getUTCFullYear(),
        segmentStart.getUTCMonth(),
        segmentStart.getUTCDate() + 1,
      ));
      const segmentEndForDay = segmentEnd < nextDay ? segmentEnd : nextDay;
      const span = segmentEndForDay.getTime() - segmentStart.getTime();
      events.push({
        user: userId,
        session: sessionId,
        kind,
        day: utcDay(segmentStart),
        startedAt: new Date(segmentStart),
        endedAt: new Date(segmentEndForDay),
        activeMilliseconds: duration
          ? Math.min(duration, Math.max(0, segmentEndForDay.getTime() - Math.max(segmentStart.getTime(), segmentEnd.getTime() - duration)))
          : 0,
      });
      segmentStart = segmentEndForDay;
      if (span <= 0) break;
    }
  }

  await ActivityEvent.insertMany(events);
}

export async function startActivitySession(user) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
  const session = await ActivitySession.create({
    user: user._id,
    startedAt: now,
    lastActivityAt: now,
    lastSeenAt: now,
    tokenExpiresAt: expiresAt,
  });

  await ActivityState.findOneAndUpdate(
    { user: user._id },
    { $set: { lastActivityAt: now }, $setOnInsert: { user: user._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await createEventRecords({
    userId: user._id,
    sessionId: session._id,
    kind: 'login',
    startedAt: now,
    endedAt: now,
    activeMilliseconds: 0,
  });
  return session;
}

async function recordPulse({ userId, session, kind = 'activity', now = new Date() }) {
  let state = await ActivityState.findOne({ user: userId });
  if (!state) {
    try {
      state = await ActivityState.create({ user: userId, lastActivityAt: now });
    } catch (error) {
      if (error.code !== 11000) throw error;
      state = await ActivityState.findOne({ user: userId });
    }
  }

  let pulseStart;
  let activeMilliseconds;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (!state) throw new Error('Could not initialize activity state.');
    const previousAt = state.lastActivityAt;
    const elapsed = Math.max(0, now.getTime() - previousAt.getTime());
    activeMilliseconds = Math.min(elapsed, ACTIVITY_INACTIVITY_MS);
    pulseStart = new Date(now.getTime() - activeMilliseconds);
    const updated = await ActivityState.findOneAndUpdate(
      { _id: state._id, lastActivityAt: previousAt },
      { $set: { lastActivityAt: now } },
      { new: true },
    );
    if (updated) {
      break;
    }
    state = await ActivityState.findOne({ user: userId });
    if (attempt === 4) throw new Error('Could not safely record activity due to concurrent updates.');
  }

  const sessionUpdate = await ActivitySession.updateOne(
    { _id: session._id, user: userId, endedAt: null },
    {
      $set: { lastActivityAt: now, lastSeenAt: now },
      $inc: { activeMilliseconds },
    },
  );
  if (!sessionUpdate.matchedCount) {
    throw new Error('The activity session is no longer open.');
  }
  await createEventRecords({
    userId,
    sessionId: session._id,
    kind,
    startedAt: pulseStart,
    endedAt: now,
    activeMilliseconds,
  });
  return { activeMilliseconds };
}

export async function recordActivity(session, userId) {
  return recordPulse({ userId, session });
}

export async function recordLogout(session, userId) {
  const now = new Date();
  const result = await recordPulse({ userId, session, kind: 'logout', now });
  await ActivitySession.updateOne(
    { _id: session._id, user: userId, endedAt: null },
    { $set: { endedAt: now, endReason: 'logout', lastSeenAt: now } },
  );
  return result;
}

export async function recordPresence(session, userId) {
  const now = new Date();
  const updated = await ActivitySession.updateOne(
    { _id: session._id, user: userId, endedAt: null },
    { $set: { lastSeenAt: now } },
  );
  return updated.matchedCount > 0;
}

export async function closeExpiredActivitySessions() {
  const now = new Date();
  const expiredSessions = await ActivitySession.find({
    endedAt: null,
    tokenExpiresAt: { $lte: now },
  }).select('_id user tokenExpiresAt');

  for (const session of expiredSessions) {
    const result = await ActivitySession.updateOne(
      { _id: session._id, endedAt: null, tokenExpiresAt: { $lte: now } },
      { $set: { endedAt: session.tokenExpiresAt, endReason: 'expired' } },
    );
    if (result.modifiedCount) {
      await createEventRecords({
        userId: session.user,
        sessionId: session._id,
        kind: 'expired',
        startedAt: session.tokenExpiresAt,
        endedAt: session.tokenExpiresAt,
        activeMilliseconds: 0,
      });
    }
  }
}
