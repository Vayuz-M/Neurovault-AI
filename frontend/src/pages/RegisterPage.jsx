import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Brain, Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', fullName: '', password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await register(form.email, form.fullName, form.password)
      toast.success('Account created!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-brand-600 to-brand-900 p-12 text-white">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8" />
          <span className="font-bold text-xl">NeuroVault AI</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Start retrieving knowledge<br />from your documents<br />in minutes.
          </h1>
          <ul className="space-y-2 text-brand-200">
            {['Upload PDF, DOCX, TXT', 'AI-powered Q&A', 'Semantic search', 'Chat history & memory'].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-300" />{f}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-brand-300 text-sm">© 2024 NeuroVault AI</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-slate-900">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Brain className="w-6 h-6 text-brand-600" />
            <span className="font-bold text-lg">NeuroVault AI</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">Create account</h2>
          <p className="text-slate-500 mb-8 text-sm">Free forever. No credit card needed.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name</label>
              <input type="text" required className="input" placeholder="Jane Doe" value={form.fullName} onChange={set('fullName')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input type="email" required className="input" placeholder="you@example.com" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required minLength={8}
                  className="input pr-10" placeholder="Min. 8 characters"
                  value={form.password} onChange={set('password')} />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
              <input type="password" required className="input" placeholder="Re-enter password" value={form.confirm} onChange={set('confirm')} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
