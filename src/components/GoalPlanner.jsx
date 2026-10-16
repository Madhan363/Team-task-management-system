import { useState } from 'react';
import { api } from '../api';

function GoalPlanner({ onAddTask }) {
  const [goal, setGoal] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isFallback, setIsFallback] = useState(false);

  const handleGenerate = async (event) => {
    event.preventDefault();
    setIsGenerating(true);
    setError('');
    setNotice('');
    setSuggestions([]);
    setSelectedTasks([]);
    setIsFallback(false);
    try {
      const { tasks, source } = await api.suggestTasks(goal.trim());
      setSuggestions(tasks);
      setSelectedTasks(tasks.map((_, index) => index));
      setIsFallback(source === 'fallback');
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
      try {
        await onAddTask({
          ...suggestions[index],
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

    setSuggestions((current) => current.filter((_, index) => !added.includes(index)));
    setSelectedTasks([]);
    setNotice(`Added ${added.length} task${added.length === 1 ? '' : 's'} to your list.`);
    setIsAdding(false);
  };

  return (
    <section className="goal-planner" aria-labelledby="goal-planner-title">
      <div className="goal-planner-heading">
        <div>
          <span className="suggestion-eyebrow">AI TASK ASSISTANT</span>
          <h2 id="goal-planner-title">Turn a big goal into clear next steps</h2>
          <p>Describe what you want to accomplish, then choose which suggestions to add.</p>
        </div>
        <span className="goal-planner-icon" aria-hidden="true">✦</span>
      </div>
      <form className="goal-planner-form" onSubmit={handleGenerate}>
        <label className="goal-planner-label" htmlFor="goal-planner-input">Your goal</label>
        <div className="goal-planner-input-row">
          <input
            id="goal-planner-input"
            className="todo-input"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="e.g. Prepare for my interview"
            minLength={3}
            maxLength={500}
            required
          />
          <button type="submit" className="todo-submit-btn" disabled={isGenerating || goal.trim().length < 3}>
            {isGenerating ? 'Thinking…' : 'Suggest tasks'}
          </button>
        </div>
      </form>
      <p className="goal-planner-note">
        Your goal is sent to OpenAI to generate suggestions. Nothing is saved until you add tasks.
      </p>
      {isGenerating && <p className="goal-planner-status" role="status">Creating a practical task plan…</p>}
      {isFallback && (
        <p className="goal-planner-status" role="status">
          OpenAI quota is unavailable, so these suggestions use the built-in goal planner.
        </p>
      )}
      {error && <p className="task-error" role="alert">{error}</p>}
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      {suggestions.length > 0 && (
        <div className="goal-planner-results">
          <div className="goal-planner-results-heading">
            <div>
              <h3>Suggested steps</h3>
              <p>Choose the steps you want to add to your task list.</p>
            </div>
            <span>{selectedTasks.length} selected</span>
          </div>
          <ul className="goal-planner-list">
            {suggestions.map((task, index) => (
              <li className="goal-planner-item" key={`${task.title}-${index}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(index)}
                    onChange={() => toggleTask(index)}
                    disabled={isAdding}
                  />
                  <span className="goal-planner-item-copy">
                    <strong>{task.title}</strong>
                    <small>{task.description}</small>
                  </span>
                </label>
                <span className={`goal-planner-priority priority-${task.priority}`}>{task.priority}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="todo-submit-btn goal-planner-add"
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

export default GoalPlanner;
