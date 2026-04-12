import type { RequestHandler } from './$types.js';
import { watch } from 'chokidar';
import { join } from 'node:path';
import { getDataRoot } from '$lib/server/oracle-reader.js';
import type { OracleEvent } from '$lib/types/oracle.js';

// Global set of active SSE clients
const clients = new Set<ReadableStreamDefaultController>();

// Initialize file watcher once (module-level singleton)
let watcherInitialized = false;

function initWatcher() {
	if (watcherInitialized) return;
	watcherInitialized = true;

	const dataRoot = getDataRoot();
	const projectsGlob = join(dataRoot, 'Projects', '**', '*.md');
	const areasGlob = join(dataRoot, 'Areas', '**', '*.md');

	const watcher = watch([projectsGlob, areasGlob], {
		persistent: true,
		ignoreInitial: true,
		awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
	});

	function broadcast(event: OracleEvent) {
		const data = `data: ${JSON.stringify(event)}\n\n`;
		const encoder = new TextEncoder();
		for (const ctrl of clients) {
			try {
				ctrl.enqueue(encoder.encode(data));
			} catch {
				clients.delete(ctrl);
			}
		}
	}

	function slugFromPath(filePath: string): string {
		// Extract slug from path: .../Projects/{slug}/PROJECT.md → slug
		const parts = filePath.split(/[/\\]/);
		const mdIndex = parts.findIndex((p) => p === 'Projects' || p === 'Areas');
		return mdIndex >= 0 ? parts[mdIndex + 1] : 'unknown';
	}

	watcher.on('change', (filePath: string) => {
		const isProject = filePath.includes('Projects');
		const slug = slugFromPath(filePath);
		broadcast({
			type: isProject ? 'project-updated' : 'area-updated',
			slug,
			timestamp: new Date().toISOString()
		});
	});

	watcher.on('add', (filePath: string) => {
		const isProject = filePath.includes('Projects');
		const slug = slugFromPath(filePath);
		broadcast({
			type: isProject ? 'project-created' : 'area-created',
			slug,
			timestamp: new Date().toISOString()
		});
	});

	watcher.on('unlink', (filePath: string) => {
		const isProject = filePath.includes('Projects');
		const slug = slugFromPath(filePath);
		broadcast({
			type: isProject ? 'project-deleted' : 'area-deleted',
			slug,
			timestamp: new Date().toISOString()
		});
	});
}

export const GET: RequestHandler = ({ request }) => {
	initWatcher();

	const encoder = new TextEncoder();
	let controller: ReadableStreamDefaultController | null = null;

	const stream = new ReadableStream({
		start(ctrl) {
			controller = ctrl;
			clients.add(ctrl);
			// Send initial keepalive
			ctrl.enqueue(encoder.encode(': connected\n\n'));
		},
		cancel() {
			if (controller) clients.delete(controller);
		}
	});

	// Keepalive ping every 30s
	const interval = setInterval(() => {
		if (controller) {
			try {
				controller.enqueue(encoder.encode(': ping\n\n'));
			} catch {
				clearInterval(interval);
				if (controller) clients.delete(controller);
			}
		}
	}, 30000);

	// Clean up on connection close
	request.signal.addEventListener('abort', () => {
		clearInterval(interval);
		if (controller) clients.delete(controller);
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
