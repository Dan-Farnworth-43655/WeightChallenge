// Service worker for Accountability Tracker PWA + push notifications.

// Receive push events from the server and show a notification.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = { title: 'Reminder', body: event.data?.text() ?? '' } }

  const title = data.title ?? 'Accountability Tracker'
  const body  = data.body  ?? "You haven't logged today!"
  const options = {
    body,
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    tag:   data.tag ?? 'log-reminder',
    data:  { url: data.url ?? '/' },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// When the user taps the notification, open or focus the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) { client.navigate(url); return client.focus() }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})

// No-op install/activate handlers — keep service worker lightweight.
self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
