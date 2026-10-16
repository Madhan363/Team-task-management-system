import bcrypt from 'bcryptjs';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { ActivitySession, Department, User, serializeUser } from '../models.js';
import { COOKIE_NAME, getJwtSecret, setSessionCookie, clearSessionCookie } from '../middleware/auth.js';
import { recordLogout, startActivitySession } from '../services/activityTracking.js';

export async function getAdminStatus(_request, response, next) {
  try {
    const adminExists = await User.exists({ role: 'admin' });
    response.json({
      adminExists: Boolean(adminExists),
      hasAdminEmailConfigured: Boolean(process.env.ADMIN_EMAIL?.trim()),
    });
  } catch (error) {
    next(error);
  }
}

export async function signup(request, response, next) {
  try {
    const isAdmin = request.user?.role === 'admin';
    const allowedFields = isAdmin ? [
      'name',
      'username',
      'email',
      'password',
      'confirmPassword',
      'department',
      'departmentId',
      'role',
    ] : ['name', 'username', 'email', 'password', 'confirmPassword'];
    if (Object.keys(request.body || {}).some((key) => !allowedFields.includes(key))) {
      response.status(400).json({ error: 'One or more account fields are not allowed.' });
      return;
    }

    const name = typeof request.body.name === 'string' ? request.body.name.trim() : '';
    const username = typeof request.body.username === 'string'
      ? request.body.username.trim().toLowerCase()
      : '';
    const email = typeof request.body.email === 'string'
      ? request.body.email.trim().toLowerCase()
      : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const confirmPassword = typeof request.body.confirmPassword === 'string' ? request.body.confirmPassword : '';
    const targetDeptId = request.body.departmentId || request.body.department || null;
    let targetRole = typeof request.body.role === 'string' ? request.body.role : 'team_member';

    if (!name || name.length > 80) {
      response.status(400).json({ error: 'Enter a name between 1 and 80 characters.' });
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      response.status(400).json({ error: 'Username must be 3–30 characters using letters, numbers, or underscores.' });
      return;
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      response.status(400).json({ error: 'Enter a valid email address.' });
      return;
    }
    if (password.length < 8 || password.length > 100) {
      response.status(400).json({ error: 'Password must be 8–100 characters long.' });
      return;
    }
    if (confirmPassword && password !== confirmPassword) {
      response.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    const adminExists = await User.exists({ role: 'admin' });

    if (!isAdmin) {
      if (adminExists) {
        response.status(403).json({
          error: 'An Administrator already exists. Ask an Administrator to create additional accounts.',
        });
        return;
      }

      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      if (!adminEmail) {
        response.status(500).json({
          error: 'Server is not configured with ADMIN_EMAIL in .env.',
        });
        return;
      }
      if (email !== adminEmail) {
        response.status(403).json({
          error: 'Only the email configured for the initial Administrator can create the first Admin account.',
        });
        return;
      }

      targetRole = 'admin';
    } else if (!['admin', 'team_leader', 'team_member'].includes(targetRole)) {
      response.status(400).json({ error: 'Choose a valid account role.' });
      return;
    }

    // Department validation if provided
    let departmentRef = null;
    if (targetDeptId) {
      if (mongoose.isValidObjectId(targetDeptId) && (await Department.exists({ _id: targetDeptId }))) {
        departmentRef = targetDeptId;
      }
    }

    // Prevent duplicate usernames or emails
    const existing = await User.findOne({
      $or: [{ username }, { email }],
    });
    if (existing) {
      if (existing.username === username) {
        response.status(409).json({ error: 'That username is already registered. Please choose another.' });
        return;
      }
      response.status(409).json({ error: 'That email is already registered. Please sign in or use another email.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      username,
      email,
      passwordHash,
      role: targetRole,
      department: departmentRef,
      isActive: true,
    });

    await user.populate('department', 'name');

    // If an Admin created another user, do not overwrite Admin session!
    if (isAdmin) {
      response.status(201).json({
        user: serializeUser(user),
        message: `Account created for ${user.name} (${user.role.replace('_', ' ')}).`,
      });
      return;
    }

    // Bootstrap the first Admin by signing them in immediately.
    const activitySession = await startActivitySession(user);
    setSessionCookie(response, user, activitySession._id);
    response.status(201).json({
      user: serializeUser(user),
      message: 'Initial Administrator created successfully.',
    });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'That username or email is already registered.' });
      return;
    }
    next(error);
  }
}

