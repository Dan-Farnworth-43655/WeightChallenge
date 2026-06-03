import { useEffect, useState } from 'react'
import { pushSupported, registerServiceWorker, getPushSubscription, subscribePush, unsubscribePush } from '../utils/push'

export default function NotificationOptIn({ participantId }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'unsupported' | 'denied' | 'off' | 'on'
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!pushSupported()) { setStatus('unsupported'); return }
      await registerServiceWorker()
      if (cancelled) return
      if (Notification.permission === 'denied') { setStatus('denied'); return }
      const sub = await getPushSubscription()
      if (cancelled) return
      setStatus(sub ? 'on' : 'off')
    }
    init()
    return () => { cancelled = true }
  }, [])

  async function enable() {
    setBusy(true); setError(null)
    try {
      await subscribePush(participantId)
      setStatus('on')
    } catch (e) {
      setError(e.message)
      if (Notification.permission === 'denied') setStatus('denied')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true); setError(null)
    try {
      await unsubscribePush(participantId)
      setStatus('off')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') return null

  if (status === 'unsupported') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-500">
        🔕 Push notifications aren't supported on this browser.
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs">
        <p className="font-semibold text-slate-300">🔕 Notifications blocked</p>
        <p className="text-slate-500 mt-1">
          You denied notification permission. Enable it in your browser settings to get daily log reminders.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-200">
          {status === 'on' ? '🔔 Daily reminders are ON' : '🔔 Get a daily reminder'}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {status === 'on'
            ? "We'll nudge you each evening if you haven't logged."
            : 'A push notification at 8 PM CT if you forget to log.'}
        </p>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
      <button
        onClick={status === 'on' ? disable : enable}
        disabled={busy}
        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
          status === 'on'
            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            : 'bg-sky-500 hover:bg-sky-400 text-white'
        }`}
      >
        {busy ? '…' : status === 'on' ? 'Turn off' : 'Enable'}
      </button>
    </div>
  )
}
