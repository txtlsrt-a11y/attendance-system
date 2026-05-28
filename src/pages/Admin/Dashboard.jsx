import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { getLocalDateString, formatTime12h, isCurrentTimeInShift } from '../../utils/dateHelpers'
import { 
  Users, 
  UserCheck, 
  UserX, 
  Sun, 
  Moon, 
  Clock, 
  MapPin, 
  Search, 
  Activity,
  LogOut,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Percent,
  Timer
} from 'lucide-react'

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [workers, setWorkers] = useState([])
  const [attendance, setAttendance] = useState([])
  const [shifts, setShifts] = useState([])
  
  // Interactive filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedShift, setSelectedShift] = useState('all')
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all') // 'all', 'active', 'inactive', 'absent'

  // Fetch all state metrics
  const fetchDashboardData = async () => {
    try {
      const todayStr = getLocalDateString()

      // 1. Fetch shifts
      const { data: shiftsData } = await supabase.from('shifts').select('*')
      const activeShifts = shiftsData || []
      setShifts(activeShifts)

      // 2. Fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*, shifts(*)')
        .eq('role', 'worker')
      
      const allWorkers = profilesData || []
      setWorkers(allWorkers)

      // 3. Fetch today's attendance logs
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*, profiles(*), shifts(*)')
        .eq('attendance_date', todayStr)
        .order('punch_time', { ascending: false })

      setAttendance(attendanceData || [])

    } catch (err) {
      console.error('Error querying real-time dashboard analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  // Setup real-time listeners for instant re-fetching on insert/update/delete
  useEffect(() => {
    fetchDashboardData()

    const channel = supabase
      .channel('factory-realtime-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        fetchDashboardData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchDashboardData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
        fetchDashboardData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Process today's live worker metrics
  const getProcessedWorkers = () => {
    return workers.map(worker => {
      // Find today's punches for this worker
      const logs = attendance.filter(log => log.worker_id === worker.id)
      
      // Determine presence & activity statuses
      let isPresent = false
      let isLate = false
      let lastPunchLog = null
      let activityStatus = 'Inactive' // 'Active' (inside), 'Inactive' (checked-out), 'Absent'
      
      if (logs.length > 0) {
        isPresent = true
        // Sort logs in chronological ascending order to evaluate flows
        const chronLogs = [...logs].sort((a,b) => new Date(a.punch_time) - new Date(b.punch_time))
        lastPunchLog = chronLogs[chronLogs.length - 1]
        
        // Check if any check-in today was Late
        isLate = chronLogs.some(log => log.punch_type === 'IN' && log.status === 'Late')

        // Last log type and active shift boundary determines active status inside factory
        if (lastPunchLog.punch_type === 'IN') {
          // Check if current time is inside their assigned shift hours
          const inShift = worker.shifts 
            ? isCurrentTimeInShift(worker.shifts.start_time, worker.shifts.end_time) 
            : true
          
          if (inShift) {
            activityStatus = 'Active' // Punched IN and shift is active
          } else {
            activityStatus = 'Inactive' // Punched IN, but shift ended!
          }
        } else {
          activityStatus = 'Inactive' // Punched OUT, left factory
        }
      } else {
        activityStatus = 'Absent'
      }

      return {
        ...worker,
        isPresent,
        isLate,
        lastPunch: lastPunchLog,
        activityStatus
      }
    })
  }

  const processedWorkers = getProcessedWorkers()

  // Dynamic filter lists
  const filteredWorkers = processedWorkers.filter(w => {
    const matchesSearch = 
      w.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.worker_id.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesShift = selectedShift === 'all' || w.shift_id === selectedShift
    const matchesDept = selectedDept === 'all' || w.department === selectedDept
    
    let matchesStatus = true
    if (selectedStatus === 'active') matchesStatus = w.activityStatus === 'Active'
    if (selectedStatus === 'inactive') matchesStatus = w.activityStatus === 'Inactive'
    if (selectedStatus === 'absent') matchesStatus = w.activityStatus === 'Absent'

    return matchesSearch && matchesShift && matchesDept && matchesStatus
  })

  // Global counts calculations
  const totalCount = processedWorkers.length
  const presentCount = processedWorkers.filter(w => w.isPresent).length
  const absentCount = totalCount - presentCount
  const activeCount = processedWorkers.filter(w => w.activityStatus === 'Active').length // Inside factory + in-shift
  const inactiveCount = totalCount - activeCount // Exited, ended shift, or absent
  const checkedOutCount = processedWorkers.filter(w => w.isPresent && w.activityStatus === 'Inactive').length // Checked out today
  const lateCount = processedWorkers.filter(w => w.isLate).length

  // Shift-wise Calculations helper
  const getShiftMetrics = (shift) => {
    const assigned = processedWorkers.filter(w => w.shift_id === shift.id)
    const assignedCount = assigned.length
    const punchedIn = assigned.filter(w => w.isPresent).length
    const inside = assigned.filter(w => w.activityStatus === 'Active').length
    const exited = assigned.filter(w => w.isPresent && w.activityStatus === 'Inactive').length
    const late = assigned.filter(w => w.isLate).length
    const percent = assignedCount > 0 ? Math.round((punchedIn / assignedCount) * 100) : 0
    
    return {
      total: assignedCount,
      punchedIn,
      inside,
      exited,
      late,
      percent
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      
      {/* Real-time Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-teal-400 animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              Live Monitoring Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Realtime factory tracking powered by Supabase PostgreSQL WebSockets
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2 font-mono text-[10px] sm:text-xs text-slate-400 self-stretch sm:self-auto justify-center">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-emerald-400 font-bold uppercase">Live Connection Active</span>
        </div>
      </div>

      {/* Primary Live Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Total Workers */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between shadow-md relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Roster</span>
          <span className="text-2xl font-black text-white mt-1 block">{loading ? '...' : totalCount}</span>
          <span className="text-[9px] text-slate-500 font-medium block mt-1">Registered workers</span>
        </div>

        {/* Present Today */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between shadow-md relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Punched Today</span>
          <span className="text-2xl font-black text-emerald-450 mt-1 block">{loading ? '...' : presentCount}</span>
          <span className="text-[9px] text-emerald-500/80 font-bold block mt-1">Checked in today</span>
        </div>

        {/* Active Workers (Inside) */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between shadow-md border-l-2 border-l-teal-500 relative overflow-hidden">
          <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-teal-500 animate-ping"></div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Active Workers</span>
          <span className="text-2xl font-black text-teal-400 mt-1 block">{loading ? '...' : activeCount}</span>
          <span className="text-[9px] text-teal-450 font-bold block mt-1">Punched IN + in shift</span>
        </div>

        {/* Inactive Workers */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between shadow-md border-l-2 border-l-rose-500 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-semibold">Inactive Workers</span>
          <span className="text-2xl font-black text-rose-450 mt-1 block">{loading ? '...' : inactiveCount}</span>
          <span className="text-[9px] text-rose-500/70 font-medium block mt-1">Absent, out, or end shift</span>
        </div>

        {/* Absent */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between shadow-md relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Absent</span>
          <span className="text-2xl font-black text-rose-450 mt-1 block">{loading ? '...' : absentCount}</span>
          <span className="text-[9px] text-rose-550/80 font-bold block mt-1">Missing check-in</span>
        </div>

        {/* Late check ins */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between shadow-md relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Late Check-Ins</span>
          <span className="text-2xl font-black text-amber-450 mt-1 block">{loading ? '...' : lateCount}</span>
          <span className="text-[9px] text-amber-500/80 font-bold block mt-1">Grace limit exceeded</span>
        </div>

      </div>

      {/* Shift-wise Live Progress Cards */}
      <div>
        <h2 className="text-xs font-black text-white uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Timer className="h-4 w-4 text-teal-400" />
          Shift-Wise Realtime Monitoring
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shifts.map(shift => {
            const m = getShiftMetrics(shift)
            return (
              <div 
                key={shift.id}
                className="bg-slate-900 border border-slate-850 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row gap-5 items-center justify-between"
              >
                <div className="flex-1 w-full space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase">{shift.shift_name}</h3>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Hours: {formatTime12h(shift.start_time)} - {formatTime12h(shift.end_time)}
                      </p>
                    </div>
                    <span className="text-[10px] font-black font-mono text-teal-450 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 md:hidden">
                      {m.percent}% Present
                    </span>
                  </div>

                  {/* Progressive visual metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-2">
                    <div className="bg-slate-950/80 border border-slate-850/60 rounded-xl p-2">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Assigned</span>
                      <span className="text-xs font-black text-white block mt-0.5">{m.total}</span>
                    </div>
                    <div className="bg-slate-950/80 border border-slate-850/60 rounded-xl p-2 border-l-2 border-l-teal-500">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Active (Inside)</span>
                      <span className="text-xs font-black text-teal-400 block mt-0.5">{m.inside}</span>
                    </div>
                    <div className="bg-slate-950/80 border border-slate-850/60 rounded-xl p-2">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Late</span>
                      <span className="text-xs font-black text-amber-500 block mt-0.5">{m.late}</span>
                    </div>
                  </div>
                </div>

                {/* Circular Percentage chart for tablet/desktop */}
                <div className="flex-shrink-0 flex items-center justify-center bg-slate-950 rounded-2xl p-4 border border-slate-850 w-full sm:w-auto">
                  <div className="flex sm:flex-col items-center gap-3">
                    <div className="relative h-16 w-16 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="32" cy="32" r="28" className="stroke-slate-800 fill-none" strokeWidth="4"></circle>
                        <circle 
                          cx="32" 
                          cy="32" 
                          r="28" 
                          className="stroke-teal-500 fill-none transition-all duration-500" 
                          strokeWidth="4" 
                          strokeDasharray={176} 
                          strokeDashoffset={176 - (176 * m.percent) / 100}
                        ></circle>
                      </svg>
                      <span className="absolute text-xs font-black text-white font-mono">{m.percent}%</span>
                    </div>
                    <div className="text-left sm:text-center">
                      <span className="text-[8px] font-bold text-slate-550 uppercase tracking-widest block">Shift Presence</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{m.punchedIn}/{m.total} Punched</span>
                    </div>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      </div>

      {/* Filter and live monitoring worker panel */}
      <div className="bg-slate-900/80 border border-slate-850 rounded-3xl p-4 sm:p-6 shadow-xl">
        
        {/* Audited header controls */}
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center border-b border-slate-850 pb-5 mb-5 no-print">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              Live Auditing Console
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full xl:w-auto">
            {/* Search query input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search ID or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-teal-500 transition"
              />
            </div>

            {/* Shift filters */}
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white py-2 px-3 rounded-xl text-xs outline-none focus:border-teal-500 transition cursor-pointer"
            >
              <option value="all">All Shifts</option>
              {shifts.map(s => (
                <option key={s.id} value={s.id}>{s.shift_name}</option>
              ))}
            </select>

            {/* Department filters */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white py-2 px-3 rounded-xl text-xs outline-none focus:border-teal-500 transition cursor-pointer"
            >
              <option value="all">All Departments</option>
              <option value="Production">Production</option>
              <option value="Spinning">Spinning</option>
              <option value="Weaving">Weaving</option>
              <option value="Dyeing">Dyeing</option>
              <option value="Inspection">Inspection</option>
              <option value="Maintenance">Maintenance</option>
            </select>

            {/* Presence filters */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white py-2 px-3 rounded-xl text-xs outline-none focus:border-teal-500 transition cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active (Inside Spool)</option>
              <option value="inactive">Checked-Out (exited)</option>
              <option value="absent">Absent today</option>
            </select>
          </div>
        </div>

        {/* Live worker active status card feed */}
        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-teal-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No active workers found matching the filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredWorkers.map(w => (
              <div 
                key={w.id} 
                className="bg-slate-955 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-800 transition shadow"
              >
                <div className="flex gap-3 items-center">
                  {/* Selfie Preview */}
                  <div className="relative group flex-shrink-0">
                    {w.lastPunch?.selfie_url ? (
                      <img
                        src={w.lastPunch.selfie_url}
                        alt="Last Selfie"
                        className="h-12 w-12 rounded-xl object-cover border border-slate-800 shadow"
                      />
                    ) : w.photo_url ? (
                      <img
                        src={w.photo_url}
                        alt="Profile Photo"
                        className="h-12 w-12 rounded-xl object-cover border border-slate-800 shadow"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-850 text-slate-500 text-xs font-bold font-mono">
                        {w.full_name.slice(0,2).toUpperCase()}
                      </div>
                    )}
                    
                    {/* Hover preview zoom */}
                    {w.lastPunch?.selfie_url && (
                      <div className="absolute left-14 top-0 hidden group-hover:block z-50 bg-slate-950 border border-slate-700 p-1 rounded-lg shadow-2xl">
                        <img src={w.lastPunch.selfie_url} alt="Zoom" className="h-32 w-32 object-cover rounded" />
                      </div>
                    )}
                  </div>

                  {/* Profile info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className="text-xs font-black text-white truncate block">{w.full_name}</span>
                      <span className="text-[8px] font-mono font-bold bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 flex-shrink-0">
                        {w.worker_id}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mt-0.5 truncate">
                      {w.department} • {w.shifts?.shift_name || 'No Shift'}
                    </span>
                  </div>
                </div>

                {/* Real-time Status and Activity indicator */}
                <div className="flex items-center justify-between border-t border-slate-850/60 pt-3 mt-4">
                  
                  {/* Presence indicator */}
                  <div>
                    {w.activityStatus === 'Active' ? (
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
                        <span className="text-[10px] text-emerald-450 font-bold uppercase tracking-wider">Inside Factory</span>
                      </span>
                    ) : w.activityStatus === 'Inactive' ? (
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0"></span>
                        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Checked Out</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-slate-750 flex-shrink-0"></span>
                        <span className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">Absent today</span>
                      </span>
                    )}
                  </div>

                  {/* Punch details */}
                  <div className="text-right leading-none">
                    {w.lastPunch ? (
                      <>
                        <span className="text-[10px] font-bold text-white">
                          Punched {w.lastPunch.punch_type}
                        </span>
                        <span className="text-[9px] text-slate-500 block mt-1">
                          {new Date(w.lastPunch.punch_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </>
                    ) : (
                      <span className="text-[9px] text-slate-600 block">No logs today</span>
                    )}
                  </div>

                </div>

              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  )
}