export async function login(request, response, next) {
  try {
    const identifier = typeof request.body.identifier === 'string'
      ? request.body.identifier.trim().toLowerCase()
      : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const requireAdminRole = Boolean(request.body.requireAdminRole);

    if (!identifier || !password) {
      response.status(400).json({ error: 'Enter your username or email and password.' });
      return;
    }

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    }).populate('department', 'name');

    if (!user || user.isActive === false || !(await bcrypt.compare(password, user.passwordHash))) {
      response.status(401).json({ error: 'Invalid username/email or password.' });
      return;
    }

    // Admin Login enforcement:
    // Only accounts whose backend role is Admin can authenticate via Admin Login
    if (requireAdminRole && user.role !== 'admin') {
      response.status(403).json({
        error: 'Access Denied: This account does not possess Administrator privileges. Please use the standard User Login.',
      });
      return;
    }

    const activitySession = await startActivitySession(user);
    setSessionCookie(response, user, activitySession._id);
    response.json({ user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function logout(request, response, next) {
  let logoutError;
  try {
    const token = request.cookies?.[COOKIE_NAME];
    if (token) {
      const payload = jwt.verify(token, getJwtSecret());
      if (payload.sid) {
        const session = await ActivitySession.findOne({
          _id: payload.sid,
          user: payload.sub,
          endedAt: null,
        });
        if (session) await recordLogout(session, payload.sub);
      }
    }
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
      logoutError = error;
    }
  }
  clearSessionCookie(response);
  if (logoutError) {
    next(logoutError);
    return;
  }
  response.status(204).end();
}

export async function me(request, response, next) {
  try {
    if (!request.user) {
      response.json({ user: null });
      return;
    }
    response.json({ user: serializeUser(request.user) });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(request, response, next) {
  try {
    const allowedFields = ['name', 'username', 'email', 'phoneNumber', 'profileImage'];
    if (Object.keys(request.body).some((field) => !allowedFields.includes(field))) {
      response.status(400).json({ error: 'One or more profile fields are not allowed.' });
      return;
    }

    const name = typeof request.body.name === 'string' ? request.body.name.trim() : '';
    const username = typeof request.body.username === 'string'
      ? request.body.username.trim().toLowerCase()
      : '';
    const email = typeof request.body.email === 'string'
      ? request.body.email.trim().toLowerCase()
      : '';
    const phoneNumber = typeof request.body.phoneNumber === 'string'
      ? request.body.phoneNumber.trim()
      : request.user.phoneNumber || '';

    if (!name || name.length > 80) {
      response.status(400).json({ error: 'Enter a name between 1 and 80 characters.' });
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      response.status(400).json({ error: 'Username must be 3–30 characters using letters, numbers, or underscores.' });
      return;
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      response.status(400).json({ error: 'Enter a valid email address.' });
      return;
    }
    if (phoneNumber.length > 20 || (phoneNumber && !/^\+?[0-9().\-\s]{7,20}$/.test(phoneNumber))) {
      response.status(400).json({ error: 'Enter a valid phone number, or leave the field blank.' });
      return;
    }

    let profileImage = request.user.profileImage;
    if (Object.hasOwn(request.body, 'profileImage')) {
      const image = request.body.profileImage;
      if (image === null || image === '') {
        profileImage = null;
      } else if (typeof image === 'string') {
        const match = image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
        if (!match) {
          response.status(400).json({ error: 'Choose a PNG, JPEG, or WebP profile picture.' });
          return;
        }
        const [, format, encodedImage] = match;
        const imageBytes = Buffer.from(encodedImage, 'base64');
        const hasValidSignature = format === 'png'
          ? imageBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : format === 'jpeg'
            ? imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff
            : imageBytes.toString('ascii', 0, 4) === 'RIFF'
              && imageBytes.toString('ascii', 8, 12) === 'WEBP';
        if (!hasValidSignature) {
          response.status(400).json({ error: 'The selected file does not match its image format.' });
          return;
        }
        if (imageBytes.length > 1_048_576) {
          response.status(400).json({ error: 'Profile pictures must be 1 MB or smaller.' });
          return;
        }
        profileImage = image;
      } else {
        response.status(400).json({ error: 'Choose a valid profile picture.' });
        return;
      }
    }

    request.user.name = name;
    request.user.username = username;
    request.user.email = email;
    request.user.phoneNumber = phoneNumber;
    request.user.profileImage = profileImage;
    await request.user.save();

    const savedUser = await User.findById(request.user._id).populate('department', 'name');
    if (!savedUser) {
      response.status(404).json({ error: 'Your account could not be found after updating.' });
      return;
    }
    if (savedUser.username !== username || savedUser.email !== email || savedUser.phoneNumber !== phoneNumber) {
      response.status(500).json({ error: 'The profile changes could not be verified after saving.' });
      return;
    }
    response.json({ user: serializeUser(savedUser) });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'That username or email is already registered.' });
      return;
    }
    next(error);
  }
}
