'use client'

import { useState, useRef, useEffect } from 'react'

interface Detection {
  label: string
  confidence: number
  bbox: { x: number, y: number, width: number, height: number }
}

interface LogEntry {
  id: string
  label: string
  confidence: number
  timestamp: string
}

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function SafetyPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [detections, setDetections] = useState<Detection[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  // Start webcam
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 } } 
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // Required for iOS
          videoRef.current.play()
          setIsCameraActive(true)
        }
      } catch (err) {
        console.error("Camera access denied or unvailable", err)
      }
    }
    startCamera()

    return () => {
      // Cleanup on unmount
      if (videoRef.current && videoRef.current.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream
         stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // Poll API for YOLO detection stub
  useEffect(() => {
    if (!isCameraActive || !isScanning) {
      setDetections([])
      return
    }

    const captureAndDetect = async () => {
      if (!videoRef.current || videoRef.current.videoWidth === 0) return
      
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0)
      
      const frameData = canvas.toDataURL('image/jpeg', 0.6)
      const frameBase64 = frameData.split(',')[1]

      try {
        const res = await fetch('/api/safety/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frame: frameBase64 })
        })
        
        if (!res.ok) return
        const data = await res.json()
        setDetections(data.detections)
        
        if (data.detections.length > 0) {
           setLogs(prev => {
              const newLogs = data.detections.map((d: Detection) => ({
                 id: Math.random().toString(),
                 label: d.label,
                 confidence: d.confidence,
                 timestamp: data.timestamp
              }))
              return [...newLogs, ...prev].slice(0, 8)
           })
        }
      } catch(e) {
        console.error("YOLO Fetch error", e)
      }
    }

    // Call immediately, then every 2s
    captureAndDetect()
    const intervalId = setInterval(captureAndDetect, 2000)

    return () => clearInterval(intervalId)
  }, [isCameraActive, isScanning])

  return (
    <div className="min-h-screen bg-background pb-24">
      
      {/* Header */}
      <header className="bg-indigo-700 md:bg-transparent sticky md:relative top-0 z-40 shadow-lg md:shadow-none shadow-indigo-900/20">
        <div className="flex justify-between items-center px-6 md:px-8 py-4">
          <div>
            <h1 className="font-headline font-bold text-xl text-white md:text-on-surface">Site Safety</h1>
            <p className="text-indigo-200 md:text-on-surface-variant text-xs">Powered by Duality AI Falcon</p>
          </div>
          <button 
            onClick={() => setIsScanning(!isScanning)}
            disabled={!isCameraActive}
            className={`px-4 py-2 rounded-full font-label font-bold text-[11px] uppercase tracking-wider transition-all
              ${isScanning ? 'bg-error text-white animate-pulse' : 'bg-primary text-white'}`}
            style={isScanning ? { boxShadow: '0 0 15px rgba(220,38,38,0.5)' } : {}}
          >
            {isScanning ? 'Live Scanning...' : 'Start Feed'}
          </button>
        </div>
      </header>

      <main className="px-6 max-w-2xl mx-auto mt-6 space-y-6">
        
        {/* Viewport Box */}
        <section className="relative w-full aspect-[4/3] bg-black rounded-3xl overflow-hidden border-2 border-outline-variant/30 shadow-2xl">
          {/* Hardware Camera */}
          <video 
            ref={videoRef} 
            className="absolute inset-0 w-full h-full object-cover" 
            playsInline 
            muted 
          />
          
          {/* Overlay Grid */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none" />
          
          {/* Loading state */}
          {!isCameraActive && (
            <div className="absolute inset-x-0 bottom-1/2 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-white/50 text-4xl mb-2 animate-bounce">videocam</span>
              <p className="text-white/60 font-headline font-bold text-sm">Initializing Camera Feed...</p>
            </div>
          )}

          {/* Duality Falcon Logo watermark */}
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-label font-black text-white/80 uppercase tracking-widest leading-none">Falcon Synthetic Engine</span>
          </div>

          {/* Render Bounding Boxes */}
          {detections.map((d, i) => {
            const isHelmet = d.label === 'helmet';
            const color = isHelmet ? '#22c55e' : d.label === 'no_helmet' ? '#ef4444' : '#3b82f6';
            const bgColor = isHelmet ? 'rgba(34,197,94,0.1)' : d.label === 'no_helmet' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)';

            return (
              <div
                key={i}
                className="absolute border-2 transition-all duration-300"
                style={{
                  left: `${d.bbox.x}%`,
                  top: `${d.bbox.y}%`,
                  width: `${d.bbox.width}%`,
                  height: `${d.bbox.height}%`,
                  borderColor: color,
                  backgroundColor: bgColor,
                  boxShadow: `0 0 15px ${color}`
                }}
              >
                <div 
                  className="absolute -top-6 left-[-2px] px-2 py-0.5 text-[10px] font-bold text-white uppercase whitespace-nowrap"
                  style={{ backgroundColor: color }}
                >
                  {d.label} {(d.confidence * 100).toFixed(0)}%
                </div>
              </div>
            )
          })}
        </section>

        {/* Live Compliance Log Array */}
        <section>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-lg font-headline font-bold text-on-surface">Event Logs</h2>
            <span className="bg-surface-container-high px-2 py-1 rounded text-[10px] font-label font-bold text-outline uppercase tracking-wider">
              {logs.length} detected
            </span>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden divide-y divide-outline-variant/20 shadow-sm">
            {logs.length === 0 ? (
              <div className="p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-outline/30 mb-2">policy</span>
                <p className="text-outline text-sm font-medium">Feed scan idle.</p>
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="p-4 flex items-center justify-between bg-white animation-fade-in">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                      ${log.label === 'helmet' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      <span className="material-symbols-outlined text-[18px]">
                        {log.label === 'helmet' ? 'construction' : 'category'}
                      </span>
                    </div>
                    <div>
                      <p className="font-headline font-bold text-sm text-on-surface uppercase tracking-wide">
                        {log.label}
                      </p>
                      <p className="text-xs text-outline">{timeOnly(log.timestamp)}</p>
                    </div>
                  </div>
                  <span className="font-label font-bold text-[10px] bg-surface-container px-2 py-1 rounded text-on-surface-variant">
                    {Math.round(log.confidence * 100)}% CONF
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
      
      {/* Global styles injected for simple fade-in specific to logs */}
      <style dangerouslySetInnerHTML={{__html: `
        .animation-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  )
}
