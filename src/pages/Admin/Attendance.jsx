import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { formatTime12h, getLocalDateString } from '../../utils/dateHelpers'
import { 
  History, 
  Search, 
  Calendar, 
  Clock, 
  MapPin, 
  Check, 
  X, 
  Edit3, 
  Trash2, 
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react'

export default function AttendanceLogs() {
  const [logs, setLogs] = useState([])
  const [shifts, setShifts] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters state
  const [filterDate, setFilterDate] = useState(getLocalDateString())
  const [filterWorker, setFilterWorker] = useState('')
  const [filterShift, setFilterShift] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Correction Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [currentLog, setCurrentLog] = useState(null)
  
  // Correction Form Fields
  const [corrWorkerId, setCorrWorkerId] = useState('')
  const [corrShiftId, setCorrShiftId] = useState('')
  const [corrPunchType, setCorrPunchType] = useState('IN')
  const [corrTime, setCorrTime] = useState('09:00')
  const [corrDate, setCorrDate] = useState(getLocalDateString())
  const [corrStatus, setCorrStatus] = useState('Present')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      // 1. Load active shifts
      const { data: shiftsData } = await supabase.from('shifts').select('*')
      setShifts(shiftsData || [])

      // 2. Load workers profiles for manual insert dropdown
      const { data: workersData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'worker')
        .order('full_name', { ascending: true })
      setWorkers(workersData || [])
      if (workersData && workersData.length > 0) {
        setCorrWorkerId(workersData[0].id)
      }
      if (shiftsData && shiftsData.length > 0) {
        setCorrShiftId(shiftsData[0].id)
      }

      // 3. Load attendance logs
      await fetchLogs()

    } catch (err) {
      console.error('Error loading logs data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async () => {
    try {
      let query = supabase
        .from('attendance')
        .select('*, profiles(*), shifts(*)')
        .order('punch_time', { ascending: false })

      // Apply date filter
      if (filterDate) {
        query = query.eq('attendance_date', filterDate)
      }

      // Apply shift filter
      if (filterShift !== 'all') {
        query = query.eq('shift_id', filterShift)
      }

      // Apply status filter
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query

      if (error) throw error

      // Filter by worker name/ID in application layer for flex search
      let filtered = data || []
      if (filterWorker.trim()) {
        const queryLower = filterWorker.toLowerCase()
        filtered = filtered.filter(log => 
          log.profiles?.full_name.toLowerCase().includes(queryLower) ||
          log.profiles?.worker_id.toLowerCase().includes(queryLower) ||
          (log.profiles?.mobile || '').includes(queryLower) ||
          (log.profiles?.department || '').toLowerCase().includes(queryLower) ||
          (log.shifts?.shift_name || '').toLowerCase().includes(queryLower) ||
          (log.status || '').toLowerCase().includes(queryLower)
        )
      }

      setLogs(filtered)

    } catch (err) {
      console.error('Error fetching logs:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Refetch logs on filter state adjustments
  useEffect(() => {
    fetchLogs()
  }, [filterDate, filterShift, filterStatus, filterWorker])

  // Quick Action: Approve / mark Present
  const handleApproveLog = async (id) => {
    try {
      const { error } = await supabase
        .from('attendance')
        .update({ status: 'Present' })
        .eq('id', id)

      if (error) throw error
      setLogs(prev => prev.map(log => log.id === id ? { ...log, status: 'Present' } : log))
    } catch (err) {
      alert(err.message || 'Error updating status')
    }
  }

  // Quick Action: Reject / mark Absent or Half Day
  const handleRejectLog = async (id) => {
    try {
      const { error } = await supabase
        .from('attendance')
        .update({ status: 'Absent' })
        .eq('id', id)

      if (error) throw error
      setLogs(prev => prev.map(log => log.id === id ? { ...log, status: 'Absent' } : log))
    } catch (err) {
      alert(err.message || 'Error updating status')
    }
  }

  // Delete log
  const handleDeleteLog = async (id) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return

    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', id)

      if (error) throw error
      setLogs(prev => prev.filter(log => log.id !== id))
    } catch (err) {
      alert(err.message || 'Error deleting log')
    }
  }

  // Open correction modal for editing or adding
  const openCorrectionModal = (log = null) => {
    setFormError('')
    if (log) {
      // Edit mode
      setCurrentLog(log)
      setCorrWorkerId(log.worker_id)
      setCorrShiftId(log.shift_id || '')
      setCorrPunchType(log.punch_type)
      setCorrDate(log.attendance_date)
      setCorrTime(new Date(log.punch_time).toTimeString().slice(0, 5))
      setCorrStatus(log.status)
    } else {
      // Create mode
      setCurrentLog(null)
      if (workers.length > 0) setCorrWorkerId(workers[0].id)
      if (shifts.length > 0) setCorrShiftId(shifts[0].id)
      setCorrPunchType('IN')
      setCorrDate(getLocalDateString())
      setCorrTime('09:00')
      setCorrStatus('Present')
    }
    setShowCorrectionModal(true)
  }

  // Submit manual correction or insertion
  const handleSubmitCorrection = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    try {
      // Construct date string with timezone offset
      const combinedDateTime = new Date(`${corrDate}T${corrTime}:00`).toISOString()

      // Automatic Overtime Calculation for Manual Entries
      let overtimeMinutes = 0
      let overtimeHours = 0
      let overtimeStatus = 'None'

      if (corrPunchType === 'OUT' && corrShiftId) {
        const shift = shifts.find(s => s.id === corrShiftId)
        if (shift) {
          const [punchH, punchM] = corrTime.split(':')
          const punchMinutes = parseInt(punchH, 10) * 60 + parseInt(punchM, 10)

          const [shiftEndH, shiftEndM] = shift.end_time.split(':')
          const shiftEndMinutes = parseInt(shiftEndH, 10) * 60 + parseInt(shiftEndM, 10)

          let diffMinutes = punchMinutes - shiftEndMinutes
          if (diffMinutes < -720) {
            diffMinutes += 1440
          } else if (diffMinutes > 720) {
            diffMinutes -= 1440
          }

          if (diffMinutes > (shift.grace_minutes || 15)) {
            overtimeMinutes = diffMinutes
            overtimeHours = parseFloat((diffMinutes / 60).toFixed(2))
            overtimeStatus = 'Approved'
          }
        }
      }

      const payload = {
        worker_id: corrWorkerId,
        shift_id: corrShiftId || null,
        punch_type: corrPunchType,
        status: corrStatus,
        punch_time: combinedDateTime,
        attendance_date: corrDate,
        selfie_url: currentLog?.selfie_url || 'https://via.placeholder.com/150?text=Manual+Correction',
        overtime_minutes: overtimeMinutes,
        overtime_hours: overtimeHours,
        overtime_status: overtimeStatus
      }

      if (currentLog) {
        // Update existing record
        const { error } = await supabase
          .from('attendance')
          .update(payload)
          .eq('id', currentLog.id)

        if (error) throw error
        alert('Attendance corrected successfully.')
      } else {
        // Insert new manual log
        const { error } = await supabase
          .from('attendance')
          .insert(payload)

        if (error) throw error
        alert('Manual attendance log created.')
      }

      setShowCorrectionModal(false)
      await fetchLogs()

    } catch (err) {
      console.error(err)
      setFormError(err.message || 'Failed to submit correction.')
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">
            Attendance Logs
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit logs, approve/reject entries, and perform manual corrections
          </p>
        </div>

        <button
          onClick={() => openCorrectionModal()}
          className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg transition"
        >
          <Edit3 className="h-4.5 w-4.5" />
          Add Manual Log
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-850 p-4 rounded-3xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Date Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Log Date:
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <Calendar className="h-4 w-4" />
            </span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-teal-500 transition"
            />
          </div>
        </div>

        {/* Worker Search */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Search Worker:
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Name or Worker ID..."
              value={filterWorker}
              onChange={(e) => setFilterWorker(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-teal-500 transition"
            />
          </div>
        </div>

        {/* Shift Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Filter Shift:
          </label>
          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 transition"
          >
            <option value="all">All Shifts</option>
            {shifts.map(s => (
              <option key={s.id} value={s.id}>{s.shift_name}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Filter Status:
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 transition"
          >
            <option value="all">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Half Day">Half Day</option>
            <option value="Absent">Absent</option>
          </select>
        </div>

      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-8 w-8 text-teal-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-850 rounded-2xl py-12 text-center text-slate-500">
          <History className="h-10 w-10 mx-auto mb-2 text-slate-700" />
          <p className="text-xs">No attendance entries found for this configuration.</p>
        </div>
      ) : (
        <>
          {/* MOBILE ONLY: Attendance Card Layout Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
            {logs.map((log) => (
              <div 
                key={log.id} 
                className="bg-slate-900 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between shadow"
              >
                <div className="flex gap-3 items-start">
                  {/* Selfie Preview with Hover zoom fallback */}
                  <div className="relative group flex-shrink-0">
                    <img
                      src={log.selfie_url}
                      alt="Selfie"
                      className="h-14 w-14 rounded-xl object-cover border border-slate-800 shadow"
                    />
                    <div className="absolute left-16 top-0 hidden group-hover:block z-50 bg-slate-950 border border-slate-700 p-1 rounded-lg shadow-2xl">
                      <img src={log.selfie_url} alt="Zoom" className="h-32 w-32 object-cover rounded" />
                    </div>
                  </div>

                  {/* Details block */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 justify-between">
                      <h4 className="text-xs font-black text-white truncate">{log.profiles?.full_name}</h4>
                      <span className="text-[8px] font-mono font-bold bg-slate-950 px-1.5 py-0.5 rounded text-slate-400">
                        {log.profiles?.worker_id}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">
                      {log.profiles?.department} • {log.shifts?.shift_name || 'No Shift'}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                        log.punch_type === 'IN' ? 'bg-teal-500/10 text-teal-400' : 'bg-indigo-500/10 text-indigo-400'
                      }`}>
                        {log.punch_type}
                      </span>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        log.status === 'Present' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                        log.status === 'Late' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                        'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}>
                        {log.status}
                      </span>
                      {log.punch_type === 'OUT' && parseFloat(log.overtime_hours || 0) > 0 && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-405 border border-teal-500/20">
                          +{parseFloat(log.overtime_hours).toFixed(2)}h OT
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-850/65 pt-3 mt-4 space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>Logged Time:</span>
                    <span className="font-extrabold text-white font-mono">
                      {new Date(log.punch_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} ({log.attendance_date})
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>GPS Coordinates:</span>
                    {log.latitude ? (
                      <a
                        href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-teal-400 hover:text-teal-350 hover:underline font-mono text-[9px]"
                      >
                        <MapPin className="h-3 w-3" />
                        {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                      </a>
                    ) : (
                      <span className="font-mono text-[9px] text-slate-600">Unavailable</span>
                    )}
                  </div>

                  {/* Actions button grid */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-850/40">
                    <button
                      onClick={() => handleApproveLog(log.id)}
                      disabled={log.status === 'Present'}
                      className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border transition ${
                        log.status === 'Present'
                          ? 'bg-slate-950/20 border-slate-900 text-slate-700 cursor-not-allowed'
                          : 'bg-emerald-950/15 border-emerald-900/30 text-emerald-400 hover:bg-emerald-900/25'
                      }`}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectLog(log.id)}
                      disabled={log.status === 'Absent'}
                      className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border transition ${
                        log.status === 'Absent'
                          ? 'bg-slate-950/20 border-slate-900 text-slate-700 cursor-not-allowed'
                          : 'bg-rose-900/15 border-rose-900/30 text-rose-450 hover:bg-rose-900/25'
                      }`}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => openCorrectionModal(log)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-850 transition"
                      title="Edit entry"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="p-1.5 bg-slate-950 hover:bg-rose-900/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-850 transition"
                      title="Delete entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP ONLY: Standard Attendance Grid Table */}
          <div className="hidden lg:block bg-slate-900 border border-slate-850 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-850 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-4 px-6">Selfie</th>
                    <th className="py-4 px-6">Worker Details</th>
                    <th className="py-4 px-6">Assigned Shift</th>
                    <th className="py-4 px-6">Punch Type</th>
                    <th className="py-4 px-6">Logged Time</th>
                    <th className="py-4 px-6">GPS Coordinates</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-300 text-xs">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-855/30 transition">
                      <td className="py-4 px-6">
                        <div className="relative group">
                          <img
                            src={log.selfie_url}
                            alt="Selfie"
                            className="h-10 w-10 rounded-lg object-cover border border-slate-800"
                          />
                          <div className="absolute left-12 top-0 hidden group-hover:block z-55 bg-slate-950 border border-slate-700 p-1 rounded shadow-2xl">
                            <img src={log.selfie_url} alt="Zoom" className="h-32 w-32 object-cover rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-extrabold text-white block">{log.profiles?.full_name}</span>
                        <span className="text-[10px] font-mono text-slate-500 block">ID: {log.profiles?.worker_id} | {log.profiles?.department}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-semibold">{log.shifts?.shift_name || 'No Shift'}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                          log.punch_type === 'IN' ? 'bg-teal-500/10 text-teal-400' : 'bg-indigo-500/10 text-indigo-400'
                        }`}>
                          {log.punch_type}
                        </span>
                        {log.punch_type === 'OUT' && parseFloat(log.overtime_hours || 0) > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1.5 text-[9px] font-extrabold text-teal-405 bg-teal-500/5 px-2 py-0.5 rounded border border-teal-500/10">
                            +{parseFloat(log.overtime_hours).toFixed(2)} hrs OT
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-white block">{new Date(log.punch_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        <span className="text-[9px] text-slate-500 block">{log.attendance_date}</span>
                      </td>
                      <td className="py-4 px-6">
                        {log.latitude ? (
                          <a
                            href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 text-teal-400 hover:text-teal-350 hover:underline font-mono text-[10px]"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                          </a>
                        ) : (
                          <span className="text-slate-600 font-mono text-[10px]">Unavailable</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          log.status === 'Present' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                          log.status === 'Late' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                          'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleApproveLog(log.id)}
                          disabled={log.status === 'Present'}
                          className={`p-1.5 rounded-lg border transition ${
                            log.status === 'Present'
                              ? 'bg-slate-950/20 border-slate-900 text-slate-700 cursor-not-allowed'
                              : 'bg-emerald-950/15 border-emerald-900/30 text-emerald-400 hover:bg-emerald-900/25'
                          }`}
                          title="Approve (Set Present)"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleRejectLog(log.id)}
                          disabled={log.status === 'Absent'}
                          className={`p-1.5 rounded-lg border transition ${
                            log.status === 'Absent'
                              ? 'bg-slate-950/20 border-slate-900 text-slate-700 cursor-not-allowed'
                              : 'bg-rose-900/15 border-rose-900/30 text-rose-450 hover:bg-rose-900/25'
                          }`}
                          title="Reject (Set Absent)"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => openCorrectionModal(log)}
                          className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-850 transition"
                          title="Edit entry"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="p-1.5 bg-slate-950 hover:bg-rose-900/20 text-slate-405 hover:text-rose-450 rounded-lg border border-slate-850 transition"
                          title="Delete entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal - Manual Correction Form */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            
            <div className="flex justify-between items-center border-b border-slate-850 pb-4 mb-4">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                {currentLog ? 'Manual Correction' : 'Add Manual Attendance Log'}
              </h2>
              <button onClick={() => setShowCorrectionModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl p-3.5 mb-4 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitCorrection} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Select Worker *
                </label>
                <select
                  disabled={!!currentLog}
                  value={corrWorkerId}
                  onChange={(e) => setCorrWorkerId(e.target.value)}
                  className={`w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2.5 px-3 text-xs outline-none focus:border-teal-500 transition ${
                    currentLog ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.full_name} ({w.worker_id})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Select Shift *
                  </label>
                  <select
                    value={corrShiftId}
                    onChange={(e) => setCorrShiftId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2.5 px-3 text-xs outline-none focus:border-teal-500 transition"
                  >
                    <option value="">No Shift</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>{s.shift_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Punch Type *
                  </label>
                  <select
                    value={corrPunchType}
                    onChange={(e) => setCorrPunchType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2.5 px-3 text-xs outline-none focus:border-teal-500 transition"
                  >
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={corrDate}
                    onChange={(e) => setCorrDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={corrTime}
                    onChange={(e) => setCorrTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Set Attendance Status *
                </label>
                <select
                  value={corrStatus}
                  onChange={(e) => setCorrStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2.5 px-3 text-xs outline-none focus:border-teal-500 transition"
                >
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black uppercase py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition mt-4"
              >
                {formLoading ? 'Submitting Log...' : 'Confirm Log Adjustment'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
