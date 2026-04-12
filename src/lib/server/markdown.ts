import matter from 'gray-matter';
import { Marked } from 'marked';
import { createHighlighter, type Highlighter } from 'shiki';
import type {
	ProjectFrontmatter,
	AreaFrontmatter,
	DoDItem,
	DoDStats,
	ProjectState
} from '$lib/types/oracle.js';

// Shiki highlighter — initialized lazily
let highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
	if (!highlighter) {
		highlighter = await createHighlighter({
			themes: ['github-dark-dimmed', 'github-light'],
			langs: [
				'typescript',
				'javascript',
				'svelte',
				'bash',
				'json',
				'yaml',
				'markdown',
				'css',
				'html'
			]
		});
	}
	return highlighter;
}

/** Parse frontmatter from a raw markdown file, returning typed frontmatter + body */
export function parseFrontmatter(
	raw: string,
	_slug: string
): { data: Record<string, unknown>; content: string } {
	const { data, content } = matter(raw);
	return { data, content };
}

/** Parse and normalize ProjectFrontmatter from gray-matter output */
export function normalizeProjectFrontmatter(
	data: Record<string, unknown>,
	slug: string
): ProjectFrontmatter {
	const validStates: ProjectState[] = ['active', 'planning', 'paused', 'complete'];
	const rawState = String(data.state ?? 'active');
	const state: ProjectState = validStates.includes(rawState as ProjectState)
		? (rawState as ProjectState)
		: 'active';

	return {
		slug,
		title: String(data.title ?? slug),
		state,
		sort_order: Number(data.sort_order ?? 999),
		area: data.area ? String(data.area) : undefined,
		owner: String(data.owner ?? ''),
		created: String(data.created ?? ''),
		target_date: data.target_date ? String(data.target_date) : undefined,
		phase: data.phase ? String(data.phase) : undefined,
		platform_ids:
			data.platform_ids && typeof data.platform_ids === 'object'
				? (data.platform_ids as Record<string, string>)
				: undefined,
		category: data.category ? String(data.category) : undefined
	};
}

/** Parse and normalize AreaFrontmatter from gray-matter output */
export function normalizeAreaFrontmatter(
	data: Record<string, unknown>,
	slug: string
): AreaFrontmatter {
	return {
		slug,
		title: String(data.title ?? slug),
		sort_order: Number(data.sort_order ?? 999),
		owner: String(data.owner ?? ''),
		created: String(data.created ?? ''),
		area: data.area ? String(data.area) : undefined,
		platform_ids:
			data.platform_ids && typeof data.platform_ids === 'object'
				? (data.platform_ids as Record<string, string>)
				: undefined,
		category: data.category ? String(data.category) : undefined
	};
}

/** Parse DoD checkboxes from markdown body */
export function parseDod(markdown: string): { dod: DoDItem[]; dodStats: DoDStats } {
	const lines = markdown.split('\n');
	const dod: DoDItem[] = [];
	let inDodSection = false;
	let currentSection: string | undefined;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Detect section headers
		if (/^#{1,6}\s/.test(line)) {
			const headerText = line.replace(/^#{1,6}\s+/, '').trim();
			// Enter DoD section on matching headers
			if (/definition of done|dod|^dod$/i.test(headerText)) {
				inDodSection = true;
				currentSection = undefined;
			} else if (inDodSection) {
				// Sub-section within DoD
				currentSection = headerText;
			}
			continue;
		}

		// Parse checkbox items
		if (inDodSection) {
			const checkedMatch = line.match(/^\s*-\s+\[x\]\s+(.+)$/i);
			const uncheckedMatch = line.match(/^\s*-\s+\[\s\]\s+(.+)$/);

			if (checkedMatch) {
				dod.push({
					text: checkedMatch[1].trim(),
					checked: true,
					section: currentSection,
					line: i + 1
				});
			} else if (uncheckedMatch) {
				dod.push({
					text: uncheckedMatch[1].trim(),
					checked: false,
					section: currentSection,
					line: i + 1
				});
			}
		}
	}

	const total = dod.length;
	const checked = dod.filter((d) => d.checked).length;
	const percent = total === 0 ? 0 : Math.round((checked / total) * 100);

	return { dod, dodStats: { checked, total, percent } };
}

/** Sort items by sort_order ASC, then alphabetically by slug */
export function sortByOrder<T extends { sort_order: number; slug: string }>(items: T[]): T[] {
	return [...items].sort((a, b) => {
		if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
		return a.slug.localeCompare(b.slug);
	});
}

/** Render markdown body to HTML with Shiki syntax highlighting */
export async function renderMarkdown(markdown: string, isDark = true): Promise<string> {
	const hl = await getHighlighter();
	const theme = isDark ? 'github-dark-dimmed' : 'github-light';

	const marked = new Marked();

	marked.use({
		renderer: {
			code({ text, lang }) {
				const language =
					lang &&
					hl.getLoadedLanguages().includes(lang as Parameters<typeof hl.codeToHtml>[1]['lang'])
						? lang
						: 'text';
				try {
					return hl.codeToHtml(text, {
						lang: language as Parameters<typeof hl.codeToHtml>[1]['lang'],
						theme
					});
				} catch {
					return `<pre><code>${text}</code></pre>`;
				}
			}
		}
	});

	// Enable GFM for task list items (checkboxes)
	marked.setOptions({ gfm: true });

	return marked.parse(markdown) as string;
}
