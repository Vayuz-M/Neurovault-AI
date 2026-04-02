import { useState } from 'react'
import { searchApi } from '../services/api'
import { Search, FileText, Loader2, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

function highlightText(text, query) {
  if (!query) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{part}</mark> : part
  )
}

const TYPE_COLOR = {
  pdf:  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  docx: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  txt:  'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fileType, setFileType] = useState('')

  const doSearch = async (e) => {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await searchApi.search(query.trim(), 10, fileType || null)
      setResults(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Semantic Search</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Search across all your documents using natural language
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={doSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. What are the main conclusions about climate change?"
            className="input pl-9 py-3"
          />
        </div>
        <select
          value={fileType}
          onChange={e => setFileType(e.target.value)}
          className="input w-28"
        >
          <option value="">All types</option>
          <option value="pdf">PDF</option>
          <option value="docx">DOCX</option>
          <option value="txt">TXT</option>
        </select>
        <button type="submit" disabled={loading || !query.trim()} className="btn-primary px-5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            {results.total} result{results.total !== 1 ? 's' : ''} for &ldquo;{results.query}&rdquo;
          </p>

          {results.results.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No results found</p>
              <p className="text-sm">Try different keywords or upload more documents</p>
            </div>
          )}

          {results.results.map((r, i) => (
            <div key={i} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                    {r.document_name}
                  </span>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium uppercase', TYPE_COLOR[r.file_type])}>
                    {r.file_type}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div
                    className="h-1.5 w-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
                    title={`Relevance: ${Math.round(r.score * 100)}%`}
                  >
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${Math.min(r.score * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{Math.round(r.score * 100)}%</span>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-4">
                {highlightText(r.text, query)}
              </p>

              {r.chunk_index !== undefined && (
                <p className="text-xs text-slate-400 mt-2">Chunk #{r.chunk_index + 1}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state before search */}
      {!results && !loading && (
        <div className="text-center py-16 text-slate-400">
          <Search className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-slate-500 dark:text-slate-400">Enter a query to search your documents</p>
          <p className="text-sm mt-1">Uses semantic similarity – no exact keywords needed</p>
        </div>
      )}
    </div>
  )
}
