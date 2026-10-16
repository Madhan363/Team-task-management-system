import { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  X,
  Plus,
  Copy,
  Trash2,
  PanelLeft,
  ListPlus,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import { api } from '../api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SUGGESTED_QUESTIONS = [
  'Summarize my current workload',
  'Which tasks are due tomorrow?',
  'What is overdue?',
  'What should I work on first?',
];

function SmartAssistantDock({ role, onTaskCreated }) {
  const roleLabel = {
    admin: 'Admin',
    team_leader: 'Team Leader',
    team_member: 'Team Member',
    personal: 'Personal',
  }[role] || 'User';
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [chatError, setChatError] = useState('');
  const [breakdownError, setBreakdownError] = useState('');
  const [taskActionError, setTaskActionError] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Breakdown state
  const [goalInput, setGoalInput] = useState('');
  const [breakdownResults, setBreakdownResults] = useState([]);
  const [addingTaskIndex, setAddingTaskIndex] = useState(null);

  const createGoalFallback = (goal) => [
    {
      title: `Define scope and requirements for ${goal}`,
      description: `Document key objectives and milestones for: ${goal}`,
      priority: 'high',
      category: 'Planning',
    },
    {
      title: 'Gather necessary assets and technical dependencies',
      description: `Assemble resources and tools needed to execute: ${goal}`,
      priority: 'medium',
      category: 'Preparation',
    },
    {
      title: `Implement the core deliverable for ${goal}`,
      description: `Execute the primary phase of work for: ${goal}`,
      priority: 'high',
      category: 'Execution',
    },
    {
      title: 'Review, test, and polish the deliverable',
      description: `Validate quality standards and test results for: ${goal}`,
      priority: 'medium',
      category: 'QA',
    },
    {
      title: 'Submit for review and record completion',
      description: `Complete final verification and submit for approval: ${goal}`,
      priority: 'low',
      category: 'Completion',
    },
  ];

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;
    api.getAssistantConversations()
      .then((result) => {
        if (isCurrent) setConversations(result.conversations || []);
      })
      .catch((error) => {
        if (isCurrent) setChatError(error.message || 'Could not load chat history.');
      })
      .finally(() => {
        if (isCurrent) setLoadingHistory(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [isOpen]);

  const refreshConversations = async () => {
    const result = await api.getAssistantConversations();
    setConversations(result.conversations || []);
  };

  const handleSendMessage = async (e, suggestedMessage = '') => {
    e?.preventDefault();
    const text = (suggestedMessage || inputText).trim();
    if (!text || loading) return;

    const userMessage = { id: `local-user-${messages.length}`, role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setChatError('');
    setLoading(true);

    try {
      const response = await api.chatWithAssistant(conversationId, text);
      setConversationId(response.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: `answer-${messages.length + 1}`,
          role: 'assistant',
          text: response.answer,
          mode: response.mode,
          notice: response.notice,
          taskCards: response.taskCards || [],
          createdAt: response.timestamp,
        },
      ]);
      await refreshConversations();
    } catch (err) {
      setChatError(err.message || 'The assistant could not answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setChatError('');
    setInputText('');
    setActiveTab('chat');
    setShowHistory(false);
    chatInputRef.current?.focus();
  };

  const handleOpenConversation = async (id) => {
    setLoadingHistory(true);
    setChatError('');
    try {
      const result = await api.getAssistantConversation(id);
      setConversationId(result.conversation.id);
      setMessages(result.conversation.messages || []);
      setActiveTab('chat');
      setShowHistory(false);
    } catch (err) {
      setChatError(err.message || 'Could not open this conversation.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteAssistantConversation(id);
      setConversations((current) => current.filter((conversation) => conversation.id !== id));
      if (conversationId === id) handleNewChat();
    } catch (err) {
      setChatError(err.message || 'Could not delete this conversation.');
    }
  };

  const handleClearChat = async () => {
    if (!conversationId) {
      setMessages([]);
      setChatError('');
      return;
    }
    try {
      await api.clearAssistantConversation(conversationId);
      setMessages([]);
      setChatError('');
      await refreshConversations();
    } catch (err) {
      setChatError(err.message || 'Could not clear this chat.');
    }
  };

  const handleCopyAnswer = async (message) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId(''), 1500);
    } catch {
      setChatError('Could not copy the answer. Check your browser clipboard permissions.');
    }
  };

  // AI Task Breakdown
  const handleBreakdownGoal = async (e) => {
    e?.preventDefault();
    if (!goalInput.trim() || loading) return;
    setLoading(true);
    setBreakdownResults([]);
    setBreakdownError('');

    try {
      let suggestions = [];
      try {
        const res = await api.suggestTasks(goalInput.trim());
        suggestions = res.tasks || res.suggestions || [];
      } catch {
        suggestions = [];
      }
      const validSuggestions = Array.isArray(suggestions)
        ? suggestions.filter((suggestion) => suggestion && typeof suggestion.title === 'string' && suggestion.title.trim())
        : [];
      if (!validSuggestions.length) {
        setBreakdownError('AI suggestions are unavailable, so these starter steps were generated from a built-in template.');
      }
      setBreakdownResults(validSuggestions.length
        ? validSuggestions
        : createGoalFallback(goalInput.trim()));
    } catch (err) {
      setBreakdownError(err.message || 'Could not break down this goal.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBreakdownTask = async (task, index) => {
    setAddingTaskIndex(index);
    setTaskActionError('');
    try {
      await api.createTask({
        title: task.title,
        description: task.description || '',
        priority: task.priority || 'medium',
        category: task.category || 'General',
      });
      setBreakdownResults((prev) => prev.filter((_, i) => i !== index));
      onTaskCreated?.();
    } catch (err) {
      setTaskActionError(err.message || 'Could not add this task.');
    } finally {
      setAddingTaskIndex(null);
    }
  };

  return (
    <aside className="tf-smart-assistant-dock" aria-label="TaskFlow Smart Assistant">
      {/* Floating launcher button */}
      {!isOpen && (
        <button
          type="button"
          className="tf-assistant-launcher-btn"
          onClick={() => setIsOpen(true)}
          title="Open TaskFlow Smart AI Assistant"
          aria-expanded={false}
        >
          <Sparkles size={20} className="tf-sparkle-icon" />
          <span>Smart Assistant</span>
        </button>
      )}

      {/* Floating Assistant Drawer / Panel */}
      {isOpen && (
        <div className="tf-assistant-panel" role="dialog" aria-labelledby="assistant-heading">
          <div className="tf-assistant-header">
            <div className="tf-assistant-title-row">
              <div className="tf-assistant-icon-badge">
                <Bot size={18} />
              </div>
              <div>
                <h3 id="assistant-heading">TaskFlow Smart Assistant</h3>
                <span className="tf-assistant-sub">{roleLabel} workspace · AI Copilot & Task Planner</span>
              </div>
            </div>
            <button
              type="button"
              className="tf-assistant-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="tf-assistant-tabs">
            <button
              type="button"
              className={`tf-assistant-tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              AI Copilot
            </button>
            <button
              type="button"
              className={`tf-assistant-tab ${activeTab === 'breakdown' ? 'active' : ''}`}
              onClick={() => setActiveTab('breakdown')}
            >
              Goal Breakdown
            </button>
          </div>

          {/* TAB 1: AI Copilot Chat */}
          {activeTab === 'chat' && (
            <div className={`tf-assistant-chat-layout ${showHistory ? 'history-open' : ''}`}>
              <aside className="tf-assistant-history" aria-label="Chat history">
                <button
                  type="button"
                  className="tf-assistant-history-mobile-close"
                  onClick={() => setShowHistory(false)}
                >
                  <PanelLeft size={15} /> Back to chat
                </button>
                <button type="button" className="tf-assistant-new-chat" onClick={handleNewChat}>
                  <Plus size={15} /> New chat
                </button>
                <div className="tf-assistant-history-list">
                  {loadingHistory && <span className="tf-assistant-history-status">Loading chats…</span>}
                  {!loadingHistory && conversations.length === 0 && (
                    <span className="tf-assistant-history-status">Your saved chats will appear here.</span>
                  )}
                  {conversations.map((conversation) => (
                    <div className="tf-assistant-history-row" key={conversation.id}>
                      <button
                        type="button"
                        className={`tf-assistant-history-item ${conversation.id === conversationId ? 'active' : ''}`}
                        onClick={() => handleOpenConversation(conversation.id)}
                        title={conversation.title}
                      >
                        <span>{conversation.title}</span>
                        <small>{new Date(conversation.updatedAt).toLocaleDateString()}</small>
                      </button>
                      <button
                        type="button"
                        className="tf-assistant-history-delete"
                        onClick={() => handleDeleteConversation(conversation.id)}
                        aria-label={`Delete chat: ${conversation.title}`}
                        title="Delete chat"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </aside>

              <section className="tf-assistant-chat-view">
                <div className="tf-assistant-chat-toolbar">
                  <button
                    type="button"
                    className="tf-assistant-history-toggle"
                    onClick={() => setShowHistory((visible) => !visible)}
                    aria-label={showHistory ? 'Hide chat history' : 'Show chat history'}
                  >
                    <PanelLeft size={16} />
                  </button>
                  <span>{conversationId ? conversations.find((item) => item.id === conversationId)?.title || 'Chat' : 'New chat'}</span>
                  <button
                    type="button"
                    className="tf-assistant-clear-chat"
                    onClick={handleClearChat}
                    disabled={!messages.length}
                  >
                    <Trash2 size={14} /> Clear chat
                  </button>
                </div>

                <div className="tf-assistant-messages" aria-live="polite" aria-busy={loading}>
                  {!messages.length && !loading && (
                    <div className="tf-assistant-welcome">
                      <div className="tf-assistant-welcome-icon"><Sparkles size={21} /></div>
                      <h3>How can I help?</h3>
                      <p>Ask questions based on records you’re authorized to access.</p>
                      <div className="tf-assistant-suggestions">
                        {SUGGESTED_QUESTIONS.map((question) => (
                          <button
                            type="button"
                            key={question}
                            onClick={() => handleSendMessage(null, question)}
                          >
                            {question}<ArrowRight size={14} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <article key={msg.id} className={`tf-assistant-msg ${msg.role}`}>
                      {msg.role === 'assistant' && (
                        <div className="tf-assistant-msg-avatar"><Bot size={14} /></div>
                      )}
                      <div className="tf-assistant-msg-content">
                        <div className="tf-assistant-msg-bubble">
                          {msg.role === 'assistant' ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                          ) : <p>{msg.text}</p>}
                        </div>
                        {msg.role === 'assistant' && msg.taskCards?.length > 0 && (
                          <div className="tf-assistant-task-cards">
                            <h4>Task snapshots</h4>
                            {msg.taskCards.map((task) => (
                              <div className="tf-assistant-task-card" key={`${msg.id}-${task.title}`}>
                                <strong>{task.title}</strong>
                                <span>{(task.status || 'assigned').replaceAll('_', ' ')} · {task.priority || 'medium'} priority</span>
                                {task.dueDate && <small>Due {new Date(task.dueDate).toLocaleDateString()}</small>}
                              </div>
                            ))}
                          </div>
                        )}
                        {msg.role === 'assistant' && (
                          <div className="tf-assistant-message-actions">
                            {msg.mode && <span>{msg.mode === 'openai' ? 'AI · task records' : 'Rule-based · task records'}</span>}
                            <button type="button" onClick={() => handleCopyAnswer(msg)}>
                              <Copy size={13} /> {copiedMessageId === msg.id ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        )}
                        {msg.notice && <small className="tf-assistant-notice">{msg.notice}</small>}
                      </div>
                    </article>
                  ))}
                  {loading && (
                    <div className="tf-assistant-msg assistant">
                      <div className="tf-assistant-msg-avatar"><Bot size={14} /></div>
                      <div className="tf-assistant-msg-bubble tf-typing-indicator" role="status" aria-label="Assistant is typing">
                        <span /><span /><span />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {chatError && <p className="tf-assistant-chat-error" role="alert">{chatError}</p>}
                <form className="tf-assistant-input-form" onSubmit={(event) => handleSendMessage(event)}>
                  <textarea
                    ref={chatInputRef}
                    rows={2}
                    placeholder="Message TaskFlow Assistant…"
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage(event);
                      }
                    }}
                    maxLength={2000}
                    disabled={loading}
                    aria-label="Message TaskFlow Assistant"
                  />
                  <button type="submit" disabled={!inputText.trim() || loading} aria-label="Send message">
                    <Send size={15} />
                  </button>
                  <small>Enter to send · Shift+Enter for a new line</small>
                </form>
              </section>
            </div>
          )}

          {/* TAB 2: AI Goal Breakdown */}
          {activeTab === 'breakdown' && (
            <div className="tf-assistant-breakdown-view">
              <div className="tf-breakdown-intro">
                <Lightbulb size={16} />
                <p>Enter any broad project or goal, and the AI will decompose it into executable subtasks.</p>
              </div>
              <form onSubmit={handleBreakdownGoal} className="tf-breakdown-form">
                <input
                  type="text"
                  placeholder="e.g., Launch mobile onboarding redesign"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  disabled={loading}
                />
                <button type="submit" className="tf-btn tf-btn-sm tf-btn-primary" disabled={!goalInput.trim() || loading}>
                  <Sparkles size={14} /> Break Down Goal
                </button>
              </form>

              {loading && <div className="tf-breakdown-loading">Generating smart breakdown…</div>}
              {breakdownError && <p className="tf-assistant-chat-error" role="status">{breakdownError}</p>}
              {taskActionError && <p className="tf-assistant-chat-error" role="alert">{taskActionError}</p>}

              {breakdownResults.length > 0 && (
                <div className="tf-breakdown-list">
                  <h4>Generated Subtasks ({breakdownResults.length}):</h4>
                  {breakdownResults.map((subtask, idx) => (
                    <div key={idx} className="tf-breakdown-card">
                      <div className="tf-breakdown-card-left">
                        <strong>{subtask.title}</strong>
                        {subtask.description && <small>{subtask.description}</small>}
                        <div className="tf-breakdown-tags">
                          <span className={`tf-badge tf-badge-${subtask.priority}`}>{subtask.priority}</span>
                          {subtask.category && <span className="tf-badge">{subtask.category}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="tf-btn tf-btn-sm tf-btn-secondary"
                        onClick={() => handleAddBreakdownTask(subtask, idx)}
                        disabled={addingTaskIndex === idx}
                        title="Add this subtask to your tasks"
                      >
                        <ListPlus size={14} /> Add Task
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </aside>
  );
}

export default SmartAssistantDock;
