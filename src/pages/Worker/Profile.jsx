import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase'
import { formatTime12h, getLocalDateString } from '../../utils/dateHelpers'
import { User, Phone, Briefcase, CalendarDays, Key, MapPin, Timer } from 'lucide-react'

export default function WorkerProfile() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ today: 0, weekly: 0, monthly: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWorkerStats = async () => {
      if (!profile) return
      try {
        const thirtyOneDaysAgo = new Date()
        thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31)
        const thirtyOneDaysAgoStr = getLocalDateString(thirtyOneDaysAgo)

        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('worker_id', profile.id)
          .gte('attendance_date', thirtyOneDaysAgoStr)

        if (error) throw error

        const todayStr = getLocalDateString()
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        const startOfMonthStr = getLocalDateString(startOfMonth)

        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo)

        const logs = data || []

        const otToday = logs
          .filter(log => log.attendance_date === todayStr)
          .reduce((sum, log) => sum + parseFloat(log.overtime_hours || 0), 0)

        const otWeekly = logs
          .filter(log => log.attendance_date >= sevenDaysAgoStr)
          .reduce((sum, log) => sum + parseFloat(log.overtime_hours || 0), 0)

        const otMonthly = logs
          .filter(log => log.attendance_date >= startOfMonthStr)
          .reduce((sum, log) => sum + parseFloat(log.overtime_hours || 0), 0)

        setStats({ today: otToday, weekly: otWeekly, monthly: otMonthly })
      } catch (err) {
        console.error('Error fetching worker profile stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchWorkerStats()
  }, [profile])

  return (
    <div className="min-h-screen bg-slate-950 bg-weave-pattern pb-12">
      <div className="max-w-xl mx-auto px-4 pt-10">
        
        {/* Profile Card Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden mb-6 text-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex flex-col items-center">
            {profile?.photo_url ? (
              <img
                src={profile.photo_url}
                alt="Worker profile"
                className="h-28 w-28 rounded-full object-cover border-4 border-slate-800 shadow-xl"
              />
            ) : (
              <div className="h-28 w-28 rounded-full bg-slate-800 border-4 border-slate-800 shadow-xl flex items-center justify-center text-slate-350 mx-auto">
                <User className="h-12 w-12" />
              </div>
            )}

            <h2 className="text-xl font-black text-white mt-4">{profile?.full_name}</h2>
            <span className="text-[10px] text-teal-400 font-extrabold uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-full border border-slate-850 mt-2">
              {profile?.role === 'worker' ? 'Factory Worker' : 'Administrator'}
            </span>
          </div>

          {/* Overtime Stats Row */}
          <div className="grid grid-cols-3 gap-3.5 mt-6 border-t border-slate-800/80 pt-6">
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-850">
              <span className="text-[9px] font-black uppercase text-slate-500 block tracking-wider">Today's OT</span>
              <span className={`text-lg font-black block mt-1 ${stats.today > 0 ? 'text-teal-405' : 'text-slate-400'}`}>
                {loading ? '...' : `${stats.today.toFixed(2)}h`}
              </span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-850">
              <span className="text-[9px] font-black uppercase text-slate-500 block tracking-wider">Weekly OT</span>
              <span className={`text-lg font-black block mt-1 ${stats.weekly > 0 ? 'text-indigo-400' : 'text-slate-400'}`}>
                {loading ? '...' : `${stats.weekly.toFixed(2)}h`}
              </span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-850">
              <span className="text-[9px] font-black uppercase text-slate-500 block tracking-wider">Monthly OT</span>
              <span className={`text-lg font-black block mt-1 ${stats.monthly > 0 ? 'text-amber-405' : 'text-slate-400'}`}>
                {loading ? '...' : `${stats.monthly.toFixed(2)}h`}
              </span>
            </div>
          </div>

          {/* Details list */}
          <div className="mt-6 space-y-4 border-t border-slate-800/80 pt-6">
            
            <div className="flex items-center gap-4 text-slate-300">
              <Key className="h-5 w-5 text-indigo-400 flex-shrink-0" />
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Worker ID
                </span>
                <span className="text-sm font-mono text-white font-semibold">
                  {profile?.worker_id || 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-300">
              <Phone className="h-5 w-5 text-indigo-400 flex-shrink-0" />
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Mobile Number
                </span>
                <span className="text-sm font-semibold text-white">
                  {profile?.mobile || 'No mobile linked'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-300">
              <Briefcase className="h-5 w-5 text-indigo-400 flex-shrink-0" />
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Department
                </span>
                <span className="text-sm font-semibold text-white">
                  {profile?.department || 'Helper'}
                </span>
              </div>
            </div>

            {profile?.shifts && (
              <div className="flex items-center gap-4 text-slate-300">
                <CalendarDays className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                <div className="text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Assigned Shift Hours
                  </span>
                  <span className="text-sm font-extrabold text-teal-400">
                    {profile.shifts.shift_name} ({formatTime12h(profile.shifts.start_time)} - {formatTime12h(profile.shifts.end_time)})
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Grace time limit: {profile.shifts.grace_minutes} minutes
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informative Help Box */}
        <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-slate-400">
          <MapPin className="h-5 w-5 text-slate-500 flex-shrink-0" />
          <p>
            Your shift attendance logs contain GPS coordinate marks and selfie image logs. If there are disputes regarding your attendance, please contact your shift supervisor.
          </p>
        </div>

      </div>
    </div>
  )
}
