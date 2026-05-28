import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { getLocalDateString, formatTime12h } from '../../utils/dateHelpers'
import { 
  Users, 
  UserCheck, 
  UserX, 
  Sun, 
  Moon, 
  Clock, 
  MapPin, 
  ArrowRight,
  TrendingUp
} from 'lucide-react'

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState({
    totalWorkers: 0,
    presentToday: 0,
    absentToday: 0,
    shift1Count: 0, // Day Shift
    shift2Count: 0  // Night Shift
  })
  const [recentPunches, setRecentPunches] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const todayStr = getLocalDateString()

      // 1. Fetch total workers
      const { count: workersCount, error: workersErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'worker')

      if (workersErr) throw workersErr

      // 2. Fetch today's unique present workers (pushed IN today)
      const { data: presentData, error: presentErr } = await supabase
        .from('attendance')
        .select('worker_id')
        .eq('attendance_date', todayStr)
        .eq('punch_type', 'IN')

      if (presentErr) throw presentErr

      // Filter duplicates in application layer
      const uniquePresent = new Set((presentData || []).map(p => p.worker_id))
      const presentCount = uniquePresent.size
      const absentCount = Math.max(0, (workersCount || 0) - presentCount)

      // 3. Fetch shifts list to map names
      const { data: shiftsList, error: shiftsErr } = await supabase
        .from('shifts')
        .select('*')

      if (shiftsErr) throw shiftsErr
      
      const dayShift = shiftsList.find(s => s.shift_name.toLowerCase().includes('day'))
      const nightShift = shiftsList.find(s => s.shift_name.toLowerCase().includes('night'))

      // 4. Count worker shift assignments
      const { data: workerShifts, error: wsErr } = await supabase
        .from('profiles')
        .select('shift_id')
        .eq('role', 'worker')

      if (wsErr) throw wsErr

      let s1Count = 0
      let s2Count = 0

      workerShifts.forEach(w => {
        if (dayShift && w.shift_id === dayShift.id) s1Count++
        if (nightShift && w.shift_id === nightShift.id) s2Count++
      })

      setMetrics({
        totalWorkers: workersCount || 0,
        presentToday: presentCount,
        absentToday: absentCount,
        shift1Count: s1Count,
        shift2Count: s2Count
      })

      // 5. Fetch recent 5 punches
      const { data: punchLogs, error: punchErr } = await supabase
        .from('attendance')
        .select('*, profiles(*), shifts(*)')
        .order('punch_time', { ascending: false })
        .limit(5)

      if (punchErr) throw punchErr
      setRecentPunches(punchLogs || [])

    } catch (err) {
      console.error('Error fetching dashboard statistics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()

    // Setup real-time listeners for updates
    const channel = supabase
      .channel('attendance-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        fetchDashboardData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="p-6 space-y-6">
      
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">
            Dashboard Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time analytics and factory status logs
          </p>
        </div>
        
        <button
          onClick={fetchDashboardData}
          className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition"
        >
          <Clock className="h-4 w-4 text-teal-400" />
          Refresh Stats
        </button>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Total Workers Card */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 flex items-center justify-between shadow-lg relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 text-slate-950/40 pointer-events-none">
            <Users className="h-20 w-20" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Total Workers
            </span>
            <span className="text-2xl font-black text-white mt-1 block">
              {loading ? '...' : metrics.totalWorkers}
            </span>
            <span className="text-[10px] text-teal-400 font-semibold mt-1 flex items-center gap-1">
              Enrolled in database
            </span>
          </div>
        </div>

        {/* Present Today Card */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 flex items-center justify-between shadow-lg relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 text-slate-950/40 pointer-events-none">
            <UserCheck className="h-20 w-20" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Present Today
            </span>
            <span className="text-2xl font-black text-emerald-450 mt-1 block">
              {loading ? '...' : metrics.presentToday}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
              Active punches logged
            </span>
          </div>
        </div>

        {/* Absent Today Card */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 flex items-center justify-between shadow-lg relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 text-slate-950/40 pointer-events-none">
            <UserX className="h-20 w-20" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Absent Today
            </span>
            <span className="text-2xl font-black text-rose-450 mt-1 block">
              {loading ? '...' : metrics.absentToday}
            </span>
            <span className="text-[10px] text-rose-450 font-semibold mt-1 flex items-center gap-1">
              No punch in registered
            </span>
          </div>
        </div>

        {/* Shift 1 Card */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 flex items-center justify-between shadow-lg relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 text-slate-950/40 pointer-events-none">
            <Sun className="h-20 w-20" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Day Shift Workers
            </span>
            <span className="text-2xl font-black text-amber-450 mt-1 block">
              {loading ? '...' : metrics.shift1Count}
            </span>
            <span className="text-[10px] text-amber-500 font-semibold mt-1 flex items-center gap-1">
              Assigned to Day
            </span>
          </div>
        </div>

        {/* Shift 2 Card */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 flex items-center justify-between shadow-lg relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 text-slate-950/40 pointer-events-none">
            <Moon className="h-20 w-20" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Night Shift Workers
            </span>
            <span className="text-2xl font-black text-indigo-400 mt-1 block">
              {loading ? '...' : metrics.shift2Count}
            </span>
            <span className="text-[10px] text-indigo-305 font-semibold mt-1 flex items-center gap-1">
              Assigned to Night
            </span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Live Attendance Punch Feed (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-850 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-850 pb-4">
            <TrendingUp className="h-5 w-5 text-teal-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              Live Activity Stream
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-teal-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : recentPunches.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-10">
              No recent attendance logs registered.
            </p>
          ) : (
            <div className="space-y-4">
              {recentPunches.map((punch) => (
                <div 
                  key={punch.id} 
                  className="bg-slate-950/50 border border-slate-850 hover:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-all"
                >
                  <div className="flex gap-4 items-center">
                    {/* Selfie Preview */}
                    <div className="relative group">
                      <img
                        src={punch.selfie_url}
                        alt="Selfie"
                        className="h-12 w-12 rounded-xl object-cover border border-slate-800"
                      />
                      {/* Zoom on hover */}
                      <div className="absolute left-14 top-0 hidden group-hover:block z-50 bg-slate-900 border border-slate-700 p-1 rounded-lg shadow-2xl">
                        <img src={punch.selfie_url} alt="Zoom" className="h-40 w-40 object-cover rounded" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-white">{punch.profiles?.full_name}</h4>
                        <span className="text-[10px] text-slate-500 font-mono">({punch.profiles?.worker_id})</span>
                      </div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                        {punch.profiles?.department || 'Production'} • {punch.shifts?.shift_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t border-slate-850 sm:border-0 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right leading-tight">
                      <span className="text-xs font-bold text-slate-200 block">
                        {new Date(punch.punch_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="text-[9px] text-slate-500 block font-bold">
                        {punch.attendance_date}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        punch.punch_type === 'IN' ? 'bg-teal-500/10 text-teal-400' : 'bg-indigo-500/10 text-indigo-400'
                      }`}>
                        {punch.punch_type}
                      </span>
                      
                      <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        punch.status === 'Present' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                        punch.status === 'Late' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                        'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}>
                        {punch.status}
                      </span>

                      {punch.latitude ? (
                        <MapPin className="h-4.5 w-4.5 text-emerald-450" title={`GPS: ${punch.latitude}, ${punch.longitude}`} />
                      ) : (
                        <MapPin className="h-4.5 w-4.5 text-slate-700" title="GPS Unavailable" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Operations / Department Stats (1 Col) */}
        <div className="bg-slate-900/80 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-6">
          
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              Department Presence
            </h2>
            <div className="space-y-4">
              {/* Spinning / Weaving Departments */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1.5">
                  <span>Spinning Floor</span>
                  <span className="text-white">92%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-teal-500 h-full rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1.5">
                  <span>Weaving Floor</span>
                  <span className="text-white">88%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: '88%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1.5">
                  <span>Dyeing Floor</span>
                  <span className="text-white">79%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: '79%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1.5">
                  <span>Garments Inspection</span>
                  <span className="text-white">95%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '95%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-850">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Attendance Guidelines
            </h3>
            <ul className="text-[11px] text-slate-500 space-y-2 pl-4 list-disc leading-relaxed">
              <li>Attendance entries undergo dynamic client location check-ins.</li>
              <li>Punches made within 5 minutes of each other are automatically cached as duplicates.</li>
              <li>Manual adjustments by admins are logged directly for audit safety.</li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  )
}
