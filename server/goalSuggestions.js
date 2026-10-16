const INTERVIEW_SUGGESTIONS = [
  {
    title: 'Review key topics such as SQL and role-specific skills',
    description: 'Make a short review list based on the role and interview format.',
    priority: 'high',
  },
  {
    title: 'Practice coding problems or role-specific exercises',
    description: 'Work through a realistic problem related to the role.',
    priority: 'high',
  },
  {
    title: 'Revise common interview questions',
    description: 'Prepare concise answers and examples from your experience.',
    priority: 'medium',
  },
  {
    title: 'Research the organization',
    description: 'Review the organization, its work, and questions you want to ask.',
    priority: 'medium',
  },
  {
    title: 'Complete a mock interview',
    description: 'Practice answering questions aloud and note what to improve.',
    priority: 'medium',
  },
];

const STUDY_SUGGESTIONS = [
  {
    title: 'List the key topics to learn',
    description: 'Break the goal into a short list of topics, starting with the fundamentals.',
    priority: 'high',
  },
  {
    title: 'Choose a learning resource',
    description: 'Find one course, guide, or book that covers the first topic.',
    priority: 'medium',
  },
  {
    title: 'Study one topic in a focused session',
    description: 'Spend a focused session learning something useful for this goal.',
    priority: 'medium',
  },
  {
    title: 'Practice what you learned',
    description: 'Complete a small exercise or example related to your goal.',
    priority: 'high',
  },
  {
    title: 'Review your progress and plan the next session',
    description: 'Note what you learned and choose the next topic to work on.',
    priority: 'low',
  },
];

const GENERAL_SUGGESTIONS = [
  {
    title: 'Define what success looks like',
    description: 'Write down the outcome you want from this goal.',
    priority: 'high',
  },
  {
    title: 'Break the goal into small milestones',
    description: 'List a few concrete steps that will move this goal forward.',
    priority: 'high',
  },
  {
    title: 'Gather the tools and information you need',
    description: 'Find the resources or people that can help with this goal.',
    priority: 'medium',
  },
  {
    title: 'Complete the first focused step',
    description: 'Set aside time to make a start on one manageable part of the goal.',
    priority: 'medium',
  },
  {
    title: 'Review progress and choose the next step',
    description: 'Check what worked and decide what to do next.',
    priority: 'low',
  },
];

export function createFallbackSuggestions(goal) {
  const templates = /\binterview\b/i.test(goal)
    ? INTERVIEW_SUGGESTIONS
    : /\b(learn|study|understand|course|practice|prepare|improve)\b/i.test(goal)
      ? STUDY_SUGGESTIONS
      : GENERAL_SUGGESTIONS;

  return templates.map((task) => ({
    ...task,
    description: `${task.description} Goal: ${goal}`,
  }));
}
