import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

// Suffix to map Worker IDs to emails for Supabase Auth compatibility
export const WORKER_EMAIL_SUFFIX = '@textile-attendance.com'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch profile for a given user ID
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, shifts(*)')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error.message)
        return null
      }
      return data;
    } catch (err) {
      console.error('Unexpected profile fetch error:', err)
      return null
    }
  }

  // Monitor auth state changes
  useEffect(() => {
    let subscription

    const initializeAuth = async () => {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
        const prof = await fetchProfile(session.user.id)
        setProfile(prof)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)

      // Listen for auth state changes
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        // Do NOT toggle loading to true here, as that would unmount the React router tree.
        // Instead, reactively update user and profile in the background.
        if (session?.user) {
          setUser(session.user)
          const prof = await fetchProfile(session.user.id)
          setProfile(prof)
        } else {
          setUser(null)
          setProfile(null)
        }
      })

      subscription = data.subscription
    }

    initializeAuth()

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [])

  // Manual Profile Refresh
  const refreshProfile = async () => {
    if (user) {
      const prof = await fetchProfile(user.id)
      setProfile(prof)
    }
  }

  // Sign In function (supports Email/Password for admins, and WorkerID/Password for workers)
  const signIn = async (identifier, password) => {
    let email = identifier.trim()
    
    // If it doesn't look like an email, assume it's a Worker ID and map it
    if (!email.includes('@')) {
      email = `${email.toLowerCase()}${WORKER_EMAIL_SUFFIX}`
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  // Sign Out function
  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    refreshProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
