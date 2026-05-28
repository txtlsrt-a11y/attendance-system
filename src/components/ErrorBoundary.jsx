import React, { Component } from 'react'
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo })
    console.error('ErrorBoundary captured a critical runtime crash:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  handleSignOut = () => {
    // Clear auth session values from storage and redirect
    localStorage.clear()
    sessionStorage.clear()
    window.location.href = '/login'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-slate-955 bg-weave-pattern flex items-center justify-center p-4 text-slate-100 antialiased font-sans select-none">
          {/* Glowing backdrops */}
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-rose-500/5 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 backdrop-blur-xl relative z-10 space-y-6">
            
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-3.5">
              <div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-lg text-rose-500 animate-pulse">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h1 className="text-lg font-black text-white uppercase tracking-tight">
                  Critical Terminal Error
                </h1>
                <p className="text-xs text-slate-400">
                  The Textile Attendance system encountered an unexpected application crash.
                </p>
              </div>
            </div>

            {/* Instruction Warning Box */}
            <div className="bg-rose-500/5 border border-rose-500/15 rounded-2xl p-4 text-xs leading-relaxed text-rose-350">
              <p className="font-bold text-[10px] uppercase tracking-wider text-rose-400">Instructions for Workers:</p>
              <p className="mt-1 font-medium">
                If this error happens while punching your shift IN or OUT, please do not worry. Report this screen immediately to your **Shift Supervisor** or the **Factory IT Helpdesk**.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black uppercase py-3 px-5 rounded-xl text-xs flex items-center justify-center gap-2.5 shadow-lg shadow-teal-500/5 transition duration-200 active:scale-[0.98]"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Current Session
              </button>

              <button
                type="button"
                onClick={this.handleSignOut}
                className="bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-350 hover:text-white font-bold uppercase py-3 px-5 rounded-xl text-xs flex items-center justify-center gap-2.5 transition duration-200 active:scale-[0.98]"
              >
                <LogOut className="h-4 w-4 text-slate-550" />
                Force Logout & Clear
              </button>
            </div>

            {/* Technician Collapsible Debug Info */}
            {this.state.error && (
              <details className="group border border-slate-800 rounded-2xl bg-slate-950 overflow-hidden transition-all duration-200">
                <summary className="flex items-center justify-between p-3.5 text-[10px] font-black uppercase text-slate-500 tracking-wider cursor-pointer list-none select-none hover:bg-slate-900/60 transition">
                  <span>System Diagnostics Details</span>
                  <span className="text-[9px] text-teal-405 transition group-open:rotate-180 font-mono">▼</span>
                </summary>
                <div className="p-4 border-t border-slate-850/60 font-mono text-[9px] text-slate-400 space-y-3 select-text overflow-x-auto leading-normal">
                  <div className="font-bold text-rose-450 border-b border-slate-900 pb-2">
                    Exception: {this.state.error.toString()}
                  </div>
                  {this.state.errorInfo && (
                    <pre className="whitespace-pre-wrap select-all font-medium leading-relaxed max-h-40 overflow-y-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

          </div>
        </div>
      )
    }

    return this.props.children
  }
}
