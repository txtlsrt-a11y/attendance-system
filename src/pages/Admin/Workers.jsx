import React, { useState, useEffect } from 'react'
import { supabase, supabaseSecondary } from '../../supabase'
import { WORKER_EMAIL_SUFFIX } from '../../context/AuthContext'
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Search, 
  X, 
  ShieldAlert, 
  Clock, 
  Briefcase, 
  Phone 
} from 'lucide-react'

export default function ManageWorkers() {
  const [workers, setWorkers] = useState([])
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedShiftFilter, setSelectedShiftFilter] = useState('all')

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [currentWorker, setCurrentWorker] = useState(null)

  // Form states
  const [fullName, setFullName] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [mobile, setMobile] = useState('')
  const [department, setDepartment] = useState('Production')
  const [shiftId, setShiftId] = useState('')
  const [password, setPassword] = useState('12345678') // Default password
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Load workers and shifts
  const loadData = async () => {
    setLoading(true)
    try {
      // 1. Fetch active shifts
      const { data: shiftsData, error: shiftsErr } = await supabase
        .from('shifts')
        .select('*')
        .eq('active', true)
      
      if (shiftsErr) throw shiftsErr
      setShifts(shiftsData || [])
      if (shiftsData && shiftsData.length > 0) {
        setShiftId(shiftsData[0].id)
      }

      // 2. Fetch workers profiles
      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select('*, shifts(*)')
        .eq('role', 'worker')
        .order('created_at', { ascending: false })

      if (profilesErr) throw profilesErr
      setWorkers(profilesData || [])

    } catch (err) {
      console.error('Error loading workers/shifts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Handle Photo Upload to storage
  const uploadProfilePhoto = async (id, file) => {
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `profiles/${id}_${Date.now()}.${fileExt}`

      const { error: uploadErr } = await supabase.storage
        .from('attendance-selfies')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage
        .from('attendance-selfies')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (err) {
      console.error('Photo upload failed:', err)
      return null
    }
  }

  // Add worker sign up
  const handleAddWorker = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    try {
      if (!workerId.trim()) throw new Error('Worker ID is required')
      if (!fullName.trim()) throw new Error('Full Name is required')

      const formattedEmail = `${workerId.trim().toLowerCase()}${WORKER_EMAIL_SUFFIX}`

      // Upload profile image if present
      let uploadedUrl = photoUrl
      if (photoFile) {
        uploadedUrl = await uploadProfilePhoto(workerId.trim(), photoFile) || ''
      }

      // Register user in Supabase Auth using the SECONDARY client
      // (This prevents logging out the current admin session)
      const { data, error: signupErr } = await supabaseSecondary.auth.signUp({
        email: formattedEmail,
        password: password,
        options: {
          data: {
            role: 'worker',
            full_name: fullName.trim(),
            worker_id: workerId.trim().toUpperCase(),
            mobile: mobile.trim(),
            department: department,
            shift_id: shiftId,
            photo_url: uploadedUrl
          }
        }
      })

      if (signupErr) throw signupErr
      if (!data.user) throw new Error('Signup succeeded but user metadata is missing')

      setShowAddModal(false)
      resetForm()
      await loadData()
      alert(`Worker ${fullName} enrolled successfully. Login ID: ${workerId.toUpperCase()}`)

    } catch (err) {
      console.error(err)
      setFormError(err.message || 'Failed to enroll worker.')
    } finally {
      setFormLoading(false)
    }
  }

  // Update worker profile
  const handleEditWorker = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    try {
      let uploadedUrl = photoUrl
      if (photoFile) {
        uploadedUrl = await uploadProfilePhoto(currentWorker.worker_id, photoFile) || photoUrl
      }

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          mobile: mobile.trim(),
          department: department,
          shift_id: shiftId,
          photo_url: uploadedUrl
        })
        .eq('id', currentWorker.id)

      if (updateErr) throw updateErr

      setShowEditModal(false)
      resetForm()
      await loadData()
      alert('Worker profile updated successfully.')

    } catch (err) {
      console.error(err)
      setFormError(err.message || 'Failed to update worker.')
    } finally {
      setFormLoading(false)
    }
  }

  // Delete worker
  const handleDeleteWorker = async (id, name) => {
    if (!confirm(`Are you sure you want to delete worker "${name}"? All associated attendance logs will be lost.`)) {
      return
    }

    try {
      // In a real application, to delete auth users, you would call an edge function or Admin API.
      // In this client code, deleting the profile row will delete the worker.
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id)

      if (error) throw error
      setWorkers(prev => prev.filter(w => w.id !== id))
      alert('Worker profile removed successfully.')
    } catch (err) {
      console.error(err)
      alert('Error deleting worker. This requires Admin API or manual auth user deletion in Supabase.')
    }
  }

  const openEditModal = (worker) => {
    setCurrentWorker(worker)
    setFullName(worker.full_name)
    setWorkerId(worker.worker_id)
    setMobile(worker.mobile || '')
    setDepartment(worker.department || 'Production')
    setShiftId(worker.shift_id || '')
    setPhotoUrl(worker.photo_url || '')
    setPhotoFile(null)
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFullName('')
    setWorkerId('')
    setMobile('')
    setDepartment('Production')
    setPhotoUrl('')
    setPhotoFile(null)
    setPassword('12345678')
    if (shifts.length > 0) setShiftId(shifts[0].id)
    setFormError('')
  }

  // Filter and search logic
  const filteredWorkers = workers.filter(w => {
    const matchesSearch = 
      w.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.worker_id && w.worker_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (w.department && w.department.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesShift = 
      selectedShiftFilter === 'all' || w.shift_id === selectedShiftFilter

    return matchesSearch && matchesShift
  })

  return (
    <div className="p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">
            Manage Workers
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enroll workers, edit details, and pre-assign shifts
          </p>
        </div>

        <button
          onClick={() => {
            resetForm()
            setShowAddModal(true)
          }}
          className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg transition"
        >
          <UserPlus className="h-4.5 w-4.5" />
          Enroll New Worker
        </button>
      </div>

      {/* Search and filter controls */}
      <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
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

        {/* Shift filter */}
        <div className="w-full sm:w-auto flex items-center gap-2 self-start sm:self-auto">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Shift Assign:
          </label>
          <select
            value={selectedShiftFilter}
            onChange={(e) => setSelectedShiftFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white py-2 px-3 rounded-xl text-xs outline-none focus:border-teal-500 transition"
          >
            <option value="all">All Shifts</option>
            {shifts.map(s => (
              <option key={s.id} value={s.id}>{s.shift_name}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Workers Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-8 w-8 text-teal-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-850 rounded-2xl py-12 text-center text-slate-500">
          <Users className="h-10 w-10 mx-auto mb-2 text-slate-700" />
          <p className="text-xs">No workers found matching your query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkers.map((worker) => (
            <div 
              key={worker.id}
              className="bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow flex gap-4 hover:border-slate-800 transition"
            >
              {/* Photo */}
              <div className="flex-shrink-0">
                {worker.photo_url ? (
                  <img
                    src={worker.photo_url}
                    alt={worker.full_name}
                    className="h-16 w-16 rounded-xl object-cover border border-slate-850"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-center text-slate-500 text-xs font-bold uppercase">
                    {worker.full_name.slice(0,2)}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-1">
                    <h3 className="text-sm font-black text-white truncate pr-2">
                      {worker.full_name}
                    </h3>
                    <span className="text-[9px] font-mono font-bold bg-slate-950 px-2 py-0.5 rounded text-slate-400 flex-shrink-0">
                      {worker.worker_id}
                    </span>
                  </div>
                  
                  <div className="space-y-1 mt-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{worker.department}</span>
                    </div>
                    {worker.mobile && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                        <span>{worker.mobile}</span>
                      </div>
                    )}
                    {worker.shifts && (
                      <div className="flex items-center gap-1.5 text-indigo-400">
                        <Clock className="h-3.5 w-3.5 text-indigo-400/70 flex-shrink-0" />
                        <span className="truncate font-semibold">{worker.shifts.shift_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-850/60 pt-3 mt-3">
                  <button
                    onClick={() => openEditModal(worker)}
                    className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                    title="Edit profile"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteWorker(worker.id, worker.full_name)}
                    className="p-1.5 bg-slate-950 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                    title="Remove worker"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Enrollment (Add Worker) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            
            <div className="flex justify-between items-center border-b border-slate-850 pb-4 mb-4">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Enroll Worker Account
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl p-3.5 mb-4 flex items-start gap-2.5 text-xs">
                <ShieldAlert className="h-5 w-5 text-rose-500 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddWorker} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Worker ID (Unique Login ID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. W1005"
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3 text-xs outline-none transition"
                  >
                    <option value="Production">Production</option>
                    <option value="Spinning">Spinning</option>
                    <option value="Weaving">Weaving</option>
                    <option value="Dyeing">Dyeing</option>
                    <option value="Inspection">Inspection</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Assigned Shift *
                  </label>
                  <select
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3 text-xs outline-none transition"
                  >
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>{s.shift_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Mobile Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Password for login (Min 6 chars) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Default: 12345678"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Profile Photo File (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-400 rounded-xl py-2 px-3 text-xs outline-none transition file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-teal-500 file:text-slate-950 hover:file:bg-teal-400 file:cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black uppercase py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition mt-4"
              >
                {formLoading ? 'Registering Worker...' : 'Confirm Enrollment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Edit Profile */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            
            <div className="flex justify-between items-center border-b border-slate-850 pb-4 mb-4">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Edit Worker Profile
              </h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 rounded-xl p-3.5 mb-4 flex items-start gap-2.5 text-xs">
                <ShieldAlert className="h-5 w-5 text-rose-500 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditWorker} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Worker ID (Non-editable)
                </label>
                <input
                  type="text"
                  disabled
                  value={workerId}
                  className="w-full bg-slate-950/60 border border-slate-850 text-slate-500 rounded-xl py-2.5 px-3.5 text-xs outline-none cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3 text-xs outline-none transition"
                  >
                    <option value="Production">Production</option>
                    <option value="Spinning">Spinning</option>
                    <option value="Weaving">Weaving</option>
                    <option value="Dyeing">Dyeing</option>
                    <option value="Inspection">Inspection</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Assigned Shift *
                  </label>
                  <select
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3 text-xs outline-none transition"
                  >
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>{s.shift_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Mobile Number
                </label>
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Replace Profile Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-400 rounded-xl py-2 px-3 text-xs outline-none transition file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-teal-500 file:text-slate-950 hover:file:bg-teal-400 file:cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black uppercase py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition mt-4"
              >
                {formLoading ? 'Saving changes...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
