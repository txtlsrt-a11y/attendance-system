import React, { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault()
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e)
      // Show the install banner
      setIsVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Check if app is already running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    
    // Show the install prompt
    deferredPrompt.prompt()
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice
    console.log(`User response to install prompt: ${outcome}`)
    
    // We've used the prompt, and can't use it again
    setDeferredPrompt(null)
    setIsVisible(false)
  }

  const handleClose = () => {
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-gradient-to-r from-slate-900 to-slate-800 border border-teal-500/30 rounded-2xl p-4 shadow-2xl z-50 flex items-center gap-3 animate-bounce">
      <div className="h-10 w-10 bg-teal-500/10 text-teal-400 rounded-xl flex items-center justify-center flex-shrink-0">
        <Download className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
          Install Native App
        </p>
        <p className="text-xs text-slate-350 leading-relaxed truncate">
          Add Textile Attendance to Home Screen
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition"
        >
          Install
        </button>
        <button
          onClick={handleClose}
          className="p-1 text-slate-400 hover:text-slate-200 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
