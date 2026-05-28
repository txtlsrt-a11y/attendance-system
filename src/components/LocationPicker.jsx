import React, { useState, useEffect } from 'react'
import { MapPin, Check, AlertTriangle, Loader2 } from 'lucide-react'

export const LocationPicker = ({ onChange }) => {
  const [loading, setLoading] = useState(true)
  const [coordinates, setCoordinates] = useState({ latitude: null, longitude: null })
  const [statusText, setStatusText] = useState('Acquiring GPS location...')
  const [statusType, setStatusType] = useState('loading') // 'loading', 'success', 'denied'

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatusText('GPS Geolocation not supported by this browser')
      setStatusType('denied')
      setLoading(false)
      onChange({ latitude: null, longitude: null })
      return
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 seconds timeout
      maximumAge: 0
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
        setCoordinates(coords)
        setStatusText('GPS Location acquired successfully')
        setStatusType('success')
        setLoading(false)
        onChange(coords)
      },
      (error) => {
        console.warn('Geolocation error code:', error.code, error.message)
        let msg = 'Location unavailable (GPS denied or timed out)'
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'GPS Permission denied. Proceeding without location.'
        }
        setStatusText(msg)
        setStatusType('denied')
        setLoading(false)
        onChange({ latitude: null, longitude: null }) // still allow punch
      },
      options
    )
  }, [])

  return (
    <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/60 rounded-xl px-4 py-3 w-full">
      {statusType === 'loading' && (
        <Loader2 className="h-5 w-5 text-teal-400 animate-spin flex-shrink-0" />
      )}
      {statusType === 'success' && (
        <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-400">
          <Check className="h-3.5 w-3.5" />
        </div>
      )}
      {statusType === 'denied' && (
        <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-350 uppercase tracking-wider">
          GPS Location Tracking
        </p>
        <p className="text-xs text-slate-400 truncate mt-0.5">
          {statusText}
        </p>
      </div>

      {statusType === 'success' && (
        <div className="text-[10px] text-right font-mono text-slate-500 flex-shrink-0 hidden xs:block">
          <div>Lat: {coordinates.latitude?.toFixed(4)}</div>
          <div>Lng: {coordinates.longitude?.toFixed(4)}</div>
        </div>
      )}
    </div>
  )
}
