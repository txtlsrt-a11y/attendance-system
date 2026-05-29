import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase'
import imageCompression from 'browser-image-compression'
import { CameraCapture } from '../../components/CameraCapture'
import { LocationPicker } from '../../components/LocationPicker'
import { InstallPWA } from '../../components/InstallPWA'
import { calculateAttendanceStatus, detectEarlyExit, getLocalDateString, formatTime12h } from '../../utils/dateHelpers'
import { 
  Camera, 
  MapPin, 
  Clock, 
  LogOut, 
  User, 
  History, 
  CheckCircle, 
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react'
import confetti from 'canvas-confetti'

export default function WorkerDashboard() {
  const { profile, signOut } = useAuth()
  const [lastPunch, setLastPunch] = useState(null)
  const [todayPunches, setTodayPunches] = useState([])
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState({ today: 0, weekly: 0, monthly: 0 })
  const [loading, setLoading] = useState(true)
  const [punchingType, setPunchingType] = useState(null) // 'IN' or 'OUT'
  const [showCamera, setShowCamera] = useState(false)
  const [gpsCoordinates, setGpsCoordinates] = useState({ latitude: null, longitude: null })
  
  // Rule checks
  const [isLocked, setIsLocked] = useState(false)
  const [lockTimeLeft, setLockTimeLeft] = useState(0) // seconds remaining in 5min cool down
  const [successMessage, setSuccessMessage] = useState('')

  // Fetch recent punches
  const fetchPunchHistory = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const todayStr = getLocalDateString()

      // Fetch today's punches to enforce rules
      const { data: todayData, error: todayErr } = await supabase
        .from('attendance')
        .select('*, shifts(*)')
        .eq('worker_id', profile.id)
        .eq('attendance_date', todayStr)
        .order('punch_time', { ascending: false })

      if (todayErr) throw todayErr
      setTodayPunches(todayData || [])
      
      const last = todayData && todayData.length > 0 ? todayData[0] : null
      setLastPunch(last)

      // Fetch past 31 days of logs for OT calculations
      const thirtyOneDaysAgo = new Date()
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31)
      const thirtyOneDaysAgoStr = getLocalDateString(thirtyOneDaysAgo)

      const { data: allData, error: allErr } = await supabase
        .from('attendance')
        .select('*, shifts(*)')
        .eq('worker_id', profile.id)
        .gte('attendance_date', thirtyOneDaysAgoStr)
        .order('punch_time', { ascending: false })

      if (allErr) throw allErr
      
      const logs = allData || []
      setHistory(logs.slice(0, 10))

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      const startOfMonthStr = getLocalDateString(startOfMonth)

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo)

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
      console.error('Error fetching attendance logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPunchHistory()
  }, [profile])

  // Handle countdown lock timer (5 minute rule)
  useEffect(() => {
    if (!lastPunch) {
      setIsLocked(false)
      return
    }

    const checkLock = () => {
      const punchTime = new Date(lastPunch.punch_time).getTime()
      const now = Date.now()
      const diffMs = now - punchTime
      const diffMins = diffMs / 60000

      if (diffMins < 5) {
        setIsLocked(true)
        setLockTimeLeft(Math.ceil((5 * 60 * 1000 - diffMs) / 1000))
      } else {
        setIsLocked(false)
        setLockTimeLeft(0)
      }
    }

    checkLock()
    const interval = setInterval(checkLock, 1000)
    return () => clearInterval(interval)
  }, [lastPunch])

  const handlePunchClick = (type) => {
    // Basic verification before camera opens
    if (isLocked) {
      alert(`System locked. Please wait ${lockTimeLeft}s before punching again.`)
      return
    }
    
    // Prevent double IN
    if (type === 'IN' && lastPunch && lastPunch.punch_type === 'IN') {
      alert('You are already punched IN! Please punch OUT next.')
      return
    }

    // Prevent OUT before IN
    if (type === 'OUT' && (!lastPunch || lastPunch.punch_type === 'OUT')) {
      alert('You cannot punch OUT without punching IN first today.')
      return
    }

    setPunchingType(type)
    setShowCamera(true)
  }

  // Handle camera capture and upload
  const handleCaptureComplete = async (file) => {
    setShowCamera(false)
    setLoading(true)
    setSuccessMessage('')

    try {
      if (!profile) throw new Error('Worker profile not found')
      if (!profile.shift_id) throw new Error('No shift assigned by administrator')

      // 1. Compress selfie image to prevent mobile freezing and bandwidth issues
      const options = {
        maxSizeMB: 0.3, // Compress to max 300KB
        maxWidthOrHeight: 800,
        useWebWorker: true,
        fileType: 'image/webp'
      }
      
      let compressedFile = file
      try {
        compressedFile = await imageCompression(file, options)
      } catch (error) {
        console.warn('Image compression failed, falling back to original.', error)
      }

      // 2. Upload compressed selfie to Supabase Storage
      const fileName = `${profile.id}/${punchingType.toLowerCase()}_${Date.now()}.webp`
      
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('attendance-selfies')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadErr) throw uploadErr

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('attendance-selfies')
        .getPublicUrl(fileName)

      // 2. Fetch shift details to compute status
      const { data: shift, error: shiftErr } = await supabase
        .from('shifts')
        .select('*')
        .eq('id', profile.shift_id)
        .single()

      if (shiftErr) throw shiftErr

      // 3. Compute attendance status (IN: check grace; OUT: check early exit)
      const now = new Date()
      let status = 'Present'
      let overtimeMinutes = 0
      let overtimeHours = 0
      let overtimeStatus = 'None'

      if (punchingType === 'IN') {
        status = calculateAttendanceStatus(now, shift.start_time, shift.grace_minutes)
      } else {
        // For OUT punches, we default to copying the status of the matching IN punch today
        // or check if early exit occurred.
        const hasEarlyExit = detectEarlyExit(now, shift.end_time)
        const matchingIn = todayPunches.find(p => p.punch_type === 'IN')
        status = matchingIn ? matchingIn.status : 'Present'
        if (hasEarlyExit && status === 'Present') {
          status = 'Late' // modify status or report early exit
        }

        // Automatic Overtime Calculation:
        const punchMinutes = now.getHours() * 60 + now.getMinutes()
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

      // 4. Save record
      const { error: insertErr } = await supabase
        .from('attendance')
        .insert({
          worker_id: profile.id,
          shift_id: shift.id,
          punch_type: punchingType,
          selfie_url: publicUrl,
          latitude: gpsCoordinates.latitude,
          longitude: gpsCoordinates.longitude,
          punch_time: now.toISOString(),
          attendance_date: getLocalDateString(now),
          status: status,
          overtime_minutes: overtimeMinutes,
          overtime_hours: overtimeHours,
          overtime_status: overtimeStatus
        })

      if (insertErr) throw insertErr

      // Success feedback
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      })

      setSuccessMessage(`Successfully registered Punch-${punchingType}!`)
      setTimeout(() => setSuccessMessage(''), 5000)

      // Refresh data
      await fetchPunchHistory()

    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to submit attendance log.')
    } finally {
      setLoading(false)
      setPunchingType(null)
    }
  }

  // Determine which button is disabled based on last punch
  const isInDisabled = loading || isLocked || (lastPunch && lastPunch.punch_type === 'IN')
  const isOutDisabled = loading || isLocked || !lastPunch || lastPunch.punch_type === 'OUT'

  return (
    <div className="min-h-screen bg-slate-950 bg-weave-pattern pb-12">
      
      {/* Top Banner Profile Summary */}
      <div className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-md px-6 py-5 sticky top-[73px] z-20">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-teal-400 text-xs font-extrabold uppercase tracking-widest block">
              Worker Attendance Panel
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Welcome, {profile?.full_name}
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              ID: <span className="font-mono text-slate-350">{profile?.worker_id}</span> | Department: <span className="text-slate-300 font-semibold">{profile?.department}</span>
            </p>
          </div>

          {profile?.shifts && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <Clock className="h-5 w-5 text-indigo-400" />
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Assigned Shift
                </span>
                <span className="text-xs font-extrabold text-indigo-300">
                  {profile.shifts.shift_name} ({formatTime12h(profile.shifts.start_time)} - {formatTime12h(profile.shifts.end_time)})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6">
        
        {/* Success Alert Banner */}
        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl p-4 mb-6 flex items-center gap-3 text-sm animate-pulse">
            <CheckCircle className="h-6 w-6 text-emerald-500" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        {/* 5-minute Cool Down lockout banner */}
        {isLocked && (
          <div className="bg-amber-500/10 border border-amber-500/25 text-amber-400 rounded-2xl p-4 mb-6 flex items-start gap-3 text-xs leading-relaxed">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Duplicate Punch Safeguard Active</p>
              <p className="mt-0.5">
                To prevent duplicates, the punch system is locked for 5 minutes between logs.
                Please wait <span className="font-bold text-white font-mono">{lockTimeLeft}s</span> before punching again.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Punch Panel (Takes 2 cols) */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Camera Overlay Modal if open */}
            {showCamera && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 text-center">
                  Verify Selfie Face Log
                </h3>
                <CameraCapture
                  onCapture={handleCaptureComplete}
                  onCancel={() => {
                    setShowCamera(false)
                    setPunchingType(null)
                  }}
                />
              </div>
            )}

            {/* Default Punch Buttons interface */}
            {!showCamera && (
              <div className="bg-slate-900/80 border border-slate-850 rounded-3xl p-6 md:p-8 shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                  <ShieldCheck className="h-5 w-5 text-teal-400" />
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">
                    Mark Shift Attendance
                  </h2>
                </div>

                {/* GPS Location Picker */}
                <div className="mb-8">
                  <LocationPicker onChange={(coords) => setGpsCoordinates(coords)} />
                </div>

                {/* Punch Action Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Punch IN Button */}
                  <button
                    type="button"
                    onClick={() => handlePunchClick('IN')}
                    disabled={isInDisabled}
                    className={`h-40 rounded-2xl border flex flex-col items-center justify-center p-6 transition-all ${
                      isInDisabled
                        ? 'bg-slate-950/40 border-slate-850 text-slate-600 cursor-not-allowed'
                        : 'bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20 active:scale-[0.98]'
                    }`}
                  >
                    <ArrowDownLeft className="h-10 w-10 mb-3" />
                    <span className="text-lg font-black uppercase tracking-widest">
                      Punch IN
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 uppercase font-bold">
                      Start Shift Log
                    </span>
                  </button>

                  {/* Punch OUT Button */}
                  <button
                    type="button"
                    onClick={() => handlePunchClick('OUT')}
                    disabled={isOutDisabled}
                    className={`h-40 rounded-2xl border flex flex-col items-center justify-center p-6 transition-all ${
                      isOutDisabled
                        ? 'bg-slate-950/40 border-slate-850 text-slate-600 cursor-not-allowed'
                        : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-450 hover:bg-indigo-500/20 active:scale-[0.98]'
                    }`}
                  >
                    <ArrowUpRight className="h-10 w-10 mb-3" />
                    <span className="text-lg font-black uppercase tracking-widest">
                      Punch OUT
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 uppercase font-bold">
                      End Shift Log
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick stats info card */}
            <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Today's Status
                </p>
                <p className="text-xs font-semibold text-slate-300 mt-1">
                  {lastPunch 
                    ? `Last logged: Punch ${lastPunch.punch_type} at ${new Date(lastPunch.punch_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                    : 'No attendance marked yet today.'
                  }
                </p>
              </div>
              
              {lastPunch && (
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                  lastPunch.status === 'Present' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                  lastPunch.status === 'Late' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                  'bg-purple-500/10 text-purple-405 border border-purple-500/20'
                }`}>
                  {lastPunch.status}
                </span>
              )}
            </div>

            {/* My Overtime Summary Row */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-slate-900 border border-slate-850 p-3.5 rounded-2xl flex flex-col items-center text-center shadow-lg relative overflow-hidden">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Today OT</span>
                <span className={`text-sm font-black block mt-1 ${stats.today > 0 ? 'text-teal-400' : 'text-slate-400'}`}>
                  {stats.today.toFixed(2)}h
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-850 p-3.5 rounded-2xl flex flex-col items-center text-center shadow-lg relative overflow-hidden">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Weekly OT</span>
                <span className={`text-sm font-black block mt-1 ${stats.weekly > 0 ? 'text-indigo-400' : 'text-slate-400'}`}>
                  {stats.weekly.toFixed(2)}h
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-850 p-3.5 rounded-2xl flex flex-col items-center text-center shadow-lg relative overflow-hidden">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Monthly OT</span>
                <span className={`text-sm font-black block mt-1 ${stats.monthly > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {stats.monthly.toFixed(2)}h
                </span>
              </div>
            </div>

          </div>

          {/* Right Panel: Recent Punches (Takes 1 col) */}
          <div className="bg-slate-900/80 border border-slate-850 rounded-3xl p-6 shadow-xl h-fit">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-850 pb-4">
              <History className="h-5 w-5 text-indigo-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                Recent Punches
              </h2>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <svg className="animate-spin h-6 w-6 text-teal-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No recent punches logged.
              </p>
            ) : (
              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                {history.map((log) => (
                  <div 
                    key={log.id} 
                    className="bg-slate-950/80 border border-slate-850 rounded-xl p-3 flex gap-3 items-center"
                  >
                    {/* Selfie thumbnail */}
                    <img
                      src={log.selfie_url}
                      alt="Selfie"
                      className="h-10 w-10 rounded-lg object-cover border border-slate-800 flex-shrink-0"
                    />

                    {/* Punch details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          log.punch_type === 'IN' 
                            ? 'bg-teal-500/10 text-teal-400 border border-teal-500/10' 
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10'
                        }`}>
                          {log.punch_type}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">
                          {log.attendance_date}
                        </span>
                        {parseFloat(log.overtime_hours || 0) > 0 && (
                          <span className="text-[9px] font-black bg-teal-500/10 text-teal-400 border border-teal-500/25 px-1.5 py-0.5 rounded ml-2">
                            +{parseFloat(log.overtime_hours).toFixed(2)} hrs OT
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-white mt-1">
                        {new Date(log.punch_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {/* Geolocation indicator */}
                    {log.latitude ? (
                      <span className="text-slate-500" title="GPS coordinates captured">
                        <MapPin className="h-4 w-4 text-emerald-500" />
                      </span>
                    ) : (
                      <span className="text-slate-700" title="GPS unavailable">
                        <MapPin className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* PWA banner for native home install */}
      <InstallPWA />
      
    </div>
  )
}
