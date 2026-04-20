import React, { useRef, useState } from 'react'
import { useVenues } from '../hooks/useVenues'
import { useAppStore } from '../store/appStore'

export default function FileUpload() {
  const { processFile, isProcessing, error } = useVenues()
  const { geocodingProgress } = useAppStore()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = (file) => {
    if (!file) return
    if (!file.name.match(/\.xlsx?$/i)) {
      alert('Please upload an .xlsx file')
      return
    }
    processFile(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const pct = geocodingProgress.total > 0
    ? Math.round((geocodingProgress.current / geocodingProgress.total) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <h1 className="text-2xl font-semibold text-gray-800 mb-1">Wolfsburg Activity Map</h1>
        <p className="text-sm text-gray-400 mb-8">Upload your dataset to begin</p>

        {!isProcessing ? (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 cursor-pointer transition-colors
                ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
            >
              <div className="text-4xl mb-3">📂</div>
              <p className="text-gray-600 font-medium">Drop your Excel file here</p>
              <p className="text-gray-400 text-sm mt-1">or click to browse</p>
              <p className="text-gray-300 text-xs mt-3">.xlsx files only</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
            {error && (
              <p className="mt-4 text-red-500 text-sm">{error}</p>
            )}
          </>
        ) : (
          <div className="py-4">
            <div className="text-gray-600 mb-4 font-medium">
              {geocodingProgress.total === 0
                ? 'Parsing Excel file…'
                : `Geocoding ${geocodingProgress.current} / ${geocodingProgress.total} addresses…`}
            </div>
            {geocodingProgress.total > 0 && (
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            <p className="text-gray-400 text-xs mt-3">
              This may take a minute — respecting Nominatim rate limits
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
