import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'
import imageCompression from 'browser-image-compression'
import { Settings, Save, AlertTriangle, Key, ShieldAlert, Cpu, Upload, Image as ImageIcon, X, Trash2, MapPin } from 'lucide-react'

export default function AdminSettings() {
  const [loading, setLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
  
  // Settings values
  const [companyName, setCompanyName] = useState('Textile Shift Attendance System')
  const [lateGraceMinutes, setLateGraceMinutes] = useState(15)
  const [earlyExitMinutes, setEarlyExitMinutes] = useState(15)
  const [logoUrl, setLogoUrl] = useState('')
  const [logoStoragePath, setLogoStoragePath] = useState('')
  const [factoryLatitude, setFactoryLatitude] = useState(0)
  const [factoryLongitude, setFactoryLongitude] = useState(0)
  const [allowedRadius, setAllowedRadius] = useState(50)
  const [logoFile, setLogoFile] = useState(null)
  const [formError, setFormError] = useState('')
  
  const fileInputRef = useRef(null)

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
          setLogoStoragePath(data.logo_storage_path || '')
          setFactoryLatitude(data.factory_latitude || 0)
          setFactoryLongitude(data.factory_longitude || 0)
          setAllowedRadius(data.allowed_radius || 50)
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
      let finalUrl = logoUrl
      let finalPath = logoStoragePath

      if (logoFile) {
        let uploadFile = logoFile
        if (logoFile.type.startsWith('image/')) {
          try {
            uploadFile = await imageCompression(logoFile, { maxSizeMB: 0.2, maxWidthOrHeight: 500, useWebWorker: true, fileType: 'image/webp' })
          } catch (e) {
            console.warn('Image compression failed', e)
          }
        }

        const fileExt = uploadFile.type === 'image/webp' ? 'webp' : logoFile.name.split('.').pop()
        const newPath = `logos/company_logo_${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('company-assets')
          .upload(newPath, uploadFile, { cacheControl: '3600', upsert: true })

        if (uploadError) {
          if (uploadError.message.toLowerCase().includes('bucket not found')) {
            throw new Error('Storage bucket "company-assets" is missing. Please run the required SQL migration to create the bucket.')
          }
          throw new Error('Failed to upload logo image: ' + uploadError.message)
        }

        const { data: { publicUrl } } = supabase.storage.from('company-assets').getPublicUrl(newPath)
        
        // Cleanup old logo if it existed
        if (logoStoragePath) {
          await supabase.storage.from('company-assets').remove([logoStoragePath]).catch(() => {})
        }

        finalUrl = publicUrl
        finalPath = newPath
      }

      const { error } = await supabase
        .from('settings')
        .update({
          company_name: companyName.trim(),
          late_grace_minutes: parseInt(lateGraceMinutes, 10),
          early_exit_minutes: parseInt(earlyExitMinutes, 10),
          logo_url: finalUrl,
          logo_storage_path: finalPath,
          factory_latitude: parseFloat(factoryLatitude) || null,
          factory_longitude: parseFloat(factoryLongitude) || null,
          allowed_radius: parseInt(allowedRadius, 10) || 50
        })
        .eq('id', 1)

      if (error) throw error
      
      setLogoUrl(finalUrl)
      setLogoStoragePath(finalPath)
      setLogoFile(null)
      
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
                  Company Logo Upload
                </label>
                
                {logoUrl && !logoFile ? (
                  <div className="relative group rounded-2xl border-2 border-slate-800 bg-slate-900/50 p-4 flex flex-col items-center justify-center transition-all hover:border-slate-700">
                    <img src={logoUrl} alt="Current Logo" className="h-20 object-contain rounded-lg mb-3 bg-white/5 p-2" />
                    <div className="flex gap-3">
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[10px] font-bold text-teal-400 uppercase bg-teal-500/10 px-3 py-1.5 rounded-lg hover:bg-teal-500/20 transition"
                      >
                        Replace Logo
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setLogoUrl(''); setLogoStoragePath(''); setLogoFile(null); }}
                        className="text-[10px] font-bold text-rose-400 uppercase bg-rose-500/10 px-3 py-1.5 rounded-lg hover:bg-rose-500/20 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
                      logoFile 
                        ? 'border-teal-500/50 bg-teal-500/5' 
                        : 'border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/5 bg-slate-900/50'
                    } flex flex-col items-center justify-center p-6 text-center h-32`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                      onChange={(e) => {
                        const file = e.target.files[0]
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            setFormError('Image size cannot exceed 5MB')
                            return
                          }
                          setLogoFile(file)
                          setFormError('')
                        }
                      }}
                    />
                    
                    {logoFile ? (
                      <div className="flex flex-col items-center z-10">
                        <div className="h-10 w-10 rounded-full bg-teal-500 flex items-center justify-center mb-2 shadow-lg shadow-teal-500/30">
                          <ImageIcon className="h-5 w-5 text-slate-950" />
                        </div>
                        <span className="text-[11px] font-bold text-white mb-0.5 truncate max-w-[200px]">
                          {logoFile.name}
                        </span>
                        <span className="text-[9px] text-teal-400 font-semibold uppercase tracking-wider">
                          Ready to Upload
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setLogoFile(null); fileInputRef.current.value = ''; }}
                          className="absolute top-2 right-2 p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 rounded-lg transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <Upload className="h-4.5 w-4.5 text-slate-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-300">Click to upload logo</span>
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">
                          PNG, JPG, SVG up to 5MB
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-850/60 mt-6">
                <div className="flex items-center gap-2 mb-6">
                  <MapPin className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">
                    Factory GPS Geofence
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Factory Latitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={factoryLatitude || ''}
                      onChange={(e) => setFactoryLatitude(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Factory Longitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={factoryLongitude || ''}
                      onChange={(e) => setFactoryLongitude(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Allowed Radius (Meters) *
                    </label>
                    <input
                      type="number"
                      min={10}
                      required
                      value={allowedRadius || ''}
                      onChange={(e) => setAllowedRadius(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-xl py-2.5 px-3.5 text-xs outline-none transition"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-550 mt-3 leading-relaxed">
                  Workers can only punch their attendance when their GPS location is within the allowed radius of these coordinates.
                </p>
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
                <Cpu className="h-4.5 w-4.5 text-indigo-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Security Lock Active
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Database operations, storage bucket endpoints, and Row-Level Security (RLS) constraints are audited and monitored. Environment configuration keys are completely secured.
              </p>
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
