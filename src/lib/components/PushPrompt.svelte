<!--
	Push Notification Permission Prompt.

	Shown after the first chat response when:
	- App is installed as PWA (standalone mode)
	- Push is supported (service worker + PushManager)
	- Permission hasn't been granted yet
	- User hasn't dismissed in last 30 days
-->
<script lang="ts">
	import { X } from 'lucide-svelte';
	import {
		isPushSupported,
		isPushGranted,
		isPushPromptDismissed,
		dismissPushPrompt,
		subscribePush
	} from '$lib/push.js';

	let visible = $state(false);
	let subscribing = $state(false);
	let error = $state<string | null>(null);

	/** Call this after the first chat response to trigger the prompt */
	export function show(): void {
		if (!isPushSupported() || isPushGranted() || isPushPromptDismissed()) return;
		visible = true;
	}

	async function handleEnable(): Promise<void> {
		subscribing = true;
		error = null;
		try {
			await subscribePush();
			visible = false;
		} catch (err) {
			error = (err as Error).message;
		} finally {
			subscribing = false;
		}
	}

	function handleDismiss(): void {
		dismissPushPrompt();
		visible = false;
	}
</script>

{#if visible}
	<div class="mx-3 mb-3 bg-card border border-border rounded-xl p-3 shadow-lg">
		<div class="flex items-start justify-between mb-1">
			<p class="text-xs font-semibold">Enable notifications</p>
			<button
				type="button"
				onclick={handleDismiss}
				class="text-muted-foreground hover:text-foreground p-0.5 -mr-1 -mt-0.5"
				aria-label="Dismiss"
			>
				<X size={14} />
			</button>
		</div>
		<p class="text-[11px] text-muted-foreground mb-2">
			Get notified when Alfred replies so you never miss a message.
		</p>
		{#if error}
			<p class="text-[11px] text-destructive mb-2">{error}</p>
		{/if}
		<div class="flex gap-2">
			<button
				type="button"
				onclick={handleEnable}
				disabled={subscribing}
				class="flex-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50"
			>
				{subscribing ? 'Enabling...' : 'Enable'}
			</button>
			<button
				type="button"
				onclick={handleDismiss}
				class="px-3 py-1.5 text-muted-foreground text-xs hover:text-foreground"
			>
				Not now
			</button>
		</div>
	</div>
{/if}
