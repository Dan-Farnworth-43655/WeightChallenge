// VAPID public key — safe to embed in frontend code. Used to identify our server
// when creating push subscriptions. Must match the server-side VAPID_PUBLIC_KEY.
const VAPID_PUBLIC_KEY = 'BF8vpBJuol2s6HzB-huD1nlrIcLyY1GGL4h-n_Gm5F1ZzLBUT1Te2LDIBJ9DumTnsvJFpASnUWIEwFYdfhfGEPI'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function registerServiceWorker() {
  if (!pushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    return reg
  } catch (e) {
    console.error('Service worker registration failed:', e)
    return null
  }
}

export async function getPushSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function subscribePush(participant) {
  if (!pushSupported()) throw new Error('Push notifications not supported on this device')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission denied')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }
  // Send the subscription to our backend
  const res = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participant, subscription: sub }),
  })
  if (!res.ok) throw new Error('Failed to save subscription')
  return sub
}

export async function unsubscribePush(participant) {
  const sub = await getPushSubscription()
  if (sub) await sub.unsubscribe()
  await fetch('/api/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participant }),
  })
}
