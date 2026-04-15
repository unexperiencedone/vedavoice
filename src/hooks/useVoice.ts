'use client'

import { useState, useRef, useCallback } from 'react'

interface UseVoiceOptions {
  onResult: (transcript: string) => void
  onError?: (error: string) => void
}

export function useVoice({ onResult, onError }: UseVoiceOptions) {
  const [listening, setListening]     = useState(false)
  const [transcript, setTranscript]   = useState('')
  const recognitionRef                = useRef<SpeechRecognition | null>(null)

  const start = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      onError?.('Speech recognition is not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    // Allow Hindi + English mixed input
    recognition.lang          = 'en-IN'
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListening(true)
      setTranscript('')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const current = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('')
      setTranscript(current)

      // Fire onResult only on final result
      if (event.results[event.results.length - 1].isFinal) {
        onResult(current)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setListening(false)
      onError?.(event.error)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognition.start()
  }, [onResult, onError])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  // Text-to-speech confirmation
  const speak = useCallback((text: string, lang: string = 'en-US') => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang  = lang
    utterance.rate  = 0.95
    window.speechSynthesis.speak(utterance)
  }, [])

  return { listening, transcript, start, stop, speak }
}