import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Navbar } from './components/Navbar'
import { Sidebar } from './components/Sidebar'

// Import Pages
import Login from './pages/Login'
import WorkerDashboard from './pages/Worker/Dashboard'
import WorkerProfile from './pages/Worker/Profile'
import AdminDashboard from './pages/Admin/Dashboard'
import ManageWorkers from './pages/Admin/Workers'
import ManageShifts from './pages/Admin/Shifts'
import AttendanceLogs from './pages/Admin/Attendance'
import ReportsDashboard from './pages/Admin/Reports'
import AdminSettings from './pages/Admin/Settings'

// Layout wrapper for administrators containing navbar and side control panel
const AdminLayout = ({ children }) => (
  <div className="min-h-screen flex flex-col bg-slate-950">
    <Navbar />
    <div className="flex flex-1">
      <Sidebar />
      <main className="flex-1 bg-slate-950 overflow-y-auto">
        {children}
      </main>
    </div>
  </div>
)

// Layout wrapper for mobile worker logs
const WorkerLayout = ({ children }) => (
  <div className="min-h-screen flex flex-col bg-slate-950">
    <Navbar />
    <main className="flex-1 bg-slate-950 overflow-y-auto">
      {children}
    </main>
  </div>
)

// Root Redirector based on session
const RootRedirect = () => {
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Login */}
          <Route path="/login" element={<Login />} />

          {/* Worker Protected Routes */}
          <Route
            path="/worker"
            element={
              <ProtectedRoute allowedRoles={['worker']}>
                <WorkerLayout>
                  <WorkerDashboard />
                </WorkerLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/worker/profile"
            element={
              <ProtectedRoute allowedRoles={['worker']}>
                <WorkerLayout>
                  <WorkerProfile />
                </WorkerLayout>
              </ProtectedRoute>
            }
          />

          {/* Admin Protected Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/workers"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <ManageWorkers />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/shifts"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <ManageShifts />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/attendance"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AttendanceLogs />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <ReportsDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminSettings />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* Fallbacks */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}
