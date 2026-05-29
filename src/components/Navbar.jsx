import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { LogOut, Clock, User, Award, Menu } from 'lucide-react'

export const Navbar = ({ onMenuClick }) => {
  const { profile, signOut, globalSettings } = useAuth()
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
    <nav className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-30 no-print">
      
      {/* Menu Hamburger Trigger & Logo Brand */}
      <div className="flex items-center gap-3">
        {/* Visible strictly on mobile layouts */}
        {profile?.role === 'admin' && (
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition flex-shrink-0"
            title="Toggle Menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
            {globalSettings?.logo_url ? (
              <img src={globalSettings.logo_url} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/10">
                <Award className="h-4.5 w-4.5 text-white" />
              </div>
            )}
          </div>
          <div className="leading-none">
            <span className="text-xs font-black text-white tracking-wider uppercase block">
              Textile Shift
            </span>
            <span className="text-[9px] text-teal-400 font-extrabold tracking-widest uppercase block mt-0.5">
              Attendance
            </span>
          </div>
        </div>
      </div>

      {/* Clock and User details */}
      <div className="flex items-center gap-3 sm:gap-6">
        
        {/* Real-time Clock (visible on desktop) */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-880 font-mono text-xs text-slate-350">
          <Clock className="h-4 w-4 text-teal-400" />
          <span>{time.toLocaleDateString()}</span>
          <span className="text-slate-600">|</span>
          <span className="font-bold text-teal-400">{time.toLocaleTimeString()}</span>
        </div>

        {/* User Card */}
        {profile && (
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-950/40 pl-2 sm:pl-3 pr-3 sm:pr-4 py-1 rounded-xl border border-slate-850">
            {profile.photo_url ? (
              <img
                src={profile.photo_url}
                alt="Profile"
                className="h-6 w-6 sm:h-7 sm:w-7 rounded-full object-cover border border-slate-700 flex-shrink-0"
              />
            ) : (
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-300 flex-shrink-0">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
            
            <div className="text-left leading-tight hidden xs:block">
              <span className="text-[11px] sm:text-xs font-bold text-slate-200 block truncate max-w-[80px] sm:max-w-[120px]">
                {profile.full_name.split(' ')[0]}
              </span>
              <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                {profile.role === 'admin' ? 'Admin' : `${profile.department || 'Staff'}`}
              </span>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2 bg-slate-950 border border-slate-850 hover:bg-rose-950/20 hover:border-rose-900/40 text-slate-400 hover:text-rose-455 rounded-xl transition-all flex-shrink-0"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </button>

      </div>
    </nav>
  )
}
