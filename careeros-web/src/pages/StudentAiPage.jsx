import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api.js";
import { Badge, ErrorBlock, LoadingBlock, PageHeader } from "../components/ui.jsx";
import { Icon } from "../components/Icon.jsx";

const SUGGESTIONS = [
  { query: "What skills am I missing for my target career?", title: "Am I ready?", desc: "See what is missing for your target role." },
  { query: "What should I learn next?", title: "What to study next", desc: "Your most important next step." },
  { query: "Explain my assessment result.", title: "My test score", desc: "Understand your result in simple words." },
  { query: "Which roadmap step should I focus on?", title: "Where to focus", desc: "The one thing to do this week." },
  { query: "How can I improve my CV?", title: "Fix my CV", desc: "Quick fixes to get shortlisted." },
  { query: "What projects should I complete?", title: "Which projects?", desc: "Projects that prove your skills." },
];

const FOLLOW_UPS = ["Give me a 30-day plan", "Explain my assessment result", "What should I learn next?"];

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Inline({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>)}</>;
}

function Markdown({ content }) {
  const blocks = [];
  let list = [];
  const flush = () => {
    if (list.length > 0) {
      blocks.push(<ul key={`list-${blocks.length}`}>{list.map((item, index) => <li key={index}><Inline text={item} /></li>)}</ul>);
      list = [];
    }
  };
  for (const raw of String(content || "").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flush();
    if (line === "---") {
      blocks.push(<hr key={`hr-${blocks.length}`} />);
    } else {
      blocks.push(<p key={`p-${blocks.length}`}><Inline text={line} /></p>);
    }
  }
  flush();
  return <div className="markdown-answer">{blocks}</div>;
}

function friendlyError(reason) {
  if (!reason) return "Could not get a reply. Please try again.";
  if (!reason.status) return "Unable to reach the server. Check your connection and try again.";
  if (reason.status === 404) return "This conversation no longer exists. Start a new one.";
  if (reason.status === 401) return "Your session expired. Please log in again.";
  return reason.message || "Could not get a reply. Please try again.";
}

