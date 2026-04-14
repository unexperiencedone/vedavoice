/**
 * VoiceLog — persists every voice command attempt to localStorage.
 * Useful for debugging, demo replay, and showing supervisors their command history.
 */

export interface VoiceLogEntry {
  id: string
  ts: number
  transcript: string
  action: string | null
  name: string | null
  amount: number | null
  status: 'saved' | 'cancelled' | 'error'
}

const KEY = 'vedavoice_log'
const MAX_ENTRIES = 100

export function logVoiceEntry(entry: Omit<VoiceLogEntry, 'id' | 'ts'>) {
  try {
    const existing: VoiceLogEntry[] = getVoiceLog()
    const newEntry: VoiceLogEntry = {
      ...entry,
      id: Math.random().toString(36).slice(2),
      ts: Date.now()
    }
    const updated = [...existing, newEntry].slice(-MAX_ENTRIES)
    localStorage.setItem(KEY, JSON.stringify(updated))
  } catch { /* storage unavailable */ }
}

export function getVoiceLog(): VoiceLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function clearVoiceLog() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
