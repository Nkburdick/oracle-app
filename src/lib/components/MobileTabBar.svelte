<script lang="ts">
	import { page } from '$app/stores';
	import { LayoutDashboard, FolderOpen, BookOpen, Settings } from 'lucide-svelte';

	const currentPath = $derived($page.url.pathname);

	const tabs = [
		{ href: '/', label: 'Dashboard', icon: LayoutDashboard, testid: 'mobile-tab-dashboard' },
		{ href: '/projects', label: 'Projects', icon: FolderOpen, testid: 'mobile-tab-projects' },
		{ href: '/areas', label: 'Areas', icon: BookOpen, testid: 'mobile-tab-areas' },
		{ href: '/settings', label: 'Settings', icon: Settings, testid: 'mobile-tab-settings' }
	] as const;

	function isActive(href: string) {
		if (href === '/') return currentPath === '/';
		return currentPath.startsWith(href);
	}
</script>

<nav
	class="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-card"
	style="padding-bottom: env(safe-area-inset-bottom, 0px);"
	aria-label="Mobile navigation"
>
	{#each tabs as tab}
		<a
			href={tab.href}
			class="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors
				{isActive(tab.href) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}"
			data-testid={tab.testid}
		>
			<tab.icon size={20} />
			<span>{tab.label}</span>
		</a>
	{/each}
</nav>
