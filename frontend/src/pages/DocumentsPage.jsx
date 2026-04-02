import { useEffect, useState, useRef } from 'react'
import { documentsApi } from '../services/api'
import {
  Upload, Trash2, FileText, File, FileType2,
  Loader2, CheckCircle2, AlertCircle, Clock,
  Sparkles, ChevronDown, ChevronUp, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const TYPE_ICON = {
  pdf: <FileType2 className="w-5 h-5 text-red-500" />,
  docx: <FileText className="w-5 h-5 text-blue-500" />,
  txt: <File className="w-5 h-5 text-slate-500" />,
}

const STATUS = {
  ready:      { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, label: 'Ready', cls: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  processing: { icon: <Loader2 className="w-4 h-4 animate-spin text-amber-500" />, label: 'Processing', cls: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  error:      { icon: <AlertCircle className="w-4 h-4 text-red-500" />, label: 'Error', cls: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
}

function formatBytes(b) {
  if (!b) return '0 B'
  const k = 1024, s = ['B','KB','MB','GB'], i = Math.floor(Math.log(b)/Math.log(k))
  return `${(b/Math.pow(k,i)).toFixed(1)} ${s[i]}`
}

function UploadZone({ onUploaded }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleFiles = async (files) => {
    const file = files[0]
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf','docx','txt'].includes(ext)) {
      toast.error('Only PDF, DOCX, TXT files allowed')
      return
    }
    setUploading(true)
    setProgress(0)
    try {
      await documentsApi.upload(file, setProgress)
      toast.success('Document uploaded! Processing in background…')
      onUploaded()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const onDrop = e => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      onClick={() => !uploading && inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={clsx(
        'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200',
        dragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10' : 'border-slate-300 dark:border-slate-600 hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
      )}
    >
      <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={e => handleFiles(e.target.files)} />
      {uploading ? (
        <div className="space-y-3">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto" />
          <p className="text-sm font-medium">Uploading… {progress}%</p>
          <div className="w-48 mx-auto h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Upload className="w-10 h-10 text-slate-400 mx-auto" />
          <div>
            <p className="font-medium text-sm">Drop your file here, or <span className="text-brand-600">browse</span></p>
            <p className="text-xs text-slate-400 mt-1">PDF, DOCX, TXT · Max 50 MB</p>
          </div>
        </div>
      )}
    </div>
  )
}

function DocRow({ doc, onDelete, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [result, setResult] = useState(null)
  const s = STATUS[doc.status] || STATUS.processing

  const runAction = async (action) => {
    setActionLoading(action)
    try {
      const data = action === 'summarize'
        ? await documentsApi.summarize(doc.id)
        : await documentsApi.insights(doc.id)
      setResult({ type: action, text: action === 'summarize' ? data.summary : data.insights })
      setExpanded(true)
    } catch {
      toast.error('Action failed. Please try again.')
    } finally {
      setActionLoading('')
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.original_name}"?`)) return
    try {
      await documentsApi.delete(doc.id)
      toast.success('Document deleted')
      onDelete(doc.id)
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">{TYPE_ICON[doc.file_type] || TYPE_ICON.txt}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm truncate">{doc.original_name}</p>
            <span className={clsx('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', s.cls)}>
              {s.icon}{s.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span>{formatBytes(doc.file_size)}</span>
            {doc.page_count > 0 && <span>{doc.page_count} pages</span>}
            {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
          </div>
          {doc.error_msg && <p className="text-xs text-red-500 mt-1">{doc.error_msg}</p>}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {doc.status === 'ready' && (
            <>
              <button onClick={() => runAction('summarize')} disabled={!!actionLoading}
                className="btn-ghost text-xs py-1 px-2 gap-1" title="Summarize">
                {actionLoading === 'summarize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Summary</span>
              </button>
              <button onClick={() => runAction('insights')} disabled={!!actionLoading}
                className="btn-ghost text-xs py-1 px-2 gap-1" title="Key Insights">
                {actionLoading === 'insights' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Insights</span>
              </button>
            </>
          )}
          <button onClick={handleDelete} className="btn-ghost text-xs py-1 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {result && (
            <button onClick={() => setExpanded(e => !e)} className="btn-ghost py-1 px-2">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {expanded && result && (
        <div className="border-t px-4 py-3 bg-slate-50 dark:bg-slate-700/30">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
            {result.type === 'summarize' ? '✨ Summary' : '💡 Key Insights'}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{result.text}</p>
        </div>
      )}
    </div>
  )
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const loadDocs = () => {
    documentsApi.list().then(setDocs).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { loadDocs() }, [])

  // Poll for processing docs
  useEffect(() => {
    const processing = docs.some(d => d.status === 'processing')
    if (!processing) return
    const timer = setInterval(loadDocs, 3000)
    return () => clearInterval(timer)
  }, [docs])

  const filtered = filter === 'all' ? docs : docs.filter(d => d.file_type === filter || d.status === filter)

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Upload and manage your knowledge base</p>
      </div>

      <UploadZone onUploaded={loadDocs} />

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all','pdf','docx','txt','ready','processing'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={clsx('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              filter === f
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-brand-400'
            )}>
            {f.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No documents found</p>
          <p className="text-sm">Upload a PDF, DOCX, or TXT to get started</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(doc => (
          <DocRow
            key={doc.id}
            doc={doc}
            onDelete={id => setDocs(d => d.filter(x => x.id !== id))}
            onRefresh={loadDocs}
          />
        ))}
      </div>
    </div>
  )
}
