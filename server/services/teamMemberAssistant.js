const NO_TASKS_MESSAGE = "You don't have any tasks assigned yet. Please contact your Team Leader.";

const FIELD_UNAVAILABLE = 'Not provided in the task record.';

function taskStatus(task) {
  return task.status || (task.completed ? 'completed' : 'assigned');
}

function formatTask(task) {
  const lines = [
    `• ${task.title}`,
    `  Description and requirements: ${task.description?.trim() || FIELD_UNAVAILABLE}`,
    `  Team Leader: ${task.assignedBy?.name || FIELD_UNAVAILABLE}`,
    `  Department: ${task.department?.name || FIELD_UNAVAILABLE}`,
    `  Status: ${taskStatus(task).replaceAll('_', ' ')}`,
    `  Acknowledgment: ${task.acknowledgmentStatus || FIELD_UNAVAILABLE}`,
    `  Acknowledged: ${task.acknowledgedAt ? new Date(task.acknowledgedAt).toLocaleDateString() : FIELD_UNAVAILABLE}`,
    `  Priority: ${task.priority || FIELD_UNAVAILABLE}`,
    `  Deadline: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : FIELD_UNAVAILABLE}`,
    `  Started: ${task.startDate ? new Date(task.startDate).toLocaleDateString() : FIELD_UNAVAILABLE}`,
    `  Submitted for review: ${task.submittedAt ? new Date(task.submittedAt).toLocaleDateString() : FIELD_UNAVAILABLE}`,
    `  Completed: ${task.completedAt ? new Date(task.completedAt).toLocaleDateString() : FIELD_UNAVAILABLE}`,
  ];

  if (task.attachments?.length) {
    lines.push(`  Attachments: ${task.attachments.map((attachment) => attachment.name).join(', ')}`);
  } else {
    lines.push('  Attachments: None recorded.');
  }
  return lines.join('\n');
}

function findTaskContext(tasks, message, conversation) {
  const currentText = message.toLowerCase();
  const previousText = conversation
    .slice(-10)
    .map((entry) => entry.text.toLowerCase())
    .reverse();

  for (const text of [currentText, ...previousText]) {
    const exactMatches = tasks.filter((task) => text.includes(task.title.toLowerCase()));
    if (exactMatches.length === 1) return exactMatches[0];
    if (exactMatches.length > 1) return null;

    const words = new Set(text.match(/[a-z0-9]+/g) || []);
    const fuzzyMatches = tasks
      .map((task) => {
        const titleWords = [...new Set(task.title.toLowerCase().match(/[a-z0-9]+/g) || [])];
        const matchingWords = titleWords.filter((word) => words.has(word)).length;
        return { task, matchingWords, titleWordsCount: titleWords.length };
      })
      .filter(({ matchingWords, titleWordsCount }) => (
        titleWordsCount >= 2 && matchingWords >= Math.min(3, titleWordsCount)
      ))
      .sort((a, b) => b.matchingWords - a.matchingWords);
    if (fuzzyMatches.length === 1 || (
      fuzzyMatches.length > 1 && fuzzyMatches[0].matchingWords > fuzzyMatches[1].matchingWords
    )) {
      return fuzzyMatches[0].task;
    }
    if (fuzzyMatches.length > 1) return null;
  }
  return null;
}

function buildTaskProgress(task) {
  const entries = [
    ...(task.history || []).map((item) => ({
      timestamp: item.timestamp,
      text: `${item.changedBy?.name || 'User'} (${item.changedBy?.role || 'user'}): ${item.oldStatus || 'start'} → ${item.newStatus || taskStatus(task)}${item.comment ? ` — ${item.comment}` : ''}`,
    })),
    ...(task.responses || []).map((item) => ({
      timestamp: item.createdAt,
      text: `${item.user?.name || 'User'} (${item.user?.role || 'user'}, ${item.responseType}): ${item.message}`,
    })),
  ].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  return entries.length ? entries.map((entry) => `• ${entry.text}`).join('\n') : 'No progress updates are recorded.';
}

