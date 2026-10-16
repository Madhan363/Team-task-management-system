import {
  ACTIVITY_INACTIVITY_MS,
  ACTIVITY_PRESENCE_INTERVAL_MS,
  recordActivity,
  recordPresence,
  startActivitySession,
} from '../services/activityTracking.js';
import {
  ActivityEvent,
  ActivitySession,
  ActivityState,
  Department,
  User,
} from '../models.js';
import { setSessionCookie } from '../middleware/auth.js';

const DAY_MS = 24 * 60 * 60_000;

function utcDayStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function weekStart(date) {
  const start = utcDayStart(date);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

function intersect(start, end, rangeStart, rangeEnd) {
  const clippedStart = Math.max(start.getTime(), rangeStart.getTime());
  const clippedEnd = Math.min(end.getTime(), rangeEnd.getTime());
  return clippedEnd > clippedStart ? [clippedStart, clippedEnd] : null;
}

function mergeDuration(intervals) {
  if (!intervals.length) return 0;
  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [start, end] = intervals[0];
  intervals.slice(1).forEach(([nextStart, nextEnd]) => {
    if (nextStart <= end) end = Math.max(end, nextEnd);
    else {
      total += end - start;
      [start, end] = [nextStart, nextEnd];
    }
  });
  return total + end - start;
}

function seconds(milliseconds) {
  return Math.max(0, Math.floor(milliseconds / 1000));
}

function effectiveSessionEnd(session, now) {
  if (session.endedAt) return { date: session.endedAt, estimated: false };
  if (now - session.lastSeenAt > ACTIVITY_PRESENCE_INTERVAL_MS * 3) {
    return {
      date: new Date(Math.min(
        session.lastSeenAt.getTime() + ACTIVITY_PRESENCE_INTERVAL_MS,
        session.tokenExpiresAt.getTime(),
      )),
      estimated: true,
    };
  }
  if (now >= session.tokenExpiresAt) {
    return { date: session.tokenExpiresAt, estimated: true };
  }
  return { date: now, estimated: false };
}

export async function startTrackedSession(request, response, next) {
  try {
    const session = request.activitySession || await startActivitySession(request.user);
    if (!request.activitySession) setSessionCookie(response, request.user, session._id);
    response.status(200).json({
      sessionId: session._id.toString(),
      startedAt: session.startedAt,
      inactivityThresholdSeconds: Math.floor(ACTIVITY_INACTIVITY_MS / 1000),
    });
  } catch (error) {
    next(error);
  }
}

export async function getActivityReport(request, response, next) {
  try {
    const now = new Date();
    const today = utcDayStart(now);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const currentWeekStart = weekStart(now);
    const reportStart = currentWeekStart < monthStart ? currentWeekStart : monthStart;
    const period = request.query.period || 'month';
    if (!['today', 'week', 'month'].includes(period)) {
      response.status(400).json({ error: 'Period must be today, week, or month.' });
      return;
    }
    const historyStart = period === 'today'
      ? today
      : period === 'week' ? currentWeekStart : monthStart;

    let users;
    if (request.user.role === 'admin') {
      users = await User.find({ isActive: { $ne: false } })
        .select('name username role department')
        .populate('department', 'name')
        .sort({ name: 1 });
    } else if (request.user.role === 'team_leader') {
      const department = await Department.findOne({ teamLeader: request.user._id, isActive: true });
      if (!department) {
        response.status(403).json({ error: 'A Team Leader can only view activity for their authorized department.' });
        return;
      }
      users = await User.find({
        isActive: { $ne: false },
        $or: [
          { _id: request.user._id },
          { department: department._id, role: 'team_member' },
        ],
      })
        .select('name username role department')
        .populate('department', 'name')
        .sort({ name: 1 });
    } else {
      users = [request.user];
    }

    const userIds = users.map((user) => user._id);
    const [events, sessions, states] = await Promise.all([
      ActivityEvent.find({
        user: { $in: userIds },
        day: { $gte: dayKey(reportStart), $lte: dayKey(today) },
      }).select('user day activeMilliseconds'),
      ActivitySession.find({
        user: { $in: userIds },
        startedAt: { $lt: now },
        $or: [{ endedAt: null }, { endedAt: { $gte: reportStart } }],
      }).sort({ startedAt: -1 }).limit(5000),
      ActivityState.find({ user: { $in: userIds } }).select('user lastActivityAt'),
    ]);

    const dates = [];
    for (let date = new Date(reportStart); date <= today; date = new Date(date.getTime() + DAY_MS)) {
      dates.push(dayKey(date));
    }
    const dailyActive = new Map(dates.map((date) => [date, new Map()]));
    events.forEach((event) => {
      const dateUsers = dailyActive.get(event.day);
      if (!dateUsers) return;
      const id = event.user.toString();
      dateUsers.set(id, (dateUsers.get(id) || 0) + event.activeMilliseconds);
    });

    const dailySessionIntervals = new Map(dates.map((date) => [date, new Map()]));
    const sessionRows = sessions.map((session) => {
      const { date: end, estimated } = effectiveSessionEnd(session, now);
      for (const date of dates) {
        const rangeStart = new Date(`${date}T00:00:00.000Z`);
        const interval = intersect(session.startedAt, end, rangeStart, new Date(rangeStart.getTime() + DAY_MS));
        if (interval) {
          const id = session.user.toString();
          const dayUsers = dailySessionIntervals.get(date);
          const intervals = dayUsers.get(id) || [];
          intervals.push(interval);
          dayUsers.set(id, intervals);
        }
      }
      return {
        id: session._id.toString(),
        userId: session.user.toString(),
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        effectiveEndedAt: end,
        lastActivityAt: session.lastActivityAt,
        durationSeconds: seconds(end - session.startedAt),
        activeSeconds: seconds(session.activeMilliseconds),
        status: session.endedAt ? 'Ended' : (estimated ? 'Estimated end' : 'Open'),
        estimatedEnd: estimated,
      };
    });

    const openSessionEnds = new Map();
    sessionRows.forEach((session) => {
      if (session.endedAt) return;
      const existingEnd = openSessionEnds.get(session.userId);
      if (!existingEnd || session.effectiveEndedAt > existingEnd) {
        openSessionEnds.set(session.userId, session.effectiveEndedAt);
      }
    });
    states.forEach((state) => {
      const id = state.user.toString();
      const sessionEnd = openSessionEnds.get(id);
      if (!sessionEnd || state.lastActivityAt < reportStart) return;
      const activeEnd = Math.min(
        now.getTime(),
        state.lastActivityAt.getTime() + ACTIVITY_INACTIVITY_MS,
        sessionEnd.getTime(),
      );
      if (activeEnd <= state.lastActivityAt.getTime()) return;
      let cursor = new Date(state.lastActivityAt);
      while (cursor.getTime() < activeEnd) {
        const nextDay = new Date(Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate() + 1,
        ));
        const segmentEnd = Math.min(activeEnd, nextDay.getTime());
        const date = dayKey(cursor);
        if (dailyActive.has(date)) {
          const values = dailyActive.get(date);
          values.set(id, (values.get(id) || 0) + segmentEnd - cursor.getTime());
        }
        cursor = new Date(segmentEnd);
      }
    });

    const userRows = users.map((user) => {
      const id = user._id.toString();
      const activeOn = (date) => dailyActive.get(date)?.get(id) || 0;
      const sessionOn = (date) => mergeDuration(dailySessionIntervals.get(date)?.get(id) || []);
      const total = (from, mapper) => dates.reduce(
        (sum, date) => (date >= from ? sum + mapper(date) : sum),
        0,
      );
      return {
        id,
        name: user.name,
        username: user.username,
        role: user.role,
        department: user.department?.name || '',
        todayActiveSeconds: seconds(activeOn(dayKey(today))),
        weekActiveSeconds: seconds(total(dayKey(currentWeekStart), activeOn)),
        monthActiveSeconds: seconds(total(dayKey(monthStart), activeOn)),
        todaySessionSeconds: seconds(sessionOn(dayKey(today))),
        weekSessionSeconds: seconds(total(dayKey(currentWeekStart), sessionOn)),
        monthSessionSeconds: seconds(total(dayKey(monthStart), sessionOn)),
      };
    });

    const own = userRows.find((row) => row.id === request.user._id.toString());
    const totals = request.user.role === 'admin' || request.user.role === 'team_leader'
      ? userRows.reduce((sum, row) => ({
        todayActiveSeconds: sum.todayActiveSeconds + row.todayActiveSeconds,
        weekActiveSeconds: sum.weekActiveSeconds + row.weekActiveSeconds,
        monthActiveSeconds: sum.monthActiveSeconds + row.monthActiveSeconds,
        todaySessionSeconds: sum.todaySessionSeconds + row.todaySessionSeconds,
        weekSessionSeconds: sum.weekSessionSeconds + row.weekSessionSeconds,
        monthSessionSeconds: sum.monthSessionSeconds + row.monthSessionSeconds,
      }), {
        todayActiveSeconds: 0,
        weekActiveSeconds: 0,
        monthActiveSeconds: 0,
        todaySessionSeconds: 0,
        weekSessionSeconds: 0,
        monthSessionSeconds: 0,
      })
      : own;

    const daily = dates.map((date) => {
      const active = userRows.reduce(
        (sum, user) => sum + (dailyActive.get(date)?.get(user.id) || 0),
        0,
      );
      const duration = userRows.reduce(
        (sum, user) => sum + mergeDuration(dailySessionIntervals.get(date)?.get(user.id) || []),
        0,
      );
      return { date, activeSeconds: seconds(active), sessionDurationSeconds: seconds(duration) };
    });

    const visibleSessions = sessionRows
      .filter((session) => session.effectiveEndedAt >= historyStart)
      .slice(0, 200)
      .map((session) => ({
        ...session,
        userName: userRows.find((user) => user.id === session.userId)?.name || 'Unknown user',
      }));
    response.json({
      timezone: 'UTC',
      asOf: now.toISOString(),
      period,
      inactivityThresholdSeconds: Math.floor(ACTIVITY_INACTIVITY_MS / 1000),
      presenceIntervalSeconds: Math.floor(ACTIVITY_PRESENCE_INTERVAL_MS / 1000),
      totals,
      daily: daily.filter((item) => item.date >= dayKey(historyStart)),
      users: request.user.role === 'admin' || request.user.role === 'team_leader' ? userRows : [],
      sessions: visibleSessions,
      note: 'Active time is an estimate based only on interactions inside this application. It is not a measure of productivity. Session duration is signed-in wall-clock time and may be estimated when a browser closes without logging out.',
    });
  } catch (error) {
    next(error);
  }
}

export async function postActivity(request, response, next) {
  try {
    if (!request.activitySession) {
      response.status(401).json({ error: 'Sign in again to start a tracked login session.' });
      return;
    }
    const { activeMilliseconds } = await recordActivity(request.activitySession, request.user._id);
    response.json({ recorded: true, activeSecondsAdded: seconds(activeMilliseconds) });
  } catch (error) {
    next(error);
  }
}

export async function postPresence(request, response, next) {
  try {
    if (!request.activitySession) {
      response.status(401).json({ error: 'Sign in again to continue your tracked login session.' });
      return;
    }
    if (!await recordPresence(request.activitySession, request.user._id)) {
      response.status(401).json({ error: 'Your login session has ended.' });
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
}
