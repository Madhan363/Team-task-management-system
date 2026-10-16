import jwt from 'jsonwebtoken';
import process from 'node:process';
import { ActivitySession, User } from '../models.js';

export const COOKIE_NAME = 'todo_session';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

export function getJwtSecret() {
  return process.env.JWT_SECRET;
}

export function setSessionCookie(response, user, activitySessionId) {
  const token = jwt.sign({
    sub: user._id.toString(),
    ...(activitySessionId ? { sid: activitySessionId.toString() } : {}),
  }, getJwtSecret(), {
    expiresIn: SESSION_SECONDS,
  });
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_SECONDS * 1000,
    path: '/',
  });
  return token;
}

export function clearSessionCookie(response) {
  response.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

export async function requireUser(request, response, next) {
  try {
    let token = request.cookies?.[COOKIE_NAME];
    if (!token && request.headers.authorization?.startsWith('Bearer ')) {
      token = request.headers.authorization.slice(7);
    }

    if (!token) {
      response.status(401).json({ error: 'Sign in to continue.' });
      return;
    }

    const payload = jwt.verify(token, getJwtSecret());
    const user = await User.findById(payload.sub).populate('department', 'name');
    if (!user || user.isActive === false) {
      clearSessionCookie(response);
      response.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });
      return;
    }

    if (payload.sid) {
      const activitySession = await ActivitySession.findOne({
        _id: payload.sid,
        user: user._id,
        endedAt: null,
      });
      if (!activitySession) {
        clearSessionCookie(response);
        response.status(401).json({ error: 'Your login session has ended. Please sign in again.' });
        return;
      }
      request.activitySession = activitySession;
    }

    request.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      clearSessionCookie(response);
      response.status(401).json({ error: 'Your session expired. Please sign in again.' });
      return;
    }
    next(error);
  }
}

export async function optionalUser(request, _response, next) {
  try {
    let token = request.cookies?.[COOKIE_NAME];
    if (!token && request.headers.authorization?.startsWith('Bearer ')) {
      token = request.headers.authorization.slice(7);
    }

    if (token) {
      const payload = jwt.verify(token, getJwtSecret());
      const user = await User.findById(payload.sub).populate('department', 'name');
      if (user && user.isActive !== false) {
        request.user = user;
      }
    }
  } catch {
    // Session token invalid or expired; continue without authenticated user
  }
  next();
}

export function requireAdmin(request, response, next) {
  if (request.user?.role !== 'admin') {
    response.status(403).json({ error: 'Administrator access is required.' });
    return;
  }
  next();
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      response.status(403).json({
        error: `This action requires one of the following roles: ${roles.join(', ')}.`,
      });
      return;
    }
    next();
  };
}
