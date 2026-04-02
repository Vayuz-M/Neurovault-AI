import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { chatApi, documentsApi } from '../services/api'
import {
  Send, Plus, Trash2, Mic, MicOff, Volume2, VolumeX,
  Loader2, MessageSquare, FileText, ChevronDown, ChevronRight,
  Bot, User, Copy, Check
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ── Markdown renderer ─────────────────────────────────────────────────────────
function MsgContent({ content, streaming }) {
  return (
    <div className={clsx('prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed', streaming && 'cursor-blink')}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

// ── Source chip ───────────────────────────────────────────────────────────────
function SourceChip({ source, docName }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs border border-brand-200 dark:border-brand-800">
      <FileText className="w-2.5 h-2.5" />
      {docName || source.document_id?.slice(0, 8) + '…'} · {Math.round(source.score * 100)}%
    </span>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Message({ msg, streaming, docNames }) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={clsx('flex gap-3 group animate-slide-up', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isUser ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300')}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className={clsx('flex flex-col gap-1 max-w-[80%]', isUser && 'items-end')}>
        <div className={clsx('px-4 py-3 rounded-2xl text-sm',
          isUser
            ? 'bg-brand-600 text-white rounded-tr-sm'
            : 'bg-white dark:bg-slate-800 border rounded-tl-sm shadow-sm'
        )}>
          {isUser
            ? <p className="whitespace-pre-wrap">{msg.content}</p>
            : <MsgContent content={msg.content} streaming={streaming} />
          }
        </div>

        {/* Sources */}
        {!isUser && msg.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {msg.sources.map((s, i) => (
              <SourceChip key={i} source={s} docName={docNames[s.document_id]} />
            ))}
          </div>
        )}

        {/* Copy */}
        {!isUser && !streaming && (
          <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity self-start px-2 py-0.5 rounded text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            {copied ? <><Check className="w-3 h-3 text-green-500" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Session list item ─────────────────────────────────────────────────────────
function SessionItem({ session, active, onClick, onDelete }) {
  return (
    <div
      onClick={onClick}
      className={clsx('group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm',
        active ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium'
               : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-400'
      )}
    >
      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate flex-1">{session.title}</span>
      <button
        onClick={e => { e.stopPropagation(); onDelete(session.id) }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

// ── Main Chat Page ─────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { sessionId: routeSessionId } = useParams()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [docs, setDocs] = useState([])
  const [selectedDocs, setSelectedDocs] = useState([])
  const [showDocFilter, setShowDocFilter] = useState(false)
  const [listening, setListening] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(true)

  const bottomRef = useRef()
  const textareaRef = useRef()
  const recognitionRef = useRef()

  // Doc name map for source display
  const docNames = docs.reduce((acc, d) => { acc[d.id] = d.original_name; return acc }, {})

  // Load sessions + docs on mount
  useEffect(() => {
    chatApi.listSessions().then(setSessions).catch(console.error)
    documentsApi.list().then(d => setDocs(d.filter(x => x.status === 'ready'))).catch(console.error)
  }, [])

  // Load messages when session changes
  useEffect(() => {
    if (!routeSessionId) { setMessages([]); setActiveSession(null); return }
    setActiveSession(routeSessionId)
    chatApi.getMessages(routeSessionId)
      .then(setMessages)
      .catch(() => toast.error('Failed to load chat history'))
  }, [routeSessionId])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const newChat = async () => {
    navigate('/chat')
    setMessages([])
    setActiveSession(null)
  }

  const deleteSession = async (id) => {
    try {
      await chatApi.deleteSession(id)
      setSessions(s => s.filter(x => x.id !== id))
      if (activeSession === id) newChat()
    } catch { toast.error('Could not delete session') }
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    // Optimistic user message
    const userMsg = { id: Date.now(), role: 'user', content: text, sources: [] }
    setMessages(m => [...m, userMsg])
    setStreaming(true)

    // Placeholder assistant message
    const assistId = Date.now() + 1
    setMessages(m => [...m, { id: assistId, role: 'assistant', content: '', sources: [] }])

    try {
      const res = await chatApi.sendMessage(text, activeSession, selectedDocs.length ? selectedDocs : null)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let sources = []
      let newSessionId = activeSession

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'sources') {
              sources = event.data
              newSessionId = event.session_id || newSessionId
              setMessages(m => m.map(x => x.id === assistId ? { ...x, sources } : x))
            } else if (event.type === 'token') {
              setMessages(m => m.map(x => x.id === assistId ? { ...x, content: x.content + event.data } : x))
            } else if (event.type === 'done') {
              newSessionId = event.session_id || newSessionId
            } else if (event.type === 'error') {
              toast.error(event.data)
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // Navigate to the session
      if (newSessionId && newSessionId !== activeSession) {
        setActiveSession(newSessionId)
        navigate(`/chat/${newSessionId}`, { replace: true })
        chatApi.listSessions().then(setSessions)
      }

      // TTS
      if (ttsEnabled) {
        const finalMsg = messages.find(m => m.id === assistId)
        if (finalMsg?.content) {
          const utterance = new SpeechSynthesisUtterance(finalMsg.content.slice(0, 500))
          window.speechSynthesis.speak(utterance)
        }
      }
    } catch (err) {
      toast.error('Message failed. Check your connection.')
      setMessages(m => m.filter(x => x.id !== assistId))
    } finally {
      setStreaming(false)
    }
  }, [input, streaming, activeSession, selectedDocs, ttsEnabled])

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // Speech-to-text
  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast.error('Speech recognition not supported in this browser')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = e => setInput(i => i + ' ' + e.results[0][0].transcript)
    rec.onend = () => setListening(false)
    rec.start()
    recognitionRef.current = rec
    setListening(true)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sessions sidebar */}
      <div className={clsx('flex flex-col border-r bg-white dark:bg-slate-800 transition-all duration-200 flex-shrink-0',
        sessionsOpen ? 'w-56' : 'w-0 overflow-hidden')}>
        <div className="p-3 border-b">
          <button onClick={newChat} className="btn-primary w-full justify-center text-xs py-2">
            <Plus className="w-3.5 h-3.5" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">No chats yet</p>
          )}
          {sessions.map(s => (
            <SessionItem key={s.id} session={s} active={s.id === activeSession}
              onClick={() => navigate(`/chat/${s.id}`)}
              onDelete={deleteSession} />
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-white dark:bg-slate-800">
          <button onClick={() => setSessionsOpen(o => !o)} className="btn-ghost py-1.5">
            {sessionsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <span className="text-sm font-medium flex-1 truncate">
            {activeSession ? sessions.find(s => s.id === activeSession)?.title || 'Chat' : 'New Chat'}
          </span>

          {/* Doc filter */}
          <div className="relative">
            <button onClick={() => setShowDocFilter(o => !o)}
              className={clsx('btn-ghost text-xs py-1.5 px-2.5', selectedDocs.length && 'text-brand-600 bg-brand-50 dark:bg-brand-900/20')}>
              <FileText className="w-3.5 h-3.5" />
              {selectedDocs.length ? `${selectedDocs.length} doc${selectedDocs.length > 1 ? 's' : ''}` : 'All docs'}
            </button>
            {showDocFilter && (
              <div className="absolute right-0 top-10 w-64 card shadow-lg z-20 p-2 space-y-1 max-h-60 overflow-y-auto">
                <p className="text-xs font-semibold text-slate-500 px-2 pb-1">Filter to specific documents</p>
                {docs.map(d => (
                  <label key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                    <input type="checkbox" className="rounded accent-brand-600"
                      checked={selectedDocs.includes(d.id)}
                      onChange={e => setSelectedDocs(s => e.target.checked ? [...s, d.id] : s.filter(x => x !== d.id))} />
                    <span className="text-xs truncate">{d.original_name}</span>
                  </label>
                ))}
                {docs.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No ready documents</p>}
                {selectedDocs.length > 0 && (
                  <button onClick={() => setSelectedDocs([])} className="text-xs text-red-500 px-2 py-1 hover:underline">Clear filter</button>
                )}
              </div>
            )}
          </div>

          {/* TTS toggle */}
          <button onClick={() => setTtsEnabled(t => !t)}
            className={clsx('btn-ghost py-1.5', ttsEnabled && 'text-brand-600')} title="Text-to-speech">
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 text-slate-400">
              <Bot className="w-14 h-14 opacity-20" />
              <div>
                <p className="font-medium text-slate-600 dark:text-slate-300">Start a conversation</p>
                <p className="text-sm mt-1">Ask anything about your uploaded documents</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {['Summarize my documents', 'What are the key points?', 'Compare the documents', 'Find information about…'].map(q => (
                  <button key={q} onClick={() => setInput(q)}
                    className="text-left text-xs p-3 rounded-xl border hover:border-brand-400 hover:text-brand-600 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <Message
              key={msg.id || i}
              msg={msg}
              streaming={streaming && i === messages.length - 1 && msg.role === 'assistant'}
              docNames={docNames}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-4 py-3 border-t bg-white dark:bg-slate-800">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask a question about your documents…"
                rows={1}
                className="input resize-none py-2.5 pr-10 max-h-40 overflow-y-auto leading-relaxed"
                style={{ height: 'auto' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                disabled={streaming}
              />
            </div>
            <button onClick={toggleListening}
              className={clsx('btn-ghost p-2.5 flex-shrink-0', listening && 'text-red-500 animate-pulse')}
              title="Voice input">
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button onClick={sendMessage} disabled={!input.trim() || streaming}
              className="btn-primary p-2.5 flex-shrink-0">
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">
            Shift+Enter for new line · Answers sourced from your documents
          </p>
        </div>
      </div>
    </div>
  )
}
