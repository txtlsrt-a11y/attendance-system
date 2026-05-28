/**
 * Helper utilities to export logs to CSV and trigger browser print styling.
 */

export const exportToCSV = (data, filename = 'attendance_report.csv') => {
  if (!data || !data.length) return

  // Define headers based on data fields
  const headers = [
    'Date',
    'Worker ID',
    'Full Name',
    'Department',
    'Shift',
    'Punch Type',
    'Punch Time',
    'Status',
    'Latitude',
    'Longitude',
    'Selfie Photo URL'
  ]

  const csvRows = [headers.join(',')]

  data.forEach(row => {
    const values = [
      row.attendance_date || '',
      `"${row.profiles?.worker_id || ''}"`,
      `"${row.profiles?.full_name || ''}"`,
      `"${row.profiles?.department || ''}"`,
      `"${row.shifts?.shift_name || ''}"`,
      row.punch_type || '',
      row.punch_time ? new Date(row.punch_time).toLocaleTimeString() : '',
      row.status || '',
      row.latitude || 'Unavailable',
      row.longitude || 'Unavailable',
      row.selfie_url || ''
    ]
    csvRows.push(values.join(','))
  })

  const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n')
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const triggerPrint = (title = 'Report') => {
  const originalTitle = document.title
  document.title = `${title}_${new Date().toISOString().slice(0, 10)}`
  window.print()
  document.title = originalTitle
}
