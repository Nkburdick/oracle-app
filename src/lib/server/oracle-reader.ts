import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

/**
 * Whitelist of valid slug characters. Slugs must be lowercase alphanumerics,
 * hyphens, or underscores, starting with a letter or digit. This prevents
 * path traversal via `../` sequences or absolute paths from URL params.
 */
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;

function isSafeSlug(slug: string): boolean {
	return (
		typeof slug === 'string' && slug.length > 0 && slug.length < 256 && SAFE_SLUG_RE.test(slug)
	);
}

/**
 * Defense-in-depth: verify that a resolved file path is contained within
 * the given base directory. Returns true only if the file lives under base.
 */
function isPathInside(filePath: string, baseDir: string): boolean {
	const resolvedFile = resolve(filePath);
	const resolvedBase = resolve(baseDir);
	return resolvedFile === resolvedBase || resolvedFile.startsWith(resolvedBase + sep);
}
import {
	parseFrontmatter,
	normalizeProjectFrontmatter,
	normalizeAreaFrontmatter,
	parseDod,
	renderMarkdown,
	sortByOrder
} from './markdown.js';
import type {
	Project,
	ProjectDoc,
	Area,
	SidebarItem,
	DashboardCard
} from '$lib/types/oracle.js';
import type { Task, TasksFile } from '$lib/types/oracle-task.js';

const VALID_STATUSES = new Set(['backlog', 'ready', 'in_progress', 'review', 'done']);
const VALID_ASSIGNEES = new Set(['nick', 'alfred', 'pennyworth', 'forge']);

function isValidTask(t: unknown): t is Task {
	if (!t || typeof t !== 'object') return false;
	const r = t as Record<string, unknown>;
	return (
		typeof r.id === 'string' &&
		typeof r.content === 'string' &&
		(r.description === null || typeof r.description === 'string') &&
		typeof r.status === 'string' &&
		VALID_STATUSES.has(r.status) &&
		typeof r.assignee === 'string' &&
		VALID_ASSIGNEES.has(r.assignee) &&
		(r.phase === null || typeof r.phase === 'string') &&
		(r.section === null || typeof r.section === 'string') &&
		typeof r.sort_order === 'number' &&
		typeof r.created_at === 'string' &&
		typeof r.updated_at === 'string' &&
		r.sync !== null &&
		typeof r.sync === 'object'
	);
}

/** Resolve the root of the ORACLE data directory */
function getDataRoot(): string {
	const dataEnv = process.env.ORACLE_DATA_PATH;
	if (dataEnv) return resolve(dataEnv);
	// Default: one level up from cwd (assumes `node build/index.js` run from app/)
	return resolve(process.cwd(), '..');
}

function getProjectsDir(): string {
	return join(getDataRoot(), 'Projects');
}

function getAreasDir(): string {
	return join(getDataRoot(), 'Areas');
}

/** Build the GitHub edit URL for a file */
function githubEditUrl(type: 'Projects' | 'Areas', slug: string, filename: string): string {
	return `https://github.com/Nkburdick/ORACLE/edit/main/${type}/${slug}/${filename}`;
}

/** Read all project slugs from the filesystem */
async function listProjectSlugs(): Promise<string[]> {
	try {
		const entries = await readdir(getProjectsDir(), { withFileTypes: true });
		return entries.filter((e) => e.isDirectory()).map((e) => e.name);
	} catch {
		return [];
	}
}

/** Read all area slugs from the filesystem */
async function listAreaSlugs(): Promise<string[]> {
	try {
		const entries = await readdir(getAreasDir(), { withFileTypes: true });
		return entries.filter((e) => e.isDirectory()).map((e) => e.name);
	} catch {
		return [];
	}
}

/** Parse a single project from disk */
export async function readProject(slug: string): Promise<Project | null> {
	if (!isSafeSlug(slug)) return null;
	const projectsDir = getProjectsDir();
	const filePath = join(projectsDir, slug, 'PROJECT.md');
	if (!isPathInside(filePath, projectsDir)) return null;
	try {
		const raw = await readFile(filePath, 'utf-8');
		const { data, content } = parseFrontmatter(raw, slug);
		const frontmatter = normalizeProjectFrontmatter(data, slug);
		const { dod, dodStats } = parseDod(content);
		const bodyHtml = await renderMarkdown(content);
		return {
			frontmatter,
			bodyMarkdown: content,
			bodyHtml,
			dod,
			dodStats,
			filePath,
			githubEditUrl: githubEditUrl('Projects', slug, 'PROJECT.md')
		};
	} catch {
		return null;
	}
}

/**
 * Read a sibling project doc file (STATUS.md / DECISIONS.md) from disk.
 *
 * Returns null when the file doesn't exist — most projects haven't adopted
 * the 4-tier doc framework yet, so absence is the common case and not an error.
 *
 * Mirrors the security checks from readProject() so URL slugs can't traverse
 * out of the Projects directory.
 */
