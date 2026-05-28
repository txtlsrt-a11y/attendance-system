import React, { useRef, useState, useEffect } from 'react'
import { Camera, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'

export const CameraCapture = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)
  const [isCaptured, setIsCaptured] = useState(false)
  const [capturedImg, setCapturedImg] = useState(null)
  const [compressing, setCompressing] = useState(false)
  const [facingMode, setFacingMode] = useState('user') // 'user' for front camera (selfie)

  // Start Camera Stream
  const startCamera = async () => {
    setError(null)
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }

    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      console.error('Camera stream access failed:', err)
      setError('Could not access camera. Please ensure permissions are granted and you are using HTTPS.')
    }
  }

  useEffect(() => {
    startCamera()
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [facingMode])

  // Capture Photo and Compress
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Set canvas dimensions to square (crop to middle)
    const size = Math.min(video.videoWidth, video.videoHeight)
    canvas.width = 480
    canvas.height = 480

    // Source coordinates for cropping
    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2

    // Draw video frame to canvas
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 480, 480)

    // Compress canvas image before upload
    setCompressing(true)
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' })
        const previewUrl = URL.createObjectURL(blob)
        
        setCapturedImg(previewUrl)
        setIsCaptured(true)
        setCompressing(false)
        
        // Pass file to parent
        onCapture(file, previewUrl)
      }
    }, 'image/jpeg', 0.7) // 70% JPEG quality produces a ~30-50KB highly clear image
  }

  // Toggle Camera (Front/Back)
  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'))
  }

  const retakePhoto = () => {
    setIsCaptured(false)
    setCapturedImg(null)
    startCamera()
  }

  return (
    <div className="flex flex-col items-center bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-xl max-w-sm w-full mx-auto">
      <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden mb-4 border border-slate-800">
        
        {/* Live Camera Stream */}
        {!isCaptured && !error && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
            {/* Selfie Overlay Guide */}
            <div className="absolute inset-0 border-[3px] border-dashed border-teal-500/40 rounded-full m-8 pointer-events-none flex items-center justify-center">
              <span className="text-[10px] text-teal-400 bg-slate-950/80 px-2 py-0.5 rounded-full font-medium uppercase tracking-wider">
                Position Face Here
              </span>
            </div>
          </>
        )}

        {/* Captured Preview */}
        {isCaptured && capturedImg && (
          <img
            src={capturedImg}
            alt="Selfie Preview"
            className="w-full h-full object-cover transform -scale-x-100"
          />
        )}

        {/* Loading/Compressing Screen */}
        {compressing && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-teal-400">
            <RefreshCw className="h-8 w-8 animate-spin mb-2" />
            <span className="text-sm font-semibold tracking-wider animate-pulse">Compressing image...</span>
          </div>
        )}

        {/* Error Screen */}
        {error && (
          <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="h-10 w-10 text-rose-500 mb-2" />
            <p className="text-sm text-slate-350 font-medium mb-4">{error}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 transition text-white text-xs font-semibold rounded-lg shadow-lg"
            >
              Retry Camera Access
            </button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Buttons */}
      <div className="flex w-full gap-3 justify-center">
        {!isCaptured ? (
          <>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={toggleCamera}
              disabled={error}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              title="Switch Camera"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              disabled={error}
              className="flex-[2] py-2.5 bg-gradient-to-r from-teal-500 to-indigo-500 hover:from-teal-600 hover:to-indigo-600 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Camera className="h-5 w-5" />
              Capture Selfie
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={retakePhoto}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
            >
              Retake
            </button>
            <div className="flex-[2] py-2.5 bg-teal-500/20 text-teal-400 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 border border-teal-500/30">
              <CheckCircle className="h-5 w-5" />
              Ready!
            </div>
          </>
        )}
      </div>
    </div>
  )
}
