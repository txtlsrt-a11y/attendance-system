/**
 * Utility functions for date formatting, shift calculations, and attendance statuses.
 */

// Helper to format a time string (HH:MM:SS) into 12-hour AM/PM format
export const formatTime12h = (timeStr) => {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':')
  let hh = parseInt(hours, 10)
  const mm = minutes
  const ampm = hh >= 12 ? 'PM' : 'AM'
  hh = hh % 12
  hh = hh ? hh : 12 // the hour '0' should be '12'
  const hhStr = hh < 10 ? '0' + hh : hh
  return `${hhStr}:${mm} ${ampm}`
}

// Convert "HH:MM:SS" or "HH:MM" to minutes from start of day
export const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(':')
  return parseInt(h, 10) * 60 + parseInt(m, 10)
}

// Check if a punch-in is Late, Present, or Half-day
export const calculateAttendanceStatus = (punchTime, shiftStartTimeStr, graceMinutes = 15) => {
  if (!punchTime || !shiftStartTimeStr) return 'Present'

  const punch = new Date(punchTime)
  const punchMinutes = punch.getHours() * 60 + punch.getMinutes()
  
  const shiftStartMinutes = timeToMinutes(shiftStartTimeStr)
  
  // Difference in minutes between punch-in time and shift start time
  // positive means user punched after start time
  let diff = punchMinutes - shiftStartMinutes

  // Handle night shifts crossing midnight:
  // e.g. Shift starts at 21:00 (1260 mins). User punches at 20:50 (1250 mins) -> diff = -10 (Present)
  // User punches at 21:20 (1280 mins) -> diff = 20 (Late)
  // If shift starts at 21:00 and user punches at 01:00, diff = 60 - 1260 = -1200 mins.
  // In that case, we need to adjust since 01:00 is technically next day.
  if (diff < -720) {
    diff += 1440 // Adjust by a full day
  } else if (diff > 720) {
    diff -= 1440
  }

  if (diff <= graceMinutes) {
    return 'Present'
  } else if (diff <= 120) { // Up to 2 hours late
    return 'Late'
  } else {
    return 'Half Day'
  }
}

// Detect early exit on punch-out
export const detectEarlyExit = (punchTime, shiftEndTimeStr, earlyExitThresholdMins = 15) => {
  if (!punchTime || !shiftEndTimeStr) return false

  const punch = new Date(punchTime)
  const punchMinutes = punch.getHours() * 60 + punch.getMinutes()
  const shiftEndMinutes = timeToMinutes(shiftEndTimeStr)

  // diff is shiftEnd - punch. Positive means punch was before end time.
  let diff = shiftEndMinutes - punchMinutes

  // Adjust for crossing midnight:
  if (diff < -720) {
    diff += 1440
  } else if (diff > 720) {
    diff -= 1440
  }

  // If the user punched out earlier than the threshold, return true
  return diff > earlyExitThresholdMins
}

// Get standard date string (YYYY-MM-DD)
export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