function stepsFromDescription(description) {
  const requirements = description
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  return requirements.length
    ? requirements.map((requirement, index) => `${index + 1}. ${requirement}`).join('\n')
    : null;
}

function requestedRequirementIndex(query) {
  const ordinal = query.match(/\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th)\s+requirement\b/i);
  const number = query.match(/\brequirement\s*(?:number|#)?\s*(\d+)\b/i);
  if (number) return Number(number[1]) - 1;
  if (!ordinal) return -1;
  return { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, fourth: 3, '4th': 3, fifth: 4, '5th': 4 }[
    ordinal[1].toLowerCase()
  ];
}

function isFollowUp(message) {
  return /\b(it|this|that|the task|the second|first requirement|second requirement|next step|explain more|what does it mean|what does that mean)\b/i.test(message);
}

export function buildRuleBasedAnswer({ tasks, message, conversation = [], now = new Date() }) {
  if (!tasks.length) return NO_TASKS_MESSAGE;

  const query = message.toLowerCase();
  const statusOf = taskStatus;
  const pending = tasks.filter((task) => statusOf(task) === 'assigned');
  const completed = tasks.filter((task) => statusOf(task) === 'completed');
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const overdue = tasks.filter((task) => (
    !['completed', 'submitted_review'].includes(statusOf(task))
    && task.dueDate
    && new Date(task.dueDate) < startOfToday
  ));

  if (/\bhow many|count|number of\b/i.test(query)) {
    let selection = tasks;
    let label = 'assigned';
    if (/\boverdue|past due|late\b/i.test(query)) {
      selection = overdue;
      label = 'overdue';
    } else if (/\bcompleted|finished|done\b/i.test(query)) {
      selection = completed;
      label = 'completed';
    } else if (/\bpending|not started|awaiting acknowledgment|awaiting acknowledgement\b/i.test(query)) {
      selection = pending;
      label = 'pending';
    }
    return `You have ${selection.length} ${label} task${selection.length === 1 ? '' : 's'}.`;
  }

  if (/\boverdue|past due|late\b/i.test(query)) {
    return overdue.length
      ? `Overdue tasks based on their recorded deadline:\n${overdue.map(formatTask).join('\n\n')}`
      : 'You have no overdue tasks based on the deadlines recorded in your task list.';
  }
  if (/\bcompleted|finished|done\b/i.test(query)) {
    return completed.length
      ? `Completed tasks:\n${completed.map(formatTask).join('\n\n')}`
      : 'You have no completed tasks yet.';
  }
  if (/\bpending|not started|awaiting acknowledgment|awaiting acknowledgement\b/i.test(query)) {
    return pending.length
      ? `Pending tasks:\n${pending.map(formatTask).join('\n\n')}`
      : 'You have no pending tasks.';
  }

  const contextTask = findTaskContext(tasks, message, conversation);
  const wantsList = /\b(my tasks|all tasks|list.*tasks|what tasks.*assigned|what.*team leader.*assigned|assignments to me)\b/i.test(query);
  const asksNext = /\bwhat should i do next|what should i work on (?:next|first)|what should i work on first|next action|work on next\b/i.test(query);
  const asksPriority = /\bhighest[- ]priority|priority.*task|task.*priority\b/i.test(query);
  const asksDeadline = /\bdeadline|due date|when.*due\b/i.test(query);
  const asksProgress = /\bprogress|history|updates|what.*done|what.*happened\b/i.test(query);
  const asksLeaderInstruction = /\b(team leader|leader).{0,30}\b(instruction|say|tell|request|ask|require)\b|\b(instruction|scope|requirement).{0,30}\b(team leader|leader|they|i was given)\b|\bwhat did they (?:tell|ask|say)\b/i.test(query);
  const asksAttachments = /\battachment|pdf|document|file\b/i.test(query);
  const asksGuidance = /\bhow (?:do i|to|can i)|step.?by.?step|steps to|complete|finish|mean|explain\b/i.test(query);
  const asksDetails = /\bdescription|requirement|status|department|team leader|priority|deadline|due date|attachment\b/i.test(query);
  const likelyTaskQuestion = /\b(task|assignment|deadline|priority|department|team leader|attachment|pdf|document|requirement|progress)\b/i.test(query);

  if (contextTask) {
    if (asksNext) {
      const actionable = [contextTask]
        .filter((task) => !['completed', 'submitted_review'].includes(statusOf(task)))
        .sort((a, b) => {
        const rank = { high: 3, medium: 2, low: 1 };
        const priorityDiff = (rank[b.priority] || 0) - (rank[a.priority] || 0);
        if (priorityDiff) return priorityDiff;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
        return a.dueDate ? -1 : b.dueDate ? 1 : 0;
      });
      if (!actionable.length) return statusOf(contextTask) === 'submitted_review'
        ? `“${contextTask.title}” is submitted for Team Leader review; there is no further action recorded for you right now.`
        : `“${contextTask.title}” is completed.`;
      const nextTask = actionable[0];
      return `Suggested next action (based on recorded status, priority, and deadline—not a Team Leader instruction):\n${formatTask(nextTask)}\n\n${nextTask.description ? `Suggested approach:\n${stepsFromDescription(nextTask.description) || `1. Confirm the expected outcome with your Team Leader.\n2. Break "${nextTask.title}" into small steps.\n3. Complete and verify each step, then submit your work for review.`}` : 'No detailed requirements are recorded. Ask your Team Leader to clarify the expected outcome before starting.'}`;
    }

    if (asksProgress) return `Recorded progress for "${contextTask.title}":\n${buildTaskProgress(contextTask)}`;
    if (asksLeaderInstruction) {
      const instructions = (contextTask.responses || [])
        .filter((entry) => entry.user?.role === 'team_leader')
        .map((entry) => `• ${entry.message}`);
      return `Recorded task requirements for "${contextTask.title}":\n${contextTask.description?.trim() || FIELD_UNAVAILABLE}\n\nTeam Leader messages on this task:\n${instructions.length ? instructions.join('\n') : 'No additional Team Leader messages are recorded.'}`;
    }
    if (asksAttachments) {
      const names = contextTask.attachments?.map((attachment) => attachment.name) || [];
      const extracted = contextTask.attachments?.filter((attachment) => attachment.extractedText) || [];
      if (!names.length) return `No attachments are recorded for "${contextTask.title}".`;
      if (/\bcontent|inside|in the|say|contain|read\b/i.test(query) && extracted.length) {
        return `Extracted PDF text for "${contextTask.title}":\n${extracted.map((attachment) => `**${attachment.name}**\n${attachment.extractedText}`).join('\n\n')}`;
      }
      if (/\bcontent|inside|in the|say|contain|read\b/i.test(query)) {
        return `I found these attachments for "${contextTask.title}", but their text is not available to read:\n${names.map((name) => `• ${name}`).join('\n')}`;
      }
      return `Attachments recorded for "${contextTask.title}":\n${names.map((name) => `• ${name}`).join('\n')}${extracted.length ? '\nPDF text can be used to answer questions about these files.' : ''}`;
    }
    if (asksGuidance) {
      const description = contextTask.description?.trim();
      const requirements = description
        ? description.split(/\r?\n|(?<=[.!?])\s+/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean)
        : [];
      const requirementIndex = requestedRequirementIndex(query);
      if (requirementIndex >= 0) {
        const requirement = requirements[requirementIndex];
        return requirement
          ? `Requirement ${requirementIndex + 1} recorded for "${contextTask.title}":\n${requirement}\n\nAI-generated interpretation (not an additional Team Leader instruction): This asks you to complete the work described above. Confirm any unclear details with your Team Leader.`
          : `I couldn't find requirement ${requirementIndex + 1} in the description recorded for "${contextTask.title}". The task record may not number its requirements.`;
      }
      return description
        ? `Task record for "${contextTask.title}":\n${description}\n\nSuggested steps (AI-generated suggestions, not additional Team Leader instructions):\n${stepsFromDescription(description) || `1. Confirm the expected outcome.\n2. Break the work into small steps based on the task description.\n3. Verify the result and submit it for review.`}`
        : `No detailed requirements or description are provided for "${contextTask.title}". These general suggestions are not Team Leader instructions:\n1. Ask your Team Leader to clarify the expected result.\n2. Agree on the scope and any acceptance criteria.\n3. Share a progress update before completing the work.`;
    }
    if (asksDetails || isFollowUp(message)) return formatTask(contextTask);
    return formatTask(contextTask);
  }

  if (asksNext) {
    const actionable = tasks.filter((task) => !['completed', 'submitted_review'].includes(statusOf(task)));
    if (!actionable.length) return 'All your assigned tasks are completed or waiting for review.';
    const rank = { high: 3, medium: 2, low: 1 };
    actionable.sort((a, b) => {
      const priorityDiff = (rank[b.priority] || 0) - (rank[a.priority] || 0);
      if (priorityDiff) return priorityDiff;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      return a.dueDate ? -1 : b.dueDate ? 1 : 0;
    });
    const task = actionable[0];
    return `Suggested next action (based on recorded status, priority, and deadline—not a Team Leader instruction):\n${formatTask(task)}\n\n${task.description ? `Suggested approach:\n${stepsFromDescription(task.description) || 'Break the task into small steps based on its description, verify the result, and submit it for review.'}` : 'No detailed requirements are recorded. Ask your Team Leader to clarify the expected outcome before starting.'}`;
  }

  if (asksPriority) {
    const ranks = { high: 3, medium: 2, low: 1 };
    const highest = Math.max(...tasks.map((task) => ranks[task.priority] || 0));
    return highest
      ? `Highest-priority task${tasks.filter((task) => ranks[task.priority] === highest).length === 1 ? '' : 's'}:\n${tasks.filter((task) => ranks[task.priority] === highest).map(formatTask).join('\n\n')}`
      : 'Priority is not provided in your task records.';
  }
  if (asksDeadline) {
    const withDeadlines = tasks.filter((task) => task.dueDate);
    return withDeadlines.length
      ? `Deadlines recorded for your assigned tasks:\n${withDeadlines.map(formatTask).join('\n\n')}`
      : 'No deadlines are provided in your task records.';
  }
  if (asksProgress) {
    return tasks.map((task) => `**${task.title}**\n${buildTaskProgress(task)}`).join('\n\n');
  }
  if (asksAttachments) {
    return tasks.map((task) => `**${task.title}**\n${task.attachments?.length ? task.attachments.map((item) => `• ${item.name}`).join('\n') : 'No attachments recorded.'}`).join('\n\n');
  }
  if (wantsList) {
    return `Your assigned tasks (${tasks.length}):\n${tasks.map(formatTask).join('\n\n')}`;
  }
  if (asksGuidance || isFollowUp(message) || likelyTaskQuestion) {
    return `I couldn't match that question to a specific assigned task. Which task do you mean?\n${tasks.map((task) => `• ${task.title}`).join('\n')}`;
  }

  return 'I can answer questions about your assigned tasks, their requirements, deadlines, progress, and attachments.';
}

export function buildTaskContext(task) {
  return {
    title: task.title,
    description: task.description || '',
    status: taskStatus(task),
    acknowledgmentStatus: task.acknowledgmentStatus || null,
    priority: task.priority || null,
    dueDate: task.dueDate || null,
    startDate: task.startDate || null,
    acknowledgedAt: task.acknowledgedAt || null,
    submittedAt: task.submittedAt || null,
    completedAt: task.completedAt || null,
    department: task.department?.name || null,
    assignedBy: task.assignedBy?.name || null,
    attachments: task.attachments || [],
    history: task.history || [],
    responses: task.responses || [],
  };
}

export { NO_TASKS_MESSAGE };
