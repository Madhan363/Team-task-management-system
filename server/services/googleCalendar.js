import { google } from 'googleapis';
import process from 'node:process';
import { randomUUID } from 'node:crypto';

function getCalendarClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) return null;

  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth });
}

export function isGoogleCalendarConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID
    && process.env.GOOGLE_CLIENT_SECRET
    && process.env.GOOGLE_REFRESH_TOKEN,
  );
}

function calendarEventBody(meeting) {
  return {
    summary: meeting.title,
    description: [meeting.description, meeting.agenda && `Agenda:\n${meeting.agenda}`]
      .filter(Boolean)
      .join('\n\n'),
    start: { dateTime: meeting.startsAt.toISOString(), timeZone: meeting.timezone },
    end: { dateTime: meeting.endsAt.toISOString(), timeZone: meeting.timezone },
    attendees: meeting.participantUsers.map((user) => ({ email: user.email })),
    ...(meeting.meetingUrl ? { location: meeting.meetingUrl } : {}),
    ...(!meeting.meetingUrl ? {
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    } : {}),
  };
}

export async function createCalendarEvent(meeting) {
  const calendar = getCalendarClient();
  if (!calendar) return null;

  const result = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: calendarEventBody(meeting),
  });
  return {
    eventId: result.data.id,
    meetingUrl: meeting.meetingUrl || result.data.hangoutLink || '',
  };
}

export async function updateCalendarEvent(meeting) {
  if (!meeting.calendarEventId) return null;
  const calendar = getCalendarClient();
  if (!calendar) {
    throw new Error('This meeting is linked to Google Calendar, but its OAuth credentials are not configured.');
  }

  const result = await calendar.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    eventId: meeting.calendarEventId,
    sendUpdates: 'all',
    requestBody: calendarEventBody(meeting),
  });
  return result.data.hangoutLink || meeting.meetingUrl;
}

export async function cancelCalendarEvent(meeting) {
  if (!meeting.calendarEventId) return;
  const calendar = getCalendarClient();
  if (!calendar) {
    throw new Error('This meeting is linked to Google Calendar, but its OAuth credentials are not configured.');
  }
  await calendar.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    eventId: meeting.calendarEventId,
    sendUpdates: 'all',
    requestBody: { status: 'cancelled' },
  });
}

export async function deleteCalendarEvent(meeting) {
  if (!meeting.calendarEventId) return;
  const calendar = getCalendarClient();
  if (!calendar) {
    throw new Error('This meeting is linked to Google Calendar, but its OAuth credentials are not configured.');
  }
  await calendar.events.delete({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    eventId: meeting.calendarEventId,
    sendUpdates: 'all',
  });
}