export function StudentAiPage() {
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);
  const [search, setSearch] = useState("");
  const [lastMeta, setLastMeta] = useState(null);
  const [retryText, setRetryText] = useState(null);
  const sendingRef = useRef(false);
  const activeIdRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const loadSessions = useCallback(async (selectId) => {
    try {
      const data = await api.get("/ai/chat/sessions");
      const list = Array.isArray(data) ? data : [];
      setSessions(list);
      if (selectId) setActiveId(selectId);
      else if (list.length > 0) setActiveId((current) => current ?? list[0].id);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const loadHistory = useCallback(async (sessionId, silent = false) => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    if (!silent) setLoadingHistory(true);
    try {
      const data = await api.get(`/ai/chat/sessions/${sessionId}`);
      setMessages(Array.isArray(data) ? data : []);
    } catch (reason) {
      if (!silent) setError(friendlyError(reason));
    } finally {
      if (!silent) setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    api.get("/ai/status").then(setStatus).catch(() => setStatus(null));
    loadSessions();
  }, [loadSessions]);

  useEffect(() => { loadHistory(activeId); }, [activeId, loadHistory]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, sending]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) => (session.title || "").toLowerCase().includes(query));
  }, [sessions, search]);

  async function newConversation() {
    if (sendingRef.current) return;
    try {
      const session = await api.post("/ai/chat/sessions", {});
      await loadSessions(session.id);
      setMessages([]);
      setLastMeta(null);
      textareaRef.current?.focus();
    } catch (reason) {
      setError(friendlyError(reason));
    }
  }

  async function removeSession(sessionId) {
    if (sendingRef.current) return;
    try {
      await api.delete(`/ai/chat/sessions/${sessionId}`);
      const remaining = sessions.filter((session) => session.id !== sessionId);
      setSessions(remaining);
      if (activeIdRef.current === sessionId) {
        setActiveId(remaining[0]?.id ?? null);
        if (remaining.length === 0) setMessages([]);
      }
      toast.success("Conversation deleted.");
    } catch (reason) {
      toast.error(friendlyError(reason));
    }
  }

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || sendingRef.current) return;
    if (content.length > 4000) {
      setError("Please keep messages under 4000 characters.");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setError("");
    setRetryText(null);
    setInput("");
    const previous = activeIdRef.current;
    const optimisticId = `local-${Date.now()}`;
    setMessages((current) => [...current, { id: optimisticId, role: "USER", content, createdAt: new Date().toISOString() }]);
    try {
      let sessionId = previous;
      if (!sessionId) {
        const session = await api.post("/ai/chat/sessions", {});
        sessionId = session.id;
      }
      const reply = await api.post(`/ai/chat/sessions/${sessionId}/messages`, { message: content });
      setLastMeta(reply);
      await loadHistory(sessionId, true);
      await loadSessions(sessionId);
    } catch (reason) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      setError(friendlyError(reason));
      setRetryText(content);
      if (previous) await loadHistory(previous, true);
    } finally {
      sendingRef.current = false;
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  const activeSession = sessions.find((session) => session.id === activeId);
  const lastAssistant = messages.map((message) => message.role).lastIndexOf("ASSISTANT");
  const offline = status?.mode === "offline-smart" || (status && !status.configured);

  return <main className="workspace-page ai-page">
    <PageHeader eyebrow="SMART GUIDANCE" title="AI career assistant" description="Ask about your readiness, gaps, roadmap, projects, CV, placements, and next steps. Answers use your saved CareerOS data." actions={<button className="primary-button" onClick={newConversation}><Icon name="plus" size={15} /> New chat</button>} />
    {error && <div className="success-banner roadmap-error" role="alert"><span>{error}</span>{retryText && <button type="button" className="text-button" onClick={() => { setError(""); send(retryText); }}>Retry</button>}</div>}
    {offline && <div className="ai-banner"><Icon name="spark" size={16} /><span><strong>Ready to use.</strong> Answers come from your saved profile, assessments, roadmap, CV and placement data.</span></div>}

    <div className="ai-layout">
      <aside className="ai-sidebar settings-card">
        <div className="ai-sidebar-head"><strong>Your chats</strong><span>{sessions.length} saved</span></div>
        <input className="search-input ai-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
        <div className="ai-session-list">
          {loadingSessions ? <LoadingBlock label="Loading chats..." /> : filtered.length === 0 ? <p className="muted ai-empty">{sessions.length === 0 ? "No conversations yet. Send your first message." : "No matching conversations."}</p> : filtered.map((session) => <div key={session.id} className={`ai-session ${session.id === activeId ? "ai-session-active" : ""}`}>
            <button type="button" onClick={() => setActiveId(session.id)}><strong>{session.title}</strong><span>{formatDate(session.updatedAt)}</span></button>
            <button type="button" className="ai-session-delete" onClick={() => removeSession(session.id)} aria-label={`Delete ${session.title}`}><Icon name="trash" size={14} /></button>
          </div>)}
        </div>
      </aside>

      <section className="ai-chat settings-card">
        <header className="ai-chat-head"><div><strong>{activeSession?.title || "AI career assistant"}</strong><span><Icon name="spark" size={12} /> Grounded in your CareerOS data</span></div><Badge tone="info">{messages.length} messages</Badge></header>
        <div className="ai-messages" ref={scrollRef}>
          {loadingHistory ? <LoadingBlock label="Loading conversation..." /> : messages.length === 0 && !sending ? <div className="ai-welcome">
            <span className="settings-icon"><Icon name="spark" size={20} /></span>
            <h2>How can I help you today?</h2>
            <p>I already know your progress. Pick a question or type your own.</p>
            <div className="ai-suggestions">{SUGGESTIONS.map((card) => <button key={card.query} type="button" disabled={sending} onClick={() => send(card.query)}><strong>{card.title}<Icon name="arrow" size={13} /></strong><span>{card.desc}</span></button>)}</div>
          </div> : messages.map((message, index) => <div key={message.id ?? index} className={`ai-message ${message.role === "USER" ? "ai-message-user" : "ai-message-bot"}`}>
            <span className="ai-avatar"><Icon name={message.role === "USER" ? "users" : "spark"} size={14} /></span>
            <div className="ai-bubble">
              {message.role === "USER" ? <p>{message.content}</p> : <Markdown content={message.content} />}
              <div className="ai-message-meta"><span>{formatDate(message.createdAt)}</span>{message.role === "ASSISTANT" && index === lastAssistant && lastMeta?.toolsUsed?.length > 0 && <Badge tone="info">From your data</Badge>}</div>
              {message.role === "ASSISTANT" && index === lastAssistant && !sending && <div className="ai-follow-ups">{FOLLOW_UPS.map((tip) => <button key={tip} type="button" onClick={() => send(tip)}>{tip}</button>)}</div>}
            </div>
          </div>)}
          {sending && <div className="ai-message ai-message-bot"><span className="ai-avatar"><Icon name="spark" size={14} /></span><div className="ai-bubble ai-typing"><span /><span /><span /> Thinking...</div></div>}
        </div>
        <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
          <textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} maxLength={4000} rows={2} disabled={sending} placeholder="Ask about your readiness, skills, CV or placements..." aria-label="Message the AI career assistant" />
          <div><span>Enter sends, Shift+Enter adds a new line.</span><button className="primary-button" type="submit" disabled={sending || !input.trim()}><Icon name="send" size={14} /> {sending ? "Thinking..." : "Send"}</button></div>
        </form>
      </section>
    </div>
  </main>;
}

