/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

// Activate new service workers immediately — don't wait for all tabs to close.
// Critical for PWA: without this, iOS can serve stale cached JS for days.
self.skipWaiting();
clientsClaim();

// Workbox injects the precache manifest here at build time.
// This caches the app shell (HTML, CSS, JS, fonts) for fast startup.
// API requests are NOT cached — they always go to the network.
precacheAndRoute(self.__WB_MANIFEST);

// ─── Push Handler ──────────────────────────────────────────────────────────
// iOS REQUIRES showing a notification for every push event.
// Silent pushes will cause iOS to revoke push permission.

self.addEventListener('push', (event) => {
	const data = event.data?.json() ?? {};
	const options: NotificationOptions = {
		body: data.body ?? '',
		icon: '/icon-192.png',
		badge: '/icon-192.png',
		tag: data.tag ?? 'oracle-default',
		data: { url: data.url ?? '/' }
	};

	event.waitUntil(self.registration.showNotification(data.title ?? 'Oracle', options));
});

// ─── Notification Click ────────────────────────────────────────────────────
// Open or focus the app when the user taps a notification.

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = event.notification.data?.url ?? '/';

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			const existing = clients.find((c) => new URL(c.url).pathname === url);
			if (existing) return existing.focus();
			return self.clients.openWindow(url);
		})
	);
});
