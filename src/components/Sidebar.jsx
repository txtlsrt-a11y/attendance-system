import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  FileSpreadsheet, 
  Settings, 
  History
} from 'lucide-react'

export const Sidebar = () => {
  const menuItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Manage Workers', path: '/admin/workers', icon: Users },
    { name: 'Manage Shifts', path: '/admin/shifts', icon: CalendarDays },
    { name: 'Attendance Logs', path: '/admin/attendance', icon: History },
    { name: 'Export Reports', path: '/admin/reports', icon: FileSpreadsheet },
    { name: 'Factory Settings', path: '/admin/settings', icon: Settings },
  ]

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col min-h-[calc(100vh-73px)] no-print flex-shrink-0">
      
      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
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

      {/* Sidebar footer / quick instructions */}
      <div className="p-4 border-t border-slate-850">
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
  )
}
