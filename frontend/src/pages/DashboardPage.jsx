import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  FileText, MessageSquare, Zap, HardDrive,
  ArrowRight, TrendingUp, Clock, CheckCircle2, AlertCircle
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import clsx from 'clsx'

function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colors = {
    brand: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={clsx('p-2.5 rounded-lg', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

const STATUS_ICON = {
  ready: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  processing: <Clock className="w-3.5 h-3.5 text-amber-500" />,
  error: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.stats().then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="p-8 space-y-4">
      {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Good {getGreeting()}, {user?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Here's what's happening with your knowledge base.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Documents" value={stats?.documents.total ?? 0} sub={`${stats?.documents.ready ?? 0} ready`} color="brand" />
        <StatCard icon={MessageSquare} label="Chat Sessions" value={stats?.chats.total_sessions ?? 0} sub={`${stats?.chats.total_messages ?? 0} messages`} color="purple" />
        <StatCard icon={Zap} label="Queries This Week" value={stats?.usage.queries_this_week ?? 0} color="amber" />
        <StatCard icon={HardDrive} label="Storage Used" value={formatBytes(stats?.documents.total_size_bytes)} color="green" />
      </div>

      {/* Chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-sm">Query Activity</h2>
            <p className="text-xs text-slate-500">Last 7 days</p>
          </div>
          <TrendingUp className="w-4 h-4 text-brand-500" />
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={stats?.trend ?? []}>
            <defs>
              <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Area type="monotone" dataKey="queries" stroke="#6366f1" fill="url(#qGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent docs + chats */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Recent Documents</h2>
            <Link to="/documents" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {stats?.recent_documents?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No documents yet</p>
          )}
          <div className="space-y-2">
            {stats?.recent_documents?.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                {STATUS_ICON[doc.status]}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 uppercase">{doc.type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Recent Chats</h2>
            <Link to="/chat" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              New chat <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {stats?.recent_chats?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No chats yet. Start a conversation!</p>
          )}
          <div className="space-y-2">
            {stats?.recent_chats?.map(chat => (
              <Link key={chat.id} to={`/chat/${chat.id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <MessageSquare className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{chat.title}</p>
                  <p className="text-xs text-slate-400">{new Date(chat.updated_at).toLocaleDateString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
