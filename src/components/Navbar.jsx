import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { LogOut, Clock, User, Award } from 'lucide-react'

export const Navbar = () => {
  const { profile, signOut } = useAuth()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      try {
        await signOut()
      } catch (err) {
        console.error('Logout error:', err)
      }
    }
  }

  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30 no-print">
      
      {/* Brand logo & title */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/10">
          <Award className="h-5 w-5 text-white" />
        </div>
        <div>
          <span className="text-sm font-extrabold text-white tracking-wider uppercase block">
            Textile Shift
          </span>
          <span className="text-[10px] text-teal-400 font-semibold tracking-widest uppercase block -mt-1">
            Attendance
          </span>
        </div>
      </div>

      {/* Clock and User details */}
      <div className="flex items-center gap-6">
        
        {/* Real-time Clock (visible on desktop) */}
        <div className="hidden md:flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-350">
          <Clock className="h-4 w-4 text-teal-400" />
          <span>{time.toLocaleDateString()}</span>
          <span className="text-slate-600">|</span>
          <span className="font-bold text-teal-400">{time.toLocaleTimeString()}</span>
        </div>

        {/* User Card */}
        {profile && (
          <div className="flex items-center gap-3 bg-slate-950/40 pl-3 pr-4 py-1.5 rounded-xl border border-slate-850">
            {profile.photo_url ? (
              <img
                src={profile.photo_url}
                alt="Profile"
                className="h-7 w-7 rounded-full object-cover border border-slate-700"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-300">
                <User className="h-4 w-4" />
              </div>
            )}
            
            <div className="text-left leading-tight hidden sm:block">
              <span className="text-xs font-bold text-slate-200 block truncate max-w-[120px]">
                {profile.full_name}
              </span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                {profile.role === 'admin' ? 'Administrator' : `${profile.department || 'Production'} / ${profile.shifts?.shift_name || 'No Shift'}`}
              </span>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2.5 bg-slate-950 border border-slate-850 hover:bg-rose-950/20 hover:border-rose-900/40 text-slate-400 hover:text-rose-400 rounded-xl transition-all"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </button>

      </div>
    </nav>
  )
}
