/**
 * Push notification subscription client.
 *
 * Manages Web Push subscriptions via Pennyworth's push API (proxied
 * through Oracle App's /api/push/* routes). Handles subscribe, unsubscribe,
 * and re-subscription on app launch (iOS subscriptions can silently expire).
 */

/** Check if push is supported and the app is installed as PWA */
export function isPushSupported(): boolean {
	if (typeof window === 'undefined') return false;
	// iOS Safari uses navigator.standalone (non-standard) instead of the
	// display-mode: standalone media query. Check both.
	const isStandalone =
		window.matchMedia('(display-mode: standalone)').matches ||
		(navigator as unknown as { standalone?: boolean }).standalone === true;
	return 'serviceWorker' in navigator && 'PushManager' in window && isStandalone;
}

/** Check if push permission has already been granted */
export function isPushGranted(): boolean {
	if (typeof window === 'undefined') return false;
	return 'Notification' in window && Notification.permission === 'granted';
}

/** Check if the user has dismissed the push prompt recently */
export function isPushPromptDismissed(): boolean {
	try {
		const dismissed = localStorage.getItem('oracle:push-prompt-dismissed');
		if (!dismissed) return false;
		const dismissedAt = parseInt(dismissed, 10);
		const thirtyDays = 30 * 24 * 60 * 60 * 1000;
		return Date.now() - dismissedAt < thirtyDays;
	} catch {
		return false;
	}
}

/** Record that the user dismissed the push prompt */
export function dismissPushPrompt(): void {
	try {
		localStorage.setItem('oracle:push-prompt-dismissed', String(Date.now()));
	} catch {
		// localStorage may be unavailable
	}
}

/** Convert a base64url VAPID key to Uint8Array for applicationServerKey */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; i++) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

/** Encode an ArrayBuffer to base64 string */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/** Get the VAPID public key from Pennyworth (via Oracle App proxy) */
async function getVapidKey(): Promise<string> {
	const res = await fetch('/api/push/vapid-public-key');
	if (!res.ok) throw new Error('Failed to get VAPID key');
	const { publicKey } = (await res.json()) as { publicKey: string };
	return publicKey;
}

/** Subscribe to push notifications */
export async function subscribePush(): Promise<PushSubscription> {
	const registration = await navigator.serviceWorker.ready;
	const vapidKey = await getVapidKey();

	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource
	});

	// Send subscription to Pennyworth via proxy
	const res = await fetch('/api/push/subscribe', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			endpoint: subscription.endpoint,
			keys: {
				p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
				auth: arrayBufferToBase64(subscription.getKey('auth')!)
			},
			userAgent: navigator.userAgent
		})
	});

	if (!res.ok) throw new Error('Failed to register subscription');
	return subscription;
}

/**
 * Re-subscribe if existing subscription is still valid.
 * Call on every app launch — iOS subscriptions can silently expire.
 */
export async function ensureSubscription(): Promise<void> {
	if (!isPushSupported() || !isPushGranted()) return;

	try {
		const registration = await navigator.serviceWorker.ready;
		const existing = await registration.pushManager.getSubscription();
		if (!existing) return; // User hasn't subscribed — don't auto-subscribe

		// Confirm subscription is still valid with server
		await fetch('/api/push/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				endpoint: existing.endpoint,
				keys: {
					p256dh: arrayBufferToBase64(existing.getKey('p256dh')!),
					auth: arrayBufferToBase64(existing.getKey('auth')!)
				}
			})
		});
	} catch (err) {
		console.warn('[push] ensureSubscription failed:', (err as Error).message);
	}
}
