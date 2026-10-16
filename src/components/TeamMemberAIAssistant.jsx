import { useEffect, useRef, useState } from 'react';
import { Bot, X, Send, MessageCircle, LoaderCircle } from 'lucide-react';
import { api } from '../api';

const QUICK_ACTIONS = [
  { label: 'My Tasks', message: 'What tasks did my Team Leader assign to me?' },
  { label: 'Pending Tasks', message: 'What tasks are pending?' },
  { label: 'Completed Tasks', message: 'What tasks have I completed?' },
  { label: 'Overdue Tasks', message: 'Which tasks are overdue?' },
];

function makeMessage(role, text, timestamp = new Date().toISOString(), mode = '') {
  return { id: `${Date.now()}-${Math.random()}`, role, text, timestamp, mode };
}

function TeamMemberAIAssistant({ inline = false }) {
  const [isOpen, setIsOpen] = useState(inline);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    makeMessage('assistant', 'Hi! Ask me about your assigned tasks, deadlines, priorities, or progress.'),
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const messageList = messagesRef.current;
    if (messageList) {
      messageList.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async (messageText) => {
    const question = messageText.trim();
    if (!question || isLoading) return;

    setMessages((current) => [...current, makeMessage('user', question)]);
    setInput('');
    setError('');
    setIsLoading(true);
    try {
      const conversation = messages
        .slice(-12)
        .map(({ role, text }) => ({ role, text }));
      const result = await api.askTeamMemberAssistant(question, conversation);
      setMessages((current) => [
        ...current,
        makeMessage(
          'assistant',
          result.notice ? `${result.answer}\n\n${result.notice}` : result.answer,
          result.timestamp,
          result.mode,
        ),
      ]);
    } catch (requestError) {
      setError(requestError.message || 'Could not get an answer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(input);
  };

  return (
    <div className={`tf-member-ai${inline ? ' tf-member-ai-inline' : ''}`}>
      {isOpen && (
        <section className="tf-member-ai-panel" aria-labelledby="tf-member-ai-title">
          <header className="tf-member-ai-header">
            <span className="tf-member-ai-avatar"><Bot size={19} /></span>
            <div>
              <h2 id="tf-member-ai-title">Team Member AI Assistant</h2>
              <p>Answers based on your assigned tasks</p>
            </div>
            {!inline && (
              <button
                type="button"
                className="tf-member-ai-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close AI Assistant"
              >
                <X size={18} />
              </button>
            )}
          </header>

          <div ref={messagesRef} className="tf-member-ai-messages" aria-live="polite" aria-busy={isLoading}>
            {messages.map((message) => (
              <article className={`tf-member-ai-message tf-member-ai-message-${message.role}`} key={message.id}>
                <p>{message.text}</p>
                {message.role === 'assistant' && message.mode && (
                  <span className="tf-member-ai-mode">
                    {message.mode === 'openai' ? 'AI model • app task records' : 'Rule-based • app task records'}
                  </span>
                )}
                <time dateTime={message.timestamp}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
              </article>
            ))}
            {isLoading && (
              <div className="tf-member-ai-loading" role="status">
                <LoaderCircle size={16} className="tf-spin" /> Checking your tasks…
              </div>
            )}
          </div>

          <div className="tf-member-ai-quick-actions" aria-label="Quick questions">
            {QUICK_ACTIONS.map((action) => (
              <button
                type="button"
                key={action.label}
                onClick={() => sendMessage(action.message)}
                disabled={isLoading}
              >
                {action.label}
              </button>
            ))}
          </div>

          {error && <p className="tf-member-ai-error" role="alert">{error}</p>}

          <form className="tf-member-ai-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your tasks…"
              aria-label="Ask about your assigned tasks"
              maxLength={500}
              disabled={isLoading}
            />
            <button type="submit" aria-label="Send message" disabled={isLoading || !input.trim()}>
              <Send size={17} />
            </button>
          </form>
        </section>
      )}

      {!inline && (
        <button
          type="button"
          className="tf-member-ai-launcher"
          onClick={() => setIsOpen((current) => !current)}
          aria-label={isOpen ? 'Close Team Member AI Assistant' : 'Open Team Member AI Assistant'}
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
        </button>
      )}
    </div>
  );
}

export default TeamMemberAIAssistant;
