/**
 * Calendar Integrations Utility
 * Supports Google Calendar web links and iCalendar (.ics) exports compatible
 * with Apple Calendar, Microsoft Outlook, and Google Calendar.
 */

function formatIcsDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function getGoogleCalendarUrl(task) {
  if (!task) return '#';
  const title = encodeURIComponent(task.title || 'TaskFlow Task');
  const details = encodeURIComponent(
    [
      task.description,
      task.priority ? `Priority: ${task.priority.toUpperCase()}` : '',
      task.department?.name ? `Department: ${task.department.name}` : '',
      'Created via TaskFlow Management System',
    ].filter(Boolean).join('\n\n')
  );

  const due = task.dueDate ? new Date(task.dueDate) : new Date(Date.now() + 3600000);
  const start = task.startDate ? new Date(task.startDate) : new Date(due.getTime() - 3600000);

  const startFormatted = formatIcsDate(start);
  const dueFormatted = formatIcsDate(due);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${startFormatted}/${dueFormatted}`;
}

export function generateIcsContent(tasks) {
  const taskList = Array.isArray(tasks) ? tasks : [tasks];
  const now = formatIcsDate(new Date());

  const events = taskList.map((task) => {
    const uid = `taskflow-${task.id || Date.now()}@taskflow.local`;
    const due = task.dueDate ? new Date(task.dueDate) : new Date(Date.now() + 3600000);
    const start = task.startDate ? new Date(task.startDate) : new Date(due.getTime() - 3600000);
    const summary = (task.title || 'TaskFlow Task').replace(/[\r\n]/g, ' ');
    const description = (task.description || '').replace(/\r?\n/g, '\\n');
    const priority = task.priority === 'high' ? 1 : task.priority === 'low' ? 9 : 5;

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(due)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `PRIORITY:${priority}`,
      `STATUS:${task.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`,
      'END:VEVENT',
    ].join('\r\n');
  }).join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskFlow//Task Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadTaskIcs(task) {
  const ics = generateIcsContent(task);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(task.title || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAllTasksIcs(tasks, filename = 'taskflow-calendar.ics') {
  const ics = generateIcsContent(tasks);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
