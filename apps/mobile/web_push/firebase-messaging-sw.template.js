// Web push service worker for app.brewistan.com.
// The release workflow fills in the __PLACEHOLDERS__ from GitHub variables.

// Tapping a notification opens the app on that cafe's card (?cafe=<id>).
// Registered before Firebase so it handles the click first.
self.addEventListener('notificationclick', (event) => {
  const msg = event.notification && event.notification.data && event.notification.data.FCM_MSG;
  const cafe = msg && msg.data && msg.data.cafeId;
  event.notification.close();
  event.stopImmediatePropagation();
  const url = new URL(cafe ? './?cafe=' + encodeURIComponent(cafe) : './', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('navigate' in client) { await client.navigate(url); return client.focus(); }
    }
    return clients.openWindow(url);
  })());
});

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '__FIREBASE_API_KEY__',
  projectId: '__FIREBASE_PROJECT_ID__',
  messagingSenderId: '__FIREBASE_SENDER_ID__',
  appId: '__FIREBASE_WEB_APP_ID__',
});
firebase.messaging();
