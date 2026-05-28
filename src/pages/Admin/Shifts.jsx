import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { formatTime12h } from '../../utils/dateHelpers'
import { 
  CalendarDays, 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  Clock, 
  AlertTriangle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'

export default function ManageShifts() {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [currentShift, setCurrentShift] = useState(null)

  // Form states
  const [shiftName, setShiftName] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [graceMinutes, setGraceMinutes] = useState(15)
  const [active, setActive] = useState(true)
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const loadShifts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .order('start_time', { ascending: true })

      if (error) throw error
      setShifts(data || [])
    } catch (err) {
      console.error('Error loading shifts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadShifts()
  }, [])

  const handleAddShift = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    try {
      // Append seconds if needed for Postgres Time type
      const formattedStart = startTime.includes(':') && startTime.split(':').length === 2 ? `${startTime}:00` : startTime
      const formattedEnd = endTime.includes(':') && endTime.split(':').length === 2 ? `${endTime}:00` : endTime

      const { error } = await supabase
        .from('shifts')
        .insert({
          shift_name: shiftName.trim(),
          start_time: formattedStart,
          end_time: formattedEnd,
          grace_minutes: parseInt(graceMinutes, 10),
          active
        })

      if (error) throw error

      setShowAddModal(false)
      resetForm()
      await loadShifts()
      alert('New shift created successfully.')

    } catch (err) {
      console.error(err)
      setFormError(err.message || 'Failed to create shift.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEditShift = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    try {
      const formattedStart = startTime.includes(':') && startTime.split(':').length === 2 ? `${startTime}:00` : startTime
      const formattedEnd = endTime.includes(':') && endTime.split(':').length === 2 ? `${endTime}:00` : endTime

      const { error } = await supabase
        .from('shifts')
        .update({
          shift_name: shiftName.trim(),
          start_time: formattedStart,
          end_time: formattedEnd,
          grace_minutes: parseInt(graceMinutes, 10),
          active
        })
        .eq('id', currentShift.id)

      if (error) throw error

      setShowEditModal(false)
      resetForm()
      await loadShifts()
      alert('Shift updated successfully.')

    } catch (err) {
      console.error(err)
      setFormError(err.message || 'Failed to update shift.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteShift = async (id, name) => {
    if (!confirm(`Are you sure you want to delete shift "${name}"? If workers are currently assigned to this shift, their assignment will be set to None.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', id)

      if (error) throw error
      setShifts(prev => prev.filter(s => s.id !== id))
      alert('Shift deleted successfully.')
    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to delete shift.')
    }
  }

  const openEditModal = (shift) => {
    setCurrentShift(shift)
    setShiftName(shift.shift_name)
    
    // Convert HH:MM:SS to HH:MM for input tag
    setStartTime(shift.start_time.slice(0, 5))
    setEndTime(shift.end_time.slice(0, 5))
    
    setGraceMinutes(shift.grace_minutes)
    setActive(shift.active)
    setShowEditModal(true)
  }

  const resetForm = () => {
    setShiftName('')
    setStartTime('09:00')
    setEndTime('18:00')
    setGraceMinutes(15)
    setActive(true)
    setFormError('')
  }

  return (
    <div className="p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">
            Manage Shifts
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure shift timings, grace limits, and active statuses
          </p>
        </div>

        <button
          onClick={() => {
            resetForm()
            setShowAddModal(true)
          }}
          className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg transition"
        >
          <Plus className="h-4.5 w-4.5" />
          Create New Shift
        </button>
      </div>

      {/* Shifts List Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-8 w-8 text-teal-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-850 rounded-2xl py-12 text-center text-slate-500">
          <CalendarDays className="h-10 w-10 mx-auto mb-2 text-slate-700" />
          <p className="text-xs">No shifts configured in system.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shifts.map((shift) => (
            <div 
              key={shift.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow flex flex-col justify-between hover:border-slate-850 transition-all ${
                shift.active ? 'border-slate-850' : 'border-slate-900 opacity-60'
              }`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="text-base font-black text-white">{shift.shift_name}</h3>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    shift.active 
                      ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' 
                      : 'bg-slate-950 text-slate-550 border border-slate-850'
                  }`}>
                    {shift.active ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <div className="mt-4 space-y-2 border-t border-slate-850/60 pt-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-500" /> Start Time:</span>
                    <span className="font-extrabold text-white font-mono">{formatTime12h(shift.start_time)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-500" /> End Time:</span>
                    <span className="font-extrabold text-white font-mono">{formatTime12h(shift.end_time)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-500" /> Grace Limit:</span>
                    <span className="font-bold text-teal-400">{shift.grace_minutes} mins</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-850/60 pt-3 mt-4">
                <button
                  onClick={() => openEditModal(shift)}
                  className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition text-xs flex items-center gap-1.5 font-bold"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteShift(shift.id, shift.shift_name)}
                  className="p-2 bg-slate-950 hover:bg-rose-950/20 text-slate-400 hover:text-rose-455 rounded-lg transition text-xs flex items-center gap-1.5 font-bold"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Modal - Create Shift */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            
            <div className="flex justify-between items-center border-b border-slate-850 pb-4 mb-4">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Create Shift Timing
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl p-3.5 mb-4 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddShift} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Shift Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Shift"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-850">
                <div>
                  <span className="text-xs font-semibold text-slate-350 block">Shift Active Status</span>
                  <span className="text-[10px] text-slate-500 block">Disabled shifts cannot be pre-assigned to workers.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActive(prev => !prev)}
                  className="text-slate-400 hover:text-teal-400 transition"
                >
                  {active ? (
                    <ToggleRight className="h-9 w-9 text-teal-400" />
                  ) : (
                    <ToggleLeft className="h-9 w-9 text-slate-700" />
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black uppercase py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition mt-4"
              >
                {formLoading ? 'Creating Shift...' : 'Confirm Shift Configuration'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Edit Shift */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            
            <div className="flex justify-between items-center border-b border-slate-850 pb-4 mb-4">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Edit Shift Settings
              </h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl p-3.5 mb-4 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditShift} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Shift Name *
                </label>
                <input
                  type="text"
                  required
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-xl py-2 px-3 text-xs outline-none focus:border-teal-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-850">
                <div>
                  <span className="text-xs font-semibold text-slate-350 block">Shift Active Status</span>
                  <span className="text-[10px] text-slate-500 block">Disabled shifts will lock out assignments.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActive(prev => !prev)}
                  className="text-slate-400 hover:text-teal-400 transition"
                >
                  {active ? (
                    <ToggleRight className="h-9 w-9 text-teal-400" />
                  ) : (
                    <ToggleLeft className="h-9 w-9 text-slate-700" />
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black uppercase py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition mt-4"
              >
                {formLoading ? 'Saving...' : 'Save Shift Settings'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
