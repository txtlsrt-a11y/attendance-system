import React, { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { supabase, supabaseSecondary } from '../../supabase'
import { WORKER_EMAIL_SUFFIX } from '../../context/AuthContext'
import imageCompression from 'browser-image-compression'
import { getLocalDateString, formatTime12h, isCurrentTimeInShift } from '../../utils/dateHelpers'
import { 
  Users, UserPlus, Edit, Trash2, Search, X, ShieldAlert, Clock, 
  Briefcase, Phone, Eye, EyeOff, Check, ShieldCheck, Mail,
  FileText, Download, CheckCircle, AlertCircle, FileUp
} from 'lucide-react'

export default function ManageWorkers() {
  const [workers, setWorkers] = useState([])
  const [shifts, setShifts] = useState([])
  const [attendance, setAttendance] = useState([])
  const [recentAttendance, setRecentAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Interactive filters
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [selectedShiftFilter, setSelectedShiftFilter] = useState('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all')

  // Modal and form states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [currentWorker, setCurrentWorker] = useState(null)

  const [fullName, setFullName] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [mobile, setMobile] = useState('')
  const [department, setDepartment] = useState('Helper')
  const [shiftId, setShiftId] = useState('')
  const [password, setPassword] = useState('12345678')
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginEnabled, setLoginEnabled] = useState(true)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  
  // Aadhaar specific states
  const [aadhaarFile, setAadhaarFile] = useState(null)
  const [aadhaarUrl, setAadhaarUrl] = useState('')
  const [aadhaarVerified, setAadhaarVerified] = useState(false)
  
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [toast, setToast] = useState({ message: '', type: '' })

  const triggerToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: '' }), 4000)
  }

  // Load shifts, profiles, and attendance punches
  const loadData = async () => {
    try {
      const { data: shiftsData } = await supabase.from('shifts').select('*').eq('active', true)
      setShifts(shiftsData || [])
      if (shiftsData?.length > 0 && !shiftId) setShiftId(shiftsData[0].id)

      const { data: profilesData } = await supabase.from('profiles').select('*, shifts(*)').eq('role', 'worker').order('created_at', { ascending: false })
      setWorkers(profilesData || [])

      // Fetch last 31 days of attendance logs for multi-day OT aggregations
      const thirtyOneDaysAgo = new Date()
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31)
      const thirtyOneDaysAgoStr = getLocalDateString(thirtyOneDaysAgo)

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .gte('attendance_date', thirtyOneDaysAgoStr)
      setAttendance(attendanceData || [])

      const { data: recentData } = await supabase.from('attendance').select('*').order('punch_time', { ascending: false }).limit(1000)
      setRecentAttendance(recentData || [])
    } catch (err) {
      console.error(err)
      triggerToast('Failed to sync metrics from database.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const channel = supabase.channel('workers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Evaluate liveness and last punch logs today (memoized)
  const processedWorkers = useMemo(() => {
    const todayStr = getLocalDateString()
    
    // Calculate calendar boundaries
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    const startOfMonthStr = getLocalDateString(startOfMonth)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo)

    return workers.map(worker => {
      const workerLogs = attendance.filter(log => log.worker_id === worker.id)
      const todayPunches = workerLogs.filter(log => log.attendance_date === todayStr)
      
      let isPresent = false
      let activityStatus = 'Inactive'
      let lastPunchLog = null

      const workerPunches = recentAttendance.filter(log => log.worker_id === worker.id)
      if (workerPunches.length > 0) lastPunchLog = workerPunches[0]

      if (todayPunches.length > 0) {
        isPresent = true
        const sorted = [...todayPunches].sort((a, b) => new Date(a.punch_time) - new Date(b.punch_time))
        const latest = sorted[sorted.length - 1]

        if (latest.punch_type === 'IN') {
          const inShift = worker.shifts ? isCurrentTimeInShift(worker.shifts.start_time, worker.shifts.end_time) : true
          activityStatus = inShift ? 'Active' : 'Inactive'
        } else {
          activityStatus = 'Inactive'
        }
      } else {
        activityStatus = 'Absent'
      }

      // Sum overtime hours
      const otToday = workerLogs
        .filter(log => log.attendance_date === todayStr)
        .reduce((sum, log) => sum + parseFloat(log.overtime_hours || 0), 0)

      const otWeekly = workerLogs
        .filter(log => log.attendance_date >= sevenDaysAgoStr)
        .reduce((sum, log) => sum + parseFloat(log.overtime_hours || 0), 0)

      const otMonthly = workerLogs
        .filter(log => log.attendance_date >= startOfMonthStr)
        .reduce((sum, log) => sum + parseFloat(log.overtime_hours || 0), 0)

      return { 
        ...worker, 
        isPresent, 
        activityStatus, 
        lastPunch: lastPunchLog,
        otToday,
        otWeekly,
        otMonthly
      }
    })
  }, [workers, attendance, recentAttendance])

  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, text: '', color: 'bg-slate-800' }
    if (pwd.length < 8) return { score: 1, text: 'Too short (min 8 chars)', color: 'bg-rose-500' }
    const hasLetters = /[a-zA-Z]/.test(pwd)
    const hasNumbers = /[0-9]/.test(pwd)
    if (hasLetters && hasNumbers) return { score: 3, text: 'Strong Industrial Password', color: 'bg-emerald-500' }
    return { score: 2, text: 'Weak (Add numbers & letters)', color: 'bg-amber-500' }
  }

  const uploadProfilePhoto = async (id, file) => {
    try {
      let uploadFile = file
      if (file.type.startsWith('image/')) {
        try {
          uploadFile = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 800, useWebWorker: true, fileType: 'image/webp' })
        } catch (e) {
          console.warn('Compression failed', e)
        }
      }

      const fileExt = uploadFile.type === 'image/webp' ? 'webp' : file.name.split('.').pop()
      const filePath = `profiles/${id}_${Date.now()}.${fileExt}`
      const { error } = await supabase.storage.from('attendance-selfies').upload(filePath, uploadFile, { cacheControl: '3600', upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('attendance-selfies').getPublicUrl(filePath)
      return publicUrl
    } catch (err) {
      console.error(err)
      return ''
    }
  }

  const uploadAadhaarDocument = async (id, file) => {
    try {
      let uploadFile = file
      if (file.type.startsWith('image/')) {
        try {
          uploadFile = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true, fileType: 'image/webp' })
        } catch (e) {
          console.warn('Compression failed', e)
        }
      }

      const fileExt = uploadFile.type === 'image/webp' ? 'webp' : file.name.split('.').pop()
      const filePath = `identities/${id}_aadhaar_${Date.now()}.${fileExt}`
      const { error } = await supabase.storage.from('worker-documents').upload(filePath, uploadFile, { cacheControl: '3600', upsert: true })
      if (error) throw error
      return filePath
    } catch (err) {
      console.error(err)
      return ''
    }
  }

  const handleDownloadAadhaar = async (path) => {
    try {
      const { data, error } = await supabase.storage.from('worker-documents').createSignedUrl(path, 60)
      if (error) throw error
      window.open(data.signedUrl, '_blank')
    } catch (err) {
      triggerToast('Failed to generate secure link for Aadhaar', 'error')
    }
  }

  const handleAddWorker = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    try {
      const idUpper = workerId.trim().toUpperCase()
      const nameClean = fullName.trim()

      if (!idUpper) throw new Error('Worker ID is required')
      if (!nameClean) throw new Error('Full Name is required')
      if (password.length < 8) throw new Error('Password must be at least 8 characters')
      if (workers.some(w => w.worker_id === idUpper)) throw new Error('Worker ID is already registered.')

      let uploadedUrl = ''
      if (photoFile) uploadedUrl = await uploadProfilePhoto(idUpper, photoFile)

      let uploadedAadhaarPath = ''
      if (aadhaarFile) {
        if (aadhaarFile.size > 10 * 1024 * 1024) throw new Error('Aadhaar file must be under 10MB')
        uploadedAadhaarPath = await uploadAadhaarDocument(idUpper, aadhaarFile)
      }

      const formattedEmail = `${idUpper.toLowerCase()}${WORKER_EMAIL_SUFFIX}`
      const { data, error: signupErr } = await supabaseSecondary.auth.signUp({
        email: formattedEmail,
        password: password,
        options: {
          data: {
            role: 'worker',
            full_name: nameClean,
            worker_id: idUpper,
            mobile: mobile.trim(),
            department: department,
            shift_id: shiftId,
            photo_url: uploadedUrl,
            login_enabled: true,
            aadhaar_url: uploadedAadhaarPath,
            aadhaar_verified: false
          }
        }
      })
      if (signupErr) throw signupErr
      if (!data.user) throw new Error('Registration completed, but User object was not returned.')

      setShowAddModal(false)
      resetForm()
      await loadData()
      triggerToast(`Worker ${nameClean} enrolled successfully as ${idUpper}.`)
    } catch (err) {
      setFormError(err.message || 'Failed to enroll worker.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEditWorker = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    try {
      const idUpper = workerId.trim().toUpperCase()
      const nameClean = fullName.trim()

      if (!idUpper) throw new Error('Worker ID is required')
      if (!nameClean) throw new Error('Full Name is required')

      if (idUpper !== currentWorker.worker_id) {
        if (workers.some(w => w.worker_id === idUpper && w.id !== currentWorker.id)) throw new Error('Worker ID already registered.')
        const { error: rpcErr } = await supabase.rpc('admin_update_worker_email', { worker_uid: currentWorker.id, new_worker_id: idUpper })
        if (rpcErr) throw rpcErr
      }

      if (newPassword) {
        if (newPassword.length < 8) throw new Error('New Password must be at least 8 characters.')
        if (newPassword !== confirmPassword) throw new Error('Passwords do not match.')
        const { error: resetErr } = await supabase.rpc('admin_reset_password', { worker_uid: currentWorker.id, new_password: newPassword })
        if (resetErr) throw resetErr
      }

      let uploadedUrl = photoUrl
      if (photoFile) uploadedUrl = await uploadProfilePhoto(idUpper, photoFile) || photoUrl

      let uploadedAadhaarPath = aadhaarUrl
      if (aadhaarFile) {
        if (aadhaarFile.size > 10 * 1024 * 1024) throw new Error('Aadhaar file must be under 10MB')
        uploadedAadhaarPath = await uploadAadhaarDocument(idUpper, aadhaarFile) || aadhaarUrl
      }

      const { error: updateErr } = await supabase.from('profiles').update({
        full_name: nameClean,
        worker_id: idUpper,
        mobile: mobile.trim(),
        department: department,
        shift_id: shiftId || null,
        photo_url: uploadedUrl,
        login_enabled: loginEnabled,
        aadhaar_url: uploadedAadhaarPath,
        aadhaar_verified: aadhaarVerified
      }).eq('id', currentWorker.id)

      if (updateErr) throw updateErr
      setShowEditModal(false)
      resetForm()
      await loadData()
      triggerToast('Worker profile and credentials updated successfully.')
    } catch (err) {
      setFormError(err.message || 'Failed to update worker.')
    } finally {
      setFormLoading(false)
    }
  }

  const toggleLoginPermission = async (worker) => {
    try {
      const toggledState = !worker.login_enabled
      const { error } = await supabase.from('profiles').update({ login_enabled: toggledState }).eq('id', worker.id)
      if (error) throw error
      await loadData()
      triggerToast(`Worker login permission ${toggledState ? 'enabled' : 'disabled'}.`)
    } catch (err) {
      triggerToast('Failed to toggle login access.', 'error')
    }
  }

  const handleDeleteWorker = async (id, name) => {
    if (!window.confirm(`CRITICAL WARNING:\nAre you sure you want to permanently delete worker "${name}"?\nThis cascades and deletes their profile and all attendance logs.`)) return
    try {
      const { error: rpcError } = await supabase.rpc('admin_delete_worker', { worker_uid: id })
      
      if (rpcError) {
        console.warn('RPC delete failed, falling back to direct profile deletion:', rpcError.message)
        
        // Best effort: try to rename the email so the worker ID can be reused later
        try {
          await supabase.rpc('admin_update_worker_email', { 
            worker_uid: id, 
            new_worker_id: `deleted_${id.substring(0,8)}_${Date.now()}` 
          })
        } catch (e) {}
        
        // Fallback: Delete the profile directly. This will remove them from the app and cascade to attendance logs.
        const { error: profileError } = await supabase.from('profiles').delete().eq('id', id)
        if (profileError) throw profileError
      }
      
      await loadData()
      triggerToast(`Account and logs for ${name} deleted successfully.`)
    } catch (err) {
      console.error('Failed to delete worker:', err)
      triggerToast(err.message || 'Failed to delete worker account.', 'error')
    }
  }

  const openEditModal = (worker) => {
    setCurrentWorker(worker)
    setFullName(worker.full_name)
    setWorkerId(worker.worker_id)
    setMobile(worker.mobile || '')
    setDepartment(worker.department || 'Helper')
    setShiftId(worker.shift_id || '')
    setPhotoUrl(worker.photo_url || '')
    setPhotoFile(null)
    setAadhaarUrl(worker.aadhaar_url || '')
    setAadhaarFile(null)
    setAadhaarVerified(worker.aadhaar_verified || false)
    setLoginEnabled(worker.login_enabled ?? true)
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setFormError('')
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFullName('')
    setWorkerId('')
    setMobile('')
    setDepartment('Helper')
    setPhotoUrl('')
    setPhotoFile(null)
    setAadhaarUrl('')
    setAadhaarFile(null)
    setAadhaarVerified(false)
    setPassword('12345678')
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setLoginEnabled(true)
    if (shifts.length > 0) setShiftId(shifts[0].id)
    setFormError('')
  }

  const filteredWorkers = useMemo(() => {
    return processedWorkers.filter(w => {
      const query = deferredSearchQuery.toLowerCase()
      const matchesSearch = w.full_name.toLowerCase().includes(query) ||
                            w.worker_id.toLowerCase().includes(query) ||
                            (w.mobile || '').includes(query) ||
                            (w.department || '').toLowerCase().includes(query) ||
                            (w.shifts?.shift_name || '').toLowerCase().includes(query) ||
                            w.activityStatus.toLowerCase().includes(query)
      const matchesShift = selectedShiftFilter === 'all' || w.shift_id === selectedShiftFilter
      let matchesStatus = true
      if (selectedStatusFilter === 'active') matchesStatus = w.activityStatus === 'Active'
      if (selectedStatusFilter === 'inactive') matchesStatus = w.activityStatus === 'Inactive'
      if (selectedStatusFilter === 'absent') matchesStatus = w.activityStatus === 'Absent'
      if (selectedStatusFilter === 'disabled') matchesStatus = !w.login_enabled
      return matchesSearch && matchesShift && matchesStatus
    })
  }, [processedWorkers, deferredSearchQuery, selectedShiftFilter, selectedStatusFilter])

  return (
    <div className="p-4 sm:p-6 space-y-6 relative min-h-screen pb-20 bg-slate-950 text-slate-100">
      
      {/* Premium custom floating toast notification */}
      {toast.message && (
        <div className={`fixed bottom-6 right-6 z-55 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border ${
          toast.type === 'error' ? 'bg-rose-950/90 border-rose-500/30 text-rose-400' : 'bg-emerald-950/90 border-emerald-500/30 text-emerald-450'
        } backdrop-blur-xl animate-fade-in`}>
          <ShieldAlert className="h-5 w-5 flex-shrink-0" />
          <span className="text-xs font-black tracking-wide uppercase">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2.5 text-white">
            <Users className="h-6.5 w-6.5 text-teal-400" />
            Worker Management
          </h1>
          <p className="text-xs text-slate-400 mt-1.5">
            Enroll workers, pre-assign shifts, reset credentials, and monitor factory activity status
          </p>
        </div>

        <button
          onClick={() => { resetForm(); setShowAddModal(true) }}
          className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black uppercase px-5 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg transition self-stretch sm:self-auto justify-center"
        >
          <UserPlus className="h-4.5 w-4.5" />
          Enroll New Worker
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-850 p-4 rounded-3xl grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-xl">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search workers by ID, name, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 pl-10 pr-4 text-xs outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex-shrink-0">Shift:</label>
          <select
            value={selectedShiftFilter}
            onChange={(e) => setSelectedShiftFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-white py-2 px-3 rounded-xl text-xs outline-none focus:border-teal-500 transition cursor-pointer"
          >
            <option value="all">All Shifts</option>
            {shifts.map(s => <option key={s.id} value={s.id}>{s.shift_name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex-shrink-0">Status:</label>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-white py-2 px-3 rounded-xl text-xs outline-none focus:border-teal-500 transition cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active (Inside Factory)</option>
            <option value="inactive">Inactive (Checked Out)</option>
            <option value="absent">Absent Today</option>
            <option value="disabled">Login Disabled</option>
          </select>
        </div>
      </div>

      {/* Main Content Grid */}
      {loading ? (
        <div className="flex justify-center py-24">
          <svg className="animate-spin h-10 w-10 text-teal-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-850 rounded-3xl py-16 text-center text-slate-500">
          <Users className="h-12 w-12 mx-auto mb-3 text-slate-800" />
          <p className="text-xs font-bold uppercase tracking-wider">No workers match your filter constraints.</p>
        </div>
      ) : (
        <>
          {/* MOBILE LIST (Visible below md) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
            {filteredWorkers.map(w => (
              <div 
                key={w.id}
                className={`bg-slate-900 border rounded-2xl p-4 flex flex-col justify-between shadow-xl transition ${
                  w.login_enabled === false ? 'border-rose-950 opacity-90' : 'border-slate-850'
                }`}
              >
                <div className="flex gap-3.5 items-start">
                  <div className="flex-shrink-0">
                    {w.photo_url ? (
                      <img src={w.photo_url} alt={w.full_name} className="h-14 w-14 rounded-xl object-cover border border-slate-800" />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-500 text-xs font-bold uppercase">
                        {w.full_name.slice(0, 2)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-start gap-1">
                      <h3 className="text-xs font-black text-white truncate">{w.full_name}</h3>
                      <span className="text-[8px] font-mono font-bold bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 border border-slate-850">
                        {w.worker_id}
                      </span>
                    </div>

                    <div className="space-y-1 mt-2 text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-slate-550" />
                        <span className="truncate">{w.department}</span>
                      </div>
                      {w.shifts && (
                        <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
                          <Clock className="h-3.5 w-3.5 text-indigo-500/70" />
                          <span className="truncate">{w.shifts.shift_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-850/50">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[7px] font-black uppercase text-slate-550 tracking-widest">Liveness</span>
                    {w.activityStatus === 'Active' ? (
                      <span className="text-[8px] font-bold text-emerald-450 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 text-center">Inside Factory</span>
                    ) : w.activityStatus === 'Inactive' ? (
                      <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10 text-center">Checked Out</span>
                    ) : (
                      <span className="text-[8px] font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-center">Absent</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-[7px] font-black uppercase text-slate-550 tracking-widest">Login Access</span>
                    {w.login_enabled ? (
                      <span className="text-[8px] font-bold text-teal-400 bg-teal-500/5 px-2 py-0.5 rounded border border-teal-500/10 text-center">ACTIVE</span>
                    ) : (
                      <span className="text-[8px] font-bold text-rose-450 bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10 text-center">DISABLED</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-[7px] font-black uppercase text-slate-550 tracking-widest">ID Status</span>
                    {w.aadhaar_url ? (
                      w.aadhaar_verified ? (
                        <span className="text-[8px] font-bold text-teal-400 bg-teal-500/5 px-2 py-0.5 rounded border border-teal-500/10 text-center flex items-center justify-center gap-1"><ShieldCheck className="h-2 w-2" /> VERIFIED</span>
                      ) : (
                        <span className="text-[8px] font-bold text-amber-450 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 text-center flex items-center justify-center gap-1"><AlertCircle className="h-2 w-2" /> PENDING</span>
                      )
                    ) : (
                      <span className="text-[8px] font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-center flex items-center justify-center gap-1">MISSING</span>
                    )}
                  </div>
                </div>

                {/* Mobile Per-Worker Overtime Quick Summary */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-955 p-1.5 rounded-xl border border-slate-850/50">
                    <span className="text-[7px] font-black uppercase text-slate-500 block tracking-wider">Today OT</span>
                    <span className={`text-[10px] font-bold ${w.otToday > 0 ? 'text-teal-400' : 'text-slate-500'}`}>
                      {w.otToday.toFixed(2)}h
                    </span>
                  </div>
                  <div className="bg-slate-955 p-1.5 rounded-xl border border-slate-850/50">
                    <span className="text-[7px] font-black uppercase text-slate-500 block tracking-wider">Weekly OT</span>
                    <span className={`text-[10px] font-bold ${w.otWeekly > 0 ? 'text-indigo-400' : 'text-slate-500'}`}>
                      {w.otWeekly.toFixed(2)}h
                    </span>
                  </div>
                  <div className="bg-slate-955 p-1.5 rounded-xl border border-slate-850/50">
                    <span className="text-[7px] font-black uppercase text-slate-500 block tracking-wider">Monthly OT</span>
                    <span className={`text-[10px] font-bold ${w.otMonthly > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {w.otMonthly.toFixed(2)}h
                    </span>
                  </div>
                </div>

                <div className="mt-3 bg-slate-950 p-2.5 rounded-xl border border-slate-850/60 flex justify-between items-center text-[9px] text-slate-500 font-mono">
                  <span>Last Punch:</span>
                  <span className="text-white font-bold">
                    {w.lastPunch ? `${w.lastPunch.punch_type} at ${new Date(w.lastPunch.punch_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} (${w.lastPunch.attendance_date})` : 'Never'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-850/60 pt-3 mt-4">
                  <button
                    onClick={() => toggleLoginPermission(w)}
                    className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border transition ${
                      w.login_enabled ? 'bg-rose-900/20 border-rose-900/30 text-rose-455' : 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                    }`}
                  >
                    {w.login_enabled ? 'Disable Login' : 'Enable Login'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditModal(w)} className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 rounded-lg border border-slate-850 transition">
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDeleteWorker(w.id, w.full_name)} className="p-2 bg-slate-950 hover:bg-rose-900/20 text-slate-405 hover:text-rose-400 rounded-lg border border-slate-850 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP VIEW (Visible at md and above) */}
          <div className="hidden md:block bg-slate-900 border border-slate-850 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-850 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-4 px-5">Photo</th>
                    <th className="py-4 px-5">Worker details</th>
                    <th className="py-4 px-5">Worker Login ID</th>
                    <th className="py-4 px-5">ID Status</th>
                    <th className="py-4 px-5">Shift</th>
                    <th className="py-4 px-5">Liveness Status</th>
                    <th className="py-4 px-5">Login Access</th>
                    <th className="py-4 px-5">Today OT</th>
                    <th className="py-4 px-5">Weekly OT</th>
                    <th className="py-4 px-5">Monthly OT</th>
                    <th className="py-4 px-5">Last Attendance punch</th>
                    <th className="py-4 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-350 text-xs">
                  {filteredWorkers.map(w => (
                    <tr key={w.id} className={`hover:bg-slate-855/10 transition ${w.login_enabled === false ? 'bg-rose-950/5' : ''}`}>
                      <td className="py-3 px-5">
                        {w.photo_url ? (
                          <img src={w.photo_url} alt="Profile" className="h-10 w-10 rounded-xl object-cover border border-slate-800" />
                        ) : (
                          <div className="h-10 w-10 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-850 text-slate-500 font-black font-mono">
                            {w.full_name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-5">
                        <span className="font-extrabold text-white block">{w.full_name}</span>
                        <span className="text-[10px] text-slate-500 block">{w.department} {w.mobile ? `• ${w.mobile}` : ''}</span>
                      </td>
                      <td className="py-3 px-5">
                        <span className="font-mono font-bold bg-slate-950 px-2 py-0.5 border border-slate-850 rounded text-slate-450 uppercase">{w.worker_id}</span>
                      </td>
                      <td className="py-3 px-5">
                        {w.aadhaar_url ? (
                          <div className="flex flex-col gap-1.5 items-start">
                            {w.aadhaar_verified ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-teal-400 bg-teal-500/5 px-2 py-0.5 rounded border border-teal-500/10"><ShieldCheck className="h-2.5 w-2.5" /> VERIFIED</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-amber-450 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10"><AlertCircle className="h-2.5 w-2.5" /> PENDING</span>
                            )}
                            <button onClick={() => handleDownloadAadhaar(w.aadhaar_url)} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"><Download className="h-2.5 w-2.5" /> View ID</button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-850"><FileText className="h-2.5 w-2.5" /> MISSING</span>
                        )}
                      </td>
                      <td className="py-3 px-5">
                        <span className="font-semibold text-slate-300">{w.shifts?.shift_name || 'No Shift'}</span>
                        {w.shifts && <span className="text-[9px] text-slate-500 block font-mono">{formatTime12h(w.shifts.start_time)} - {formatTime12h(w.shifts.end_time)}</span>}
                      </td>
                      <td className="py-3 px-5">
                        {w.activityStatus === 'Active' ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-450 bg-emerald-500/5 px-2.5 py-0.5 rounded border border-emerald-500/10">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Inside Factory
                          </span>
                        ) : w.activityStatus === 'Inactive' ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-455 bg-indigo-500/5 px-2.5 py-0.5 rounded border border-indigo-500/10">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                            Checked Out
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-850">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-700"></span>
                            Absent Today
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-5">
                        <button
                          onClick={() => toggleLoginPermission(w)}
                          className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded border transition ${
                            w.login_enabled ? 'text-teal-400 bg-teal-500/5 border-teal-500/10' : 'text-rose-455 bg-rose-500/5 border-rose-500/10'
                          }`}
                        >
                          {w.login_enabled ? 'ACTIVE' : 'DISABLED'}
                        </button>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border ${
                          w.otToday > 0 ? 'text-teal-400 bg-teal-500/5 border-teal-500/10' : 'text-slate-500 bg-slate-950 border-slate-850'
                        }`}>
                          {w.otToday.toFixed(2)}h
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border ${
                          w.otWeekly > 0 ? 'text-indigo-400 bg-indigo-500/5 border-indigo-500/10' : 'text-slate-500 bg-slate-950 border-slate-850'
                        }`}>
                          {w.otWeekly.toFixed(2)}h
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border ${
                          w.otMonthly > 0 ? 'text-amber-400 bg-amber-500/5 border-amber-500/10' : 'text-slate-500 bg-slate-950 border-slate-850'
                        }`}>
                          {w.otMonthly.toFixed(2)}h
                        </span>
                      </td>
                      <td className="py-3 px-5 font-mono text-[10px] text-slate-405">
                        {w.lastPunch ? (
                          <div>
                            <span className={`font-bold uppercase ${w.lastPunch.punch_type === 'IN' ? 'text-teal-450' : 'text-indigo-400'}`}>{w.lastPunch.punch_type}</span>
                            <span> at {new Date(w.lastPunch.punch_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <span className="text-[9px] text-slate-500 block">{w.lastPunch.attendance_date}</span>
                          </div>
                        ) : <span className="text-slate-600">Never punched</span>}
                      </td>
                      <td className="py-3 px-5 text-right space-x-1.5 whitespace-nowrap">
                        <button onClick={() => openEditModal(w)} className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 rounded-lg border border-slate-850 transition">
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDeleteWorker(w.id, w.full_name)} className="p-1.5 bg-slate-950 hover:bg-rose-900/20 text-slate-400 rounded-lg border border-slate-850 transition">
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

      {/* modal - ENROLL WORKER */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-850 pb-4 mb-4">
              <div className="flex items-center gap-2 text-teal-400">
                <Users className="h-5 w-5" />
                <h2 className="text-sm font-black text-white uppercase tracking-wider">Enroll Worker Account</h2>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200"><X className="h-5 w-5" /></button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 rounded-xl p-3.5 mb-4 flex items-start gap-2.5 text-xs">
                <ShieldAlert className="h-5 w-5 text-rose-500 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddWorker} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Worker Photo File (Optional)</label>
                  <div className="relative group w-full h-28">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    />
                    <div className={`absolute inset-0 border border-dashed rounded-xl p-3 flex flex-col items-center justify-center transition-all duration-300 ${photoFile ? 'border-teal-500 bg-teal-500/5' : 'bg-slate-950 border-slate-800 group-hover:border-teal-500 group-hover:bg-slate-900/80'}`}>
                      {photoFile ? (
                        <>
                           <CheckCircle className="h-6 w-6 text-teal-400 mb-1.5" />
                           <span className="text-[9px] font-black text-white uppercase tracking-wider text-center line-clamp-1 w-full px-2">{photoFile.name}</span>
                           <span className="text-[8px] text-slate-400 font-bold mt-1">Click to replace</span>
                        </>
                      ) : (
                        <>
                           <FileUp className="h-6 w-6 text-slate-500 group-hover:text-teal-400 transition-colors mb-1.5" />
                           <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Upload Photo</span>
                           <span className="text-[8px] text-slate-500 mt-1 text-center">Drag & Drop or Click</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Aadhaar / ID Card (Optional)</label>
                  <div className="relative group w-full h-28">
                    <input 
                      type="file" 
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => setAadhaarFile(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    />
                    <div className={`absolute inset-0 border border-dashed rounded-xl p-3 flex flex-col items-center justify-center transition-all duration-300 ${aadhaarFile ? 'border-indigo-500 bg-indigo-500/5' : 'bg-slate-950 border-slate-800 group-hover:border-indigo-500 group-hover:bg-slate-900/80'}`}>
                      {aadhaarFile ? (
                        <>
                           <CheckCircle className="h-6 w-6 text-indigo-400 mb-1.5" />
                           <span className="text-[9px] font-black text-white uppercase tracking-wider text-center line-clamp-1 w-full px-2">{aadhaarFile.name}</span>
                           <span className="text-[8px] text-slate-400 font-bold mt-1">Click to replace</span>
                        </>
                      ) : (
                        <>
                           <FileUp className="h-6 w-6 text-slate-500 group-hover:text-indigo-400 transition-colors mb-1.5" />
                           <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Upload Aadhaar / ID</span>
                           <span className="text-[8px] text-slate-500 mt-1 text-center">PDF, JPG, PNG (Max 10MB)</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Worker ID (Unique Login ID) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. W1005"
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition font-mono uppercase font-bold"
                />
                <p className="text-[9px] text-slate-500 mt-1">Generates login email: <span className="font-mono text-slate-400">{workerId ? `${workerId.toLowerCase()}${WORKER_EMAIL_SUFFIX}` : `id${WORKER_EMAIL_SUFFIX}`}</span></p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2.5 px-3 text-xs outline-none transition cursor-pointer"
                  >
                    <option value="Superviser">Superviser</option>
                    <option value="Master">Master</option>
                    <option value="BeamGater">BeamGater</option>
                    <option value="Weaver">Weaver</option>
                    <option value="sweeper(saaf safai)">sweeper(saaf safai)</option>
                    <option value="Helper">Helper</option>
                    <option value="Folder">Folder</option>
                    <option value="Watchman">Watchman</option>
                    <option value="Splitting">Splitting</option>
                    <option value="Worper">Worper</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Assigned Shift *</label>
                  <select
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2.5 px-3 text-xs outline-none transition cursor-pointer"
                  >
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.shift_name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Mobile Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Temporary Password *</label>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[10px] text-teal-400 font-bold">{showPassword ? "Hide" : "Show"}</button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[9px] font-bold">
                      <span className="text-slate-500">Strength:</span>
                      <span className="text-teal-400 font-bold">{getPasswordStrength(password).text}</span>
                    </div>
                    <div className="h-1 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                      <div className={`h-full ${getPasswordStrength(password).color} transition-all duration-300`} style={{ width: `${(getPasswordStrength(password).score / 3) * 100}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black uppercase py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition mt-4"
              >
                {formLoading ? 'Registering Auth Account...' : 'Confirm Enrollment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* modal - EDIT PROFILE & CREDENTIALS */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-850 pb-4">
              <div className="flex items-center gap-2 text-indigo-400">
                <Edit className="h-5 w-5" />
                <h2 className="text-sm font-black text-white uppercase tracking-wider">Update Worker Profile & Credentials</h2>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-200"><X className="h-5 w-5" /></button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl p-3.5 mb-2 flex items-start gap-2.5 text-xs animate-pulse">
                <ShieldAlert className="h-5 w-5 text-rose-500 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditWorker} className="space-y-5 text-left">
              {/* Personal details Section */}
              <div className="space-y-3.5">
                <h3 className="text-xs font-black uppercase text-teal-400 tracking-wider border-b border-slate-850/60 pb-1.5 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-teal-500/70" />
                  1. Personal Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Mobile Number</label>
                    <input
                      type="text"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Department</label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 text-white rounded-xl py-2.5 px-3 text-xs outline-none transition cursor-pointer"
                    >
                      <option value="Superviser">Superviser</option>
                      <option value="Master">Master</option>
                      <option value="BeamGater">BeamGater</option>
                      <option value="Weaver">Weaver</option>
                      <option value="sweeper(saaf safai)">sweeper(saaf safai)</option>
                      <option value="Helper">Helper</option>
                      <option value="Folder">Folder</option>
                      <option value="Watchman">Watchman</option>
                      <option value="Splitting">Splitting</option>
                      <option value="Worper">Worper</option>
                    </select>
                  </div>
                  {/* Empty div for grid spacing or future fields */}
                  <div></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Replace Profile Photo (Optional)</label>
                    <div className="relative group w-full h-28">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      />
                      <div className={`absolute inset-0 border border-dashed rounded-xl p-3 flex flex-col items-center justify-center transition-all duration-300 ${photoFile ? 'border-teal-500 bg-teal-500/5' : 'bg-slate-950 border-slate-800 group-hover:border-teal-500 group-hover:bg-slate-900/80'}`}>
                        {photoFile ? (
                          <>
                             <CheckCircle className="h-6 w-6 text-teal-400 mb-1.5" />
                             <span className="text-[9px] font-black text-white uppercase tracking-wider text-center line-clamp-1 w-full px-2">{photoFile.name}</span>
                             <span className="text-[8px] text-slate-400 font-bold mt-1">Click to replace</span>
                          </>
                        ) : (
                          <>
                             <FileUp className="h-6 w-6 text-slate-500 group-hover:text-teal-400 transition-colors mb-1.5" />
                             <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Replace Photo</span>
                             <span className="text-[8px] text-slate-500 mt-1 text-center">Drag & Drop or Click</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Upload/Replace Aadhaar ID</label>
                    <div className="relative group w-full h-28">
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => setAadhaarFile(e.target.files ? e.target.files[0] : null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      />
                      <div className={`absolute inset-0 border border-dashed rounded-xl p-3 flex flex-col items-center justify-center transition-all duration-300 ${aadhaarFile ? 'border-indigo-500 bg-indigo-500/5' : 'bg-slate-950 border-slate-800 group-hover:border-indigo-500 group-hover:bg-slate-900/80'}`}>
                        {aadhaarFile ? (
                          <>
                             <CheckCircle className="h-6 w-6 text-indigo-400 mb-1.5" />
                             <span className="text-[9px] font-black text-white uppercase tracking-wider text-center line-clamp-1 w-full px-2">{aadhaarFile.name}</span>
                             <span className="text-[8px] text-slate-400 font-bold mt-1">Click to replace</span>
                          </>
                        ) : (
                          <>
                             <FileUp className="h-6 w-6 text-slate-500 group-hover:text-indigo-400 transition-colors mb-1.5" />
                             <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Replace Aadhaar</span>
                             <span className="text-[8px] text-slate-500 mt-1 text-center">PDF, JPG, PNG (Max 10MB)</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {aadhaarUrl && (
                  <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-3 flex justify-between items-center mt-3">
                    <div className="flex items-center gap-2">
                      <FileUp className="h-4 w-4 text-indigo-400" />
                      <div>
                        <span className="text-[10px] font-bold text-white block uppercase tracking-wider">Aadhaar / ID Card Uploaded</span>
                        <span className="text-[9px] text-slate-500">Currently stored securely in private bucket</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => handleDownloadAadhaar(aadhaarUrl)} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"><Download className="h-3 w-3" /> View Document</button>
                      
                      <button
                        type="button"
                        onClick={() => setAadhaarVerified(!aadhaarVerified)}
                        className={`text-[9px] font-black uppercase px-2.5 py-1 rounded border transition flex items-center gap-1 ${
                          aadhaarVerified ? 'text-teal-400 bg-teal-500/5 border-teal-500/10' : 'text-amber-450 bg-amber-500/5 border-amber-500/10'
                        }`}
                      >
                        {aadhaarVerified ? <><ShieldCheck className="h-3 w-3" /> VERIFIED</> : <><AlertCircle className="h-3 w-3" /> MARK AS VERIFIED</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Shift Assignment Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-teal-400 tracking-wider border-b border-slate-850/60 pb-1.5 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-teal-500/70" />
                  2. Shift Assignment
                </h3>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Assigned Shift *</label>
                  <select
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-850 focus:border-teal-500 text-white rounded-xl py-2.5 px-3 text-xs outline-none transition cursor-pointer"
                  >
                    <option value="">No shift pre-assigned</option>
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.shift_name} ({formatTime12h(s.start_time)} - {formatTime12h(s.end_time)})</option>)}
                  </select>
                </div>
              </div>

              {/* Login Credentials Section (DIRECT ID & PASS RESET CONTROLS) */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-teal-400 tracking-wider border-b border-slate-850/60 pb-1.5 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-teal-500/70" />
                  3. Login Credentials
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1.5">Worker User ID (Login ID) *</label>
                    <input
                      type="text"
                      required
                      value={workerId}
                      onChange={(e) => setWorkerId(e.target.value)}
                      className="w-full bg-slate-950 border border-amber-500/30 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition font-mono uppercase font-bold"
                    />
                    <span className="text-[8px] text-amber-500 mt-1 block">Modifying this will sync your Auth email.</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Derived Auth Email</label>
                    <div className="w-full bg-slate-950 border border-slate-850 text-slate-500 rounded-xl py-2.5 px-3.5 text-xs font-mono select-all">
                      {workerId ? `${workerId.toLowerCase()}${WORKER_EMAIL_SUFFIX}` : `id${WORKER_EMAIL_SUFFIX}`}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-850 rounded-2xl p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">Reset Account Password</span>
                    <span className="text-[8px] text-slate-550 uppercase">Leave blank to keep unchanged</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-[9px] font-bold text-slate-450 uppercase tracking-wider">New Password</label>
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[9px] text-slate-500 hover:text-white font-bold">{showPassword ? "Hide" : "Show"}</button>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="•••••••• (Min 8 chars)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 text-white rounded-xl py-2 px-3 text-xs outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">Confirm New Password</label>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 text-white rounded-xl py-2 px-3 text-xs outline-none transition"
                      />
                    </div>
                  </div>

                  {newPassword && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[9px] font-bold">
                        <span className="text-slate-550">Password Strength:</span>
                        <span className="text-indigo-400">{getPasswordStrength(newPassword).text}</span>
                      </div>
                      <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div className={`h-full ${getPasswordStrength(newPassword).color} transition-all duration-300`} style={{ width: `${(getPasswordStrength(newPassword).score / 3) * 100}%` }}></div>
                      </div>
                      {newPassword !== confirmPassword && (
                        <p className="text-[9px] text-rose-500 font-bold mt-1">⚠️ Confirmed password does not match.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Account Status Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-teal-400 tracking-wider border-b border-slate-850/60 pb-1.5 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-teal-500/70" />
                  4. Account Status
                </h3>
                <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl flex items-center justify-between shadow-inner">
                  <div>
                    <span className="text-xs font-bold text-white block">Worker Login Status</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">Deactivating instantly terminates their session and blocks sign-in.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLoginEnabled(!loginEnabled)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition border ${
                      loginEnabled ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {loginEnabled ? 'ACTIVE / LOGIN ALLOWED' : 'SUSPENDED / LOGIN DISABLED'}
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <button
                type="submit"
                disabled={formLoading || (newPassword && newPassword !== confirmPassword)}
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black uppercase py-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition mt-4"
              >
                {formLoading ? (
                  <>
                    <svg className="animate-spin h-4.5 w-4.5 text-slate-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Applying Secure Auth Updates...</span>
                  </>
                ) : <span>Save Profile & Credentials</span>}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
