<script lang="ts">
	import { goto } from '$app/navigation';

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});

			if (res.ok) {
				await goto('/', { replaceState: true });
			} else {
				const data = await res.json();
				error = data.error || 'Login failed';
			}
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div
	class="min-h-screen flex items-center justify-center bg-background px-4"
	style="padding-top: env(safe-area-inset-top, 0px);"
>
	<div class="w-full max-w-sm">
		<!-- Logo -->
		<div class="text-center mb-8">
			<div
				class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary text-2xl font-bold mb-4"
			>
				O
			</div>
			<h1 class="text-xl font-bold text-foreground">Oracle</h1>
			<p class="text-xs text-muted-foreground mt-1">Personal Operations System</p>
		</div>

		<!-- Login form -->
		<form onsubmit={handleSubmit} class="space-y-4">
			{#if error}
				<div class="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
					{error}
				</div>
			{/if}

			<div>
				<label for="username" class="block text-sm font-medium text-foreground mb-1.5">
					Username
				</label>
				<input
					id="username"
					type="text"
					bind:value={username}
					autocomplete="username"
					required
					class="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-foreground
						placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
					style="font-size: 16px;"
					placeholder="Enter username"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-foreground mb-1.5">
					Password
				</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					autocomplete="current-password"
					required
					class="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-foreground
						placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
					style="font-size: 16px;"
					placeholder="Enter password"
				/>
			</div>

			<button
				type="submit"
				disabled={loading || !username || !password}
				class="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold
					hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{loading ? 'Signing in...' : 'Sign in'}
			</button>
		</form>
	</div>
</div>
