import { useState } from 'react';

function TaskAssistant({ onSuggest, onAddTask }) {
  const [goal, setGoal] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleGenerate = async (event) => {
    event.preventDefault();
    setIsGenerating(true);
    setError('');
    setNotice('');
    setSuggestions([]);
    setSelectedTasks([]);
    try {
      const { tasks } = await onSuggest(goal.trim());
      setSuggestions(tasks);
      setSelectedTasks(tasks.map((_, index) => index));
    } catch (suggestionError) {
      setError(suggestionError.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleTask = (index) => {
    setSelectedTasks((current) => (
      current.includes(index)
        ? current.filter((selectedIndex) => selectedIndex !== index)
        : [...current, index]
    ));
  };

  const handleAddSelected = async () => {
    setIsAdding(true);
    setError('');
    setNotice('');
    const added = [];
    for (const index of selectedTasks) {
      const task = suggestions[index];
      try {
        await onAddTask({
          ...task,
          category: 'Goal plan',
          dueDate: null,
          reminderAt: null,
          completed: false,
        });
        added.push(index);
      } catch (addError) {
        const remaining = suggestions.filter((_, taskIndex) => !added.includes(taskIndex));
        const remainingSelected = selectedTasks
          .filter((taskIndex) => !added.includes(taskIndex))
          .map((taskIndex) => taskIndex - added.filter((addedIndex) => addedIndex < taskIndex).length);
        setSuggestions(remaining);
        setSelectedTasks(remainingSelected);
        setError(added.length
          ? `Added ${added.length} task${added.length === 1 ? '' : 's'}, but couldn't add the rest: ${addError.message}`
          : addError.message);
        setIsAdding(false);
        return;
      }
    }
    const remaining = suggestions.filter((_, index) => !added.includes(index));
    const remainingSelected = selectedTasks
      .filter((index) => !added.includes(index))
      .map((index) => index - added.filter((addedIndex) => addedIndex < index).length);
    setSuggestions(remaining);
    setSelectedTasks(remainingSelected);
    setNotice(`Added ${added.length} task${added.length === 1 ? '' : 's'} to your list.`);
    setIsAdding(false);
  };

  return (
    <section className="task-assistant" aria-labelledby="task-assistant-title">
      <div className="task-assistant-heading">
        <div>
          <span className="suggestion-eyebrow">AI TASK ASSISTANT</span>
          <h2 id="task-assistant-title">Turn a big goal into clear next steps</h2>
          <p>Describe what you want to accomplish, then choose which suggestions to add.</p>
        </div>
        <span className="task-assistant-icon" aria-hidden="true">✦</span>
      </div>
      <form className="task-assistant-form" onSubmit={handleGenerate}>
        <label className="task-assistant-label" htmlFor="task-assistant-goal">Your goal</label>
        <div className="task-assistant-input-row">
          <input
            id="task-assistant-goal"
            className="todo-input"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="e.g. Prepare for my software engineering interview"
            maxLength={500}
            minLength={3}
            required
          />
          <button type="submit" className="todo-submit-btn" disabled={isGenerating || goal.trim().length < 3}>
            {isGenerating ? 'Thinking…' : 'Suggest tasks'}
          </button>
        </div>
      </form>
      <p className="task-assistant-privacy">
        Your goal is sent to OpenAI to generate suggestions. Nothing is saved until you add tasks.
      </p>
      {isGenerating && <p className="task-assistant-status" role="status">Creating a practical task plan…</p>}
      {error && <p className="task-error" role="alert">{error}</p>}
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      {suggestions.length > 0 && (
        <div className="task-assistant-results">
          <div className="task-assistant-results-heading">
            <div>
              <h3>Suggested steps</h3>
              <p>Select the steps you want to add to your task list.</p>
            </div>
            <span>{selectedTasks.length} selected</span>
          </div>
          <ul className="task-assistant-list">
            {suggestions.map((task, index) => (
              <li className="task-assistant-item" key={`${task.title}-${index}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(index)}
                    onChange={() => toggleTask(index)}
                    disabled={isAdding}
                  />
                  <span className="task-assistant-item-copy">
                    <strong>{task.title}</strong>
                    {task.description && <small>{task.description}</small>}
                  </span>
                </label>
                <span className={`task-assistant-priority priority-${task.priority}`}>{task.priority}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="todo-submit-btn task-assistant-add"
            onClick={handleAddSelected}
            disabled={isAdding || selectedTasks.length === 0}
          >
            {isAdding ? 'Adding tasks…' : `Add ${selectedTasks.length} selected task${selectedTasks.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </section>
  );
}

export default TaskAssistant;
