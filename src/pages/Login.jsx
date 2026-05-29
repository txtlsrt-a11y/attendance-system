import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { Lock, User, Mail, ShieldAlert, Cpu } from 'lucide-react'

export default function Login() {
  const { signIn, user, profile, globalSettings } = useAuth()
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)
  const [identifier, setIdentifier] = useState('') // Worker ID or Admin Email
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Automatically redirect if user and profile are already loaded
  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/worker', { replace: true })
      }
    }
  }, [user, profile, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(identifier, password)
      // Navigation is handled automatically by the useEffect hook above
    } catch (err) {
      console.error(err)
      setError(err.message || 'Login failed. Please check your credentials.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 bg-weave-pattern px-4 relative overflow-hidden">
      
      {/* Background radial glowing effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl p-8 backdrop-blur-xl relative z-10">
        
        {/* Logo and header */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center overflow-hidden mb-4 animate-pulse">
            {globalSettings?.logo_url ? (
              <img src={globalSettings.logo_url} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Cpu className="h-7 w-7 text-white" />
              </div>
            )}
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white text-center">
            {globalSettings?.company_name || 'Textile Shift Attendance'}
          </h1>
          <p className="text-xs text-slate-400 text-center mt-1">
            Factory Attendance Management Portal
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex bg-slate-950 p-1.5 rounded-2xl mb-6 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setIsAdmin(false)
              setIdentifier('')
              setError('')
            }}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition ${
              !isAdmin
                ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Worker Sign-In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdmin(true)
              setIdentifier('')
              setError('')
            }}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition ${
              isAdmin
                ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Admin Sign-In
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-2xl p-4 mb-6 flex items-start gap-3 text-xs leading-relaxed">
            <ShieldAlert className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Access Denied</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Account Sync Diagnostic Warning */}
        {user && !profile && (
          <div className="bg-amber-500/10 border border-amber-500/25 text-amber-400 rounded-2xl p-4 mb-6 flex items-start gap-3 text-xs leading-relaxed">
            <ShieldAlert className="h-5.5 w-5.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="w-full min-w-0">
              <p className="font-black uppercase tracking-wider text-amber-400 text-[10px]">Account Sync Error</p>
              <p className="mt-1 text-slate-300">
                Logged in successfully, but no corresponding record exists in the <code>profiles</code> table for your user ID:
              </p>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 font-mono text-[10px] text-white my-2 select-all break-all text-center font-bold">
                {user.id}
              </div>
              <p className="font-bold text-slate-300 mt-2">How to resolve:</p>
              <p className="mt-1 text-slate-400">
                Open your Supabase **SQL Editor** and run the following command to initialize your administrator profile:
              </p>
              <pre className="bg-slate-950 p-3 rounded-xl border border-slate-850 font-mono text-[9px] text-teal-400 my-2 select-all whitespace-pre-wrap leading-normal font-semibold">
{`INSERT INTO public.profiles (id, role, full_name, worker_id, department)
VALUES ('${user.id}', 'admin', 'Super Admin', 'ADMIN01', 'Management')
ON CONFLICT (id) DO UPDATE SET role = 'admin';`}
              </pre>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              {isAdmin ? 'Corporate Email' : 'Worker ID / Username'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                {isAdmin ? <Mail className="h-4.5 w-4.5" /> : <User className="h-4.5 w-4.5" />}
              </span>
              <input
                type={isAdmin ? 'email' : 'text'}
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isAdmin ? 'admin@company.com' : 'e.g. W1002'}
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-3 pl-11 pr-4 text-sm outline-none placeholder:text-slate-650 transition"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Password
              </label>
              {isAdmin && (
                <a
                  href="#forgot"
                  onClick={() => alert('Forgot password features: Please contact your IT administrator to reset Supabase credentials.')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Forgot?
                </a>
              )}
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                <Lock className="h-4.5 w-4.5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-3 pl-11 pr-4 text-sm outline-none placeholder:text-slate-650 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 mt-2 rounded-xl text-sm font-bold tracking-wider uppercase transition shadow-lg ${
              isAdmin
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/10'
                : 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-500/10'
            } flex items-center justify-center gap-2`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-current" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Verifying credentials...</span>
              </>
            ) : (
              <span>Punch Dashboard Access</span>
            )}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div className="mt-8 border-t border-slate-800/80 pt-6">
          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Note: Admin credentials match your standard Supabase users. For worker login, the Admin must register them inside the Workers panel.
          </p>
        </div>

      </div>
    </div>
  )
}
