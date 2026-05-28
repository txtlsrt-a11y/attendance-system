import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { Settings, Save, AlertTriangle, Key, ShieldAlert, Cpu } from 'lucide-react'

export default function AdminSettings() {
  const [loading, setLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
  
  // Settings values
  const [companyName, setCompanyName] = useState('Textile Shift Attendance System')
  const [lateGraceMinutes, setLateGraceMinutes] = useState(15)
  const [earlyExitMinutes, setEarlyExitMinutes] = useState(15)
  const [logoUrl, setLogoUrl] = useState('')
  const [formError, setFormError] = useState('')

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (error) throw error

      if (data) {
        setCompanyName(data.company_name)
        setLateGraceMinutes(data.late_grace_minutes)
        setEarlyExitMinutes(data.early_exit_minutes)
        setLogoUrl(data.logo_url || '')
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSaveLoading(true)

    try {
      const { error } = await supabase
        .from('settings')
        .update({
          company_name: companyName.trim(),
          late_grace_minutes: parseInt(lateGraceMinutes, 10),
          early_exit_minutes: parseInt(earlyExitMinutes, 10),
          logo_url: logoUrl.trim()
        })
        .eq('id', 1)

      if (error) throw error
      alert('Global factory configurations saved successfully.')
    } catch (err) {
      console.error(err)
      setFormError(err.message || 'Failed to update configurations.')
    } finally {
      setSaveLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">
          Factory Configurations
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Adjust company profiles, late-tolerance limits, and early-exit thresholds
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-8 w-8 text-teal-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Settings form (2 cols) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-xl h-fit">
            
            <div className="flex items-center gap-2 mb-6 border-b border-slate-850 pb-4">
              <Settings className="h-5 w-5 text-teal-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                Shift Tolerance Rules
              </h2>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl p-3.5 mb-4 flex items-start gap-2.5 text-xs">
                <ShieldAlert className="h-5 w-5 text-rose-500 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Company / Factory Name *
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Lateness Grace Period (Minutes) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={lateGraceMinutes}
                    onChange={(e) => setLateGraceMinutes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                  />
                  <p className="text-[10px] text-slate-550 mt-1.5 leading-relaxed">
                    Punches made after shift-start + this value are flagged as "Late" instead of "Present".
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Early Exit Threshold (Minutes) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={earlyExitMinutes}
                    onChange={(e) => setEarlyExitMinutes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                  />
                  <p className="text-[10px] text-slate-550 mt-1.5 leading-relaxed">
                    Punches out recorded earlier than shift-end - this value flag the worker as early-exit.
                  </p>
                </div>

              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Company Logo Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-850/60">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black uppercase px-6 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg transition"
                >
                  <Save className="h-4.5 w-4.5" />
                  {saveLoading ? 'Saving...' : 'Save Global Settings'}
                </button>
              </div>

            </form>

          </div>

          {/* Quick Info Box (1 col) */}
          <div className="space-y-6">
            
            <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Key className="h-4.5 w-4.5 text-indigo-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Supabase Backend
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                This client connects directly using the credentials loaded from the <code>.env</code> file. Make sure your RLS policies are ran inside the Supabase console.
              </p>
              
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 font-mono text-[10px] text-indigo-300 select-all truncate">
                Url: {import.meta.env.VITE_SUPABASE_URL}
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-slate-500">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <p>
                Changing the grace period parameters will affect liveness calculations of all future attendance punch logs, but will not modify already stored punch logs.
              </p>
            </div>

          </div>

        </div>
      )}

    </div>
  )
}