async function readProjectDoc(slug: string, filename: string): Promise<ProjectDoc | null> {
	if (!isSafeSlug(slug)) return null;
	const projectsDir = getProjectsDir();
	const filePath = join(projectsDir, slug, filename);
	if (!isPathInside(filePath, projectsDir)) return null;
	try {
		const raw = await readFile(filePath, 'utf-8');
		const bodyHtml = await renderMarkdown(raw);
		return {
			bodyMarkdown: raw,
			bodyHtml,
			filePath,
			githubEditUrl: githubEditUrl('Projects', slug, filename)
		};
	} catch {
		return null;
	}
}

/** Read STATUS.md for a project. Returns null when the file doesn't exist. */
export async function readProjectStatus(slug: string): Promise<ProjectDoc | null> {
	return readProjectDoc(slug, 'STATUS.md');
}

/** Read DECISIONS.md for a project. Returns null when the file doesn't exist. */
export async function readProjectDecisions(slug: string): Promise<ProjectDoc | null> {
	return readProjectDoc(slug, 'DECISIONS.md');
}

/** Parse a single area from disk */
export async function readArea(slug: string): Promise<Area | null> {
	if (!isSafeSlug(slug)) return null;
	const areasDir = getAreasDir();
	const filePath = join(areasDir, slug, 'AREA.md');
	if (!isPathInside(filePath, areasDir)) return null;
	try {
		const raw = await readFile(filePath, 'utf-8');
		const { data, content } = parseFrontmatter(raw, slug);
		const frontmatter = normalizeAreaFrontmatter(data, slug);
		const bodyHtml = await renderMarkdown(content);
		return {
			frontmatter,
			bodyMarkdown: content,
			bodyHtml,
			filePath,
			githubEditUrl: githubEditUrl('Areas', slug, 'AREA.md')
		};
	} catch {
		return null;
	}
}

/** Read all projects for the sidebar */
export async function readAllProjects(): Promise<SidebarItem[]> {
	const slugs = await listProjectSlugs();
	const items: SidebarItem[] = [];
	for (const slug of slugs) {
		const filePath = join(getProjectsDir(), slug, 'PROJECT.md');
		try {
			const raw = await readFile(filePath, 'utf-8');
			const { data } = parseFrontmatter(raw, slug);
			const fm = normalizeProjectFrontmatter(data, slug);
			items.push({
				slug: fm.slug,
				title: fm.title,
				state: fm.state,
				sort_order: fm.sort_order,
				subtitle: fm.phase
			});
		} catch {
			// skip unreadable files
		}
	}
	return sortByOrder(items);
}

/** Read all areas for the sidebar */
export async function readAllAreas(): Promise<SidebarItem[]> {
	const slugs = await listAreaSlugs();
	const items: SidebarItem[] = [];
	for (const slug of slugs) {
		const filePath = join(getAreasDir(), slug, 'AREA.md');
		try {
			const raw = await readFile(filePath, 'utf-8');
			const { data } = parseFrontmatter(raw, slug);
			const fm = normalizeAreaFrontmatter(data, slug);
			items.push({
				slug: fm.slug,
				title: fm.title,
				state: 'area',
				sort_order: fm.sort_order
			});
		} catch {
			// skip unreadable files
		}
	}
	return sortByOrder(items);
}

/** Read all projects for the dashboard */
export async function readDashboardCards(): Promise<DashboardCard[]> {
	const slugs = await listProjectSlugs();
	const cards: DashboardCard[] = [];
	for (const slug of slugs) {
		const filePath = join(getProjectsDir(), slug, 'PROJECT.md');
		try {
			const raw = await readFile(filePath, 'utf-8');
			const { data, content } = parseFrontmatter(raw, slug);
			const fm = normalizeProjectFrontmatter(data, slug);
			const { dodStats } = parseDod(content);
			cards.push({
				slug: fm.slug,
				title: fm.title,
				state: fm.state,
				sort_order: fm.sort_order,
				phase: fm.phase,
				dodStats
			});
		} catch {
			// skip
		}
	}
	return sortByOrder(cards);
}

/** Read tasks for a project from Projects/<slug>/tasks.json */
export async function readProjectTasks(slug: string): Promise<Task[]> {
	if (!isSafeSlug(slug)) return [];
	const projectsDir = getProjectsDir();
	const filePath = join(projectsDir, slug, 'tasks.json');
	if (!isPathInside(filePath, projectsDir)) return [];
	let raw: string;
	try {
		raw = await readFile(filePath, 'utf-8');
	} catch {
		return [];
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		console.warn(`[oracle-reader] tasks.json for "${slug}" is not valid JSON`);
		return [];
	}
	if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as TasksFile).tasks)) {
		console.warn(`[oracle-reader] tasks.json for "${slug}" missing "tasks" array`);
		return [];
	}
	const tasks: Task[] = [];
	for (const item of (parsed as TasksFile).tasks) {
		if (isValidTask(item)) {
			tasks.push(item);
		} else {
			console.warn(
				`[oracle-reader] skipping malformed task in "${slug}/tasks.json":`,
				JSON.stringify(item)
			);
		}
	}
	return tasks.sort((a, b) => a.sort_order - b.sort_order);
}

/** Get the data root path for the file watcher */
export { getDataRoot, getProjectsDir, getAreasDir };
