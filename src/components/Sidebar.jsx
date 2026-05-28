import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  FileSpreadsheet, 
  Settings, 
  History,
  X
} from 'lucide-react'

export const Sidebar = ({ isOpen, onClose }) => {
  const menuItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Manage Workers', path: '/admin/workers', icon: Users },
    { name: 'Manage Shifts', path: '/admin/shifts', icon: CalendarDays },
    { name: 'Attendance Logs', path: '/admin/attendance', icon: History },
    { name: 'Export Reports', path: '/admin/reports', icon: FileSpreadsheet },
    { name: 'Factory Settings', path: '/admin/settings', icon: Settings },
  ]

  return (
    <>
      {/* Translucent overlay backdrop visible strictly on mobile when drawer is active */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
        />
      )}

      {/* Main Sidebar Shell - behaves as sliding drawer on mobile and standard sidebar on desktop */}
      <aside 
        className={`fixed md:sticky top-0 left-0 h-full md:h-[calc(100vh-73px)] w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-40 no-print flex-shrink-0 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        
        {/* Drawer header on mobile with explicit close button */}
        <div className="flex items-center justify-between p-4 border-b border-slate-850 md:hidden bg-slate-950">
          <span className="text-xs font-black uppercase text-teal-400 tracking-wider">
            Navigation Menu
          </span>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin'}
                onClick={onClose} // Auto-close drawer on link tap/selection
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-500/10 to-indigo-500/10 text-teal-400 border-l-[3px] border-teal-500 pl-[13px]'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border-l-[3px] border-transparent'
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5 flex-shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="p-4 border-t border-slate-850 bg-slate-950/20">
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              System Status
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-emerald-400 font-medium">Supabase Connected</span>
            </div>
          </div>
        </div>

      </aside>
    </>
  )
}
