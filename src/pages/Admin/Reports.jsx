import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useAuth } from '../../context/AuthContext'
import { exportToCSV, triggerPrint } from '../../utils/exportHelpers'
import { getLocalDateString, formatTime12h } from '../../utils/dateHelpers'
import { 
  FileSpreadsheet, 
  Printer, 
  Calendar, 
  Users, 
  Clock, 
  Search,
  Filter,
  BarChart3
} from 'lucide-react'

export default function ReportsDashboard() {
  const { globalSettings } = useAuth()
  const [reportType, setReportType] = useState('daily') // 'daily', 'monthly', 'worker', 'shift'
  const [shifts, setShifts] = useState([])
  const [workers, setWorkers] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)

  // Report parameters
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const [selectedShiftId, setSelectedShiftId] = useState('')
  const [startDate, setStartDate] = useState(getLocalDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))) // 7 days ago
  const [endDate, setEndDate] = useState(getLocalDateString())

  // Monthly Report Aggregations
  const [monthlyData, setMonthlyData] = useState([])

  // Load shifts and workers on mount
  useEffect(() => {
    const initParams = async () => {
      try {
        const { data: shiftsData } = await supabase.from('shifts').select('*')
        setShifts(shiftsData || [])
        if (shiftsData && shiftsData.length > 0) {
          setSelectedShiftId(shiftsData[0].id)
        }

        const { data: workersData } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'worker')
          .order('full_name', { ascending: true })
        setWorkers(workersData || [])
        if (workersData && workersData.length > 0) {
          setSelectedWorkerId(workersData[0].id)
        }
      } catch (err) {
        console.error('Error initiating report filters:', err)
      }
    }
    initParams()
  }, [])

  // Fetch report data based on current parameters
  const generateReport = async () => {
    setLoading(true)
    try {
      if (reportType === 'daily') {
        const { data, error } = await supabase
          .from('attendance')
          .select('*, profiles(*), shifts(*)')
          .eq('attendance_date', selectedDate)
          .order('punch_time', { ascending: true })

        if (error) throw error
        setLogs(data || [])
      } 
      
      else if (reportType === 'monthly') {
        // Fetch all attendance for the chosen month (e.g. '2026-05')
        const startOfMonth = `${selectedMonth}-01`
        // Calculate last day of month
        const [year, month] = selectedMonth.split('-')
        const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate()
        const endOfMonth = `${selectedMonth}-${lastDay}`

        const { data, error } = await supabase
          .from('attendance')
          .select('*, profiles(*), shifts(*)')
          .gte('attendance_date', startOfMonth)
          .lte('attendance_date', endOfMonth)

        if (error) throw error

        // Aggregate records per worker
        const workerAggregations = {}
        
        // Initialize for all active workers
        workers.forEach(w => {
          workerAggregations[w.id] = {
            profile: w,
            present: 0,
            late: 0,
            halfDay: 0,
            absent: 0,
            totalPunches: 0
          }
        })

        // Accumulate logs
        data.forEach(log => {
          const wId = log.worker_id
          if (!workerAggregations[wId]) {
            // Worker might not be in the active workers cache (e.g. deleted profile but attendance logs exist)
            workerAggregations[wId] = {
              profile: log.profiles || { full_name: 'Unknown Worker', worker_id: 'N/A', department: 'N/A' },
              present: 0,
              late: 0,
              halfDay: 0,
              absent: 0,
              totalPunches: 0
            }
          }

          workerAggregations[wId].totalPunches++
          if (log.punch_type === 'IN') {
            if (log.status === 'Present') workerAggregations[wId].present++
            if (log.status === 'Late') workerAggregations[wId].late++
            if (log.status === 'Half Day') workerAggregations[wId].halfDay++
            if (log.status === 'Absent') workerAggregations[wId].absent++
          }
        })

        setMonthlyData(Object.values(workerAggregations))
      } 
      
      else if (reportType === 'worker') {
        if (!selectedWorkerId) return
        const { data, error } = await supabase
          .from('attendance')
          .select('*, profiles(*), shifts(*)')
          .eq('worker_id', selectedWorkerId)
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate)
          .order('punch_time', { ascending: true })

        if (error) throw error
        setLogs(data || [])
      } 
      
      else if (reportType === 'shift') {
        if (!selectedShiftId) return
        const { data, error } = await supabase
          .from('attendance')
          .select('*, profiles(*), shifts(*)')
          .eq('shift_id', selectedShiftId)
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate)
          .order('attendance_date', { ascending: true })

        if (error) throw error
        setLogs(data || [])
      }

    } catch (err) {
      console.error('Error generating report:', err)
      alert('Error building report contents.')
    } finally {
      setLoading(false)
    }
  }

  // Trigger report build on filter updates
  useEffect(() => {
    generateReport()
  }, [reportType, selectedDate, selectedMonth, selectedWorkerId, selectedShiftId, startDate, endDate, workers])

  // Handle Export CSV
  const handleExportCSV = () => {
    if (reportType === 'monthly') {
      // Custom monthly CSV header mapping
      const headers = ['Worker ID', 'Full Name', 'Department', 'Days Present', 'Days Late', 'Days Half Day', 'Days Absent', 'Total Logs']
      const rows = [headers.join(',')]
      monthlyData.forEach(row => {
        const values = [
          `"${row.profile?.worker_id || ''}"`,
          `"${row.profile?.full_name || ''}"`,
          `"${row.profile?.department || ''}"`,
          row.present,
          row.late,
          row.halfDay,
          row.absent,
          row.totalPunches
        ]
        rows.push(values.join(','))
      })
      const csvContent = 'data:text/csv;charset=utf-8,' + rows.join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `monthly_report_${selectedMonth}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      const filename = `${reportType}_report_${getLocalDateString()}.csv`
      exportToCSV(logs, filename)
    }
  }

  const handlePrint = () => {
    const reportNames = {
      daily: `Daily_Report_${selectedDate}`,
      monthly: `Monthly_Report_${selectedMonth}`,
      worker: `Worker_Report_${selectedWorkerId}`,
      shift: `Shift_Report_${selectedShiftId}`
    }
    triggerPrint(reportNames[reportType] || 'Attendance_Report')
  }

  // Summary statistics calculation
  const getStats = () => {
    if (reportType === 'monthly') return null
    const present = logs.filter(l => l.punch_type === 'IN' && l.status === 'Present').length
    const late = logs.filter(l => l.punch_type === 'IN' && l.status === 'Late').length
    const halfDay = logs.filter(l => l.punch_type === 'IN' && l.status === 'Half Day').length
    const totalPunches = logs.length
    return { present, late, halfDay, totalPunches }
  }

  const stats = getStats()

  return (
    <div className="p-6 space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">
            Factory Attendance Reports
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Build custom attendance audits, export CSV sheets, and download print-ready records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={reportType !== 'monthly' && logs.length === 0}
            className="bg-slate-900 border border-slate-805 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-350 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-2 transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-teal-400" />
            Export CSV
          </button>
          
          <button
            onClick={handlePrint}
            disabled={reportType !== 'monthly' && logs.length === 0}
            className="bg-slate-900 border border-slate-805 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-350 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-2 transition"
          >
            <Printer className="h-4 w-4 text-indigo-400" />
            Print Report
          </button>
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div className="bg-slate-900/80 border border-slate-850 p-1.5 rounded-2xl flex max-w-xl no-print">
        {['daily', 'monthly', 'worker', 'shift'].map((type) => (
          <button
            key={type}
            onClick={() => setReportType(type)}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl uppercase tracking-wider transition ${
              reportType === type
                ? 'bg-slate-950 text-teal-400 border border-slate-800 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Filter Parameters Form */}
      <div className="bg-slate-900 border border-slate-850 p-4 rounded-3xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end no-print">
        
        {/* Daily Parameters */}
        {reportType === 'daily' && (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Select Attendance Date:
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Calendar className="h-4 w-4" />
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-teal-500 transition"
              />
            </div>
          </div>
        )}

        {/* Monthly Parameters */}
        {reportType === 'monthly' && (
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Select Calendar Month:
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Calendar className="h-4 w-4" />
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-teal-500 transition"
              />
            </div>
          </div>
        )}

        {/* Worker Parameters */}
        {reportType === 'worker' && (
          <>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Select Worker Profile:
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Users className="h-4 w-4" />
                </span>
                <select
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-teal-500 transition"
                >
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.full_name} ({w.worker_id})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Start Date:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                End Date:
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 transition"
              />
            </div>
          </>
        )}

        {/* Shift Parameters */}
        {reportType === 'shift' && (
          <>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Select Shift Target:
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Clock className="h-4 w-4" />
                </span>
                <select
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-teal-500 transition"
                >
                  {shifts.map(s => (
                    <option key={s.id} value={s.id}>{s.shift_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Start Date:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                End Date:
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 transition"
              />
            </div>
          </>
        )}

      </div>

      {/* Aggregate Stats Cards (Only for non-monthly) */}
      {reportType !== 'monthly' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Present Count (On Time)</span>
            <span className="text-xl font-black text-emerald-450 mt-1 block">{stats.present}</span>
          </div>
          <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Late Logs</span>
            <span className="text-xl font-black text-amber-450 mt-1 block">{stats.late}</span>
          </div>
          <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Half Day Logs</span>
            <span className="text-xl font-black text-purple-400 mt-1 block">{stats.halfDay}</span>
          </div>
          <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-bold">Total Logs Fetched</span>
            <span className="text-xl font-black text-white mt-1 block">{stats.totalPunches}</span>
          </div>
        </div>
      )}

      {/* Print-Only Title Header */}
      <div className="hidden print-only mb-6 border-b border-black pb-4">
        <h1 className="text-xl font-black text-black uppercase">
          {globalSettings?.company_name || 'Textile Shift Attendance'} Report
        </h1>
        <p className="text-xs text-black mt-1">
          Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
        </p>
        <p className="text-sm font-bold text-black mt-3">
          Type: {reportType.toUpperCase()} | Params:{' '}
          {reportType === 'daily' && `Date: ${selectedDate}`}
          {reportType === 'monthly' && `Month: ${selectedMonth}`}
          {reportType === 'worker' && `Worker ID: ${selectedWorkerId} (${startDate} to ${endDate})`}
          {reportType === 'shift' && `Shift ID: ${selectedShiftId} (${startDate} to ${endDate})`}
        </p>
      </div>

      {/* Report Data display container */}
      <div className="print-container">
        {loading ? (
          <div className="flex justify-center py-16 no-print">
            <svg className="animate-spin h-8 w-8 text-teal-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : reportType === 'monthly' ? (
          /* Monthly aggregates table */
          <div className="bg-slate-900 border border-slate-850 rounded-3xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-850 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-4 px-6">Worker ID</th>
                  <th className="py-4 px-6">Full Name</th>
                  <th className="py-4 px-6">Department</th>
                  <th className="py-4 px-6">Days Present</th>
                  <th className="py-4 px-6 text-amber-500">Days Late</th>
                  <th className="py-4 px-6 text-purple-400">Half Day</th>
                  <th className="py-4 px-6 text-rose-500">Days Absent</th>
                  <th className="py-4 px-6">Total Logs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 text-slate-350 text-xs">
                {monthlyData.map(row => (
                  <tr key={row.profile?.id} className="hover:bg-slate-855/20 transition">
                    <td className="py-4 px-6 font-mono font-bold text-slate-400">{row.profile?.worker_id}</td>
                    <td className="py-4 px-6 font-bold text-white">{row.profile?.full_name}</td>
                    <td className="py-4 px-6">{row.profile?.department}</td>
                    <td className="py-4 px-6 font-bold text-emerald-450">{row.present}</td>
                    <td className="py-4 px-6 font-bold text-amber-450">{row.late}</td>
                    <td className="py-4 px-6 font-bold text-purple-405">{row.halfDay}</td>
                    <td className="py-4 px-6 font-bold text-rose-455">{row.absent}</td>
                    <td className="py-4 px-6 font-mono text-slate-500">{row.totalPunches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-slate-900 border border-slate-850 rounded-2xl py-12 text-center text-slate-500">
            <BarChart3 className="h-10 w-10 mx-auto mb-2 text-slate-700" />
            <p className="text-xs">No records generated for these parameters.</p>
          </div>
        ) : (
          /* Logs listing table */
          <div className="bg-slate-900 border border-slate-850 rounded-3xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-850 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Worker ID</th>
                  <th className="py-4 px-6">Full Name</th>
                  <th className="py-4 px-6">Department</th>
                  <th className="py-4 px-6">Shift</th>
                  <th className="py-4 px-6">Punch Type</th>
                  <th className="py-4 px-6">Logged Time</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 text-slate-350 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-855/20 transition">
                    <td className="py-4 px-6 text-slate-400 font-bold">{log.attendance_date}</td>
                    <td className="py-4 px-6 font-mono text-slate-400">{log.profiles?.worker_id}</td>
                    <td className="py-4 px-6 font-bold text-white">{log.profiles?.full_name}</td>
                    <td className="py-4 px-6">{log.profiles?.department}</td>
                    <td className="py-4 px-6">{log.shifts?.shift_name || 'No Shift'}</td>
                    <td className="py-4 px-6">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                        log.punch_type === 'IN' ? 'bg-teal-500/10 text-teal-400' : 'bg-indigo-500/10 text-indigo-400'
                      }`}>
                        {log.punch_type}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-white">{formatTime12h(new Date(log.punch_time).toTimeString().slice(0, 8))}</td>
                    <td className="py-4 px-6">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        log.status === 'Present' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                        log.status === 'Late' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                        'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
