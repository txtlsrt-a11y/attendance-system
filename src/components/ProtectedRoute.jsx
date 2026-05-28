import React, { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, profile, loading, signOut } = useAuth()

  useEffect(() => {
    if (user && profile && profile.login_enabled === false) {
      console.log('Session deactivated by admin. Enforcing logout...')
      signOut().catch(err => console.error('Signout error:', err))
    }
  }, [user, profile, signOut])

  // Show loading spinner while checking auth session
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-700 border-t-teal-500"></div>
          <div className="absolute text-xs font-semibold text-teal-400 uppercase tracking-widest animate-pulse">
            Loom
          </div>
        </div>
      </div>
    )
  }

  // Redirect to login if user session is absent or account is deactivated
  if (!user || (profile && profile.login_enabled === false)) {
    return <Navigate to="/login" replace />
  }

  // Check role restrictions
  if (allowedRoles && (!profile || !allowedRoles.includes(profile.role))) {
    // If worker tries to visit admin routes, redirect to worker dashboard
    if (profile?.role === 'worker') {
      return <Navigate to="/worker" replace />
    }
    // If admin tries to visit worker routes, redirect to admin dashboard
    if (profile?.role === 'admin') {
      return <Navigate to="/admin" replace />
    }
    // Fallback default redirect to login
    return <Navigate to="/login" replace />
  }

  return children
}
