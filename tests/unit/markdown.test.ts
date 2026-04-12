import { describe, it, expect } from 'vitest';
import {
	parseFrontmatter,
	normalizeProjectFrontmatter,
	normalizeAreaFrontmatter,
	parseDod,
	sortByOrder
} from '../../src/lib/server/markdown.js';

describe('parseFrontmatter', () => {
	it('parses frontmatter and body from markdown', () => {
		const raw = `---
title: Test Project
state: active
owner: Nick
created: 2026-01-01
sort_order: 100
---
# Body Content

Some text here.`;
		const { data, content } = parseFrontmatter(raw, 'test');
		expect(data.title).toBe('Test Project');
		expect(data.state).toBe('active');
		expect(content).toContain('# Body Content');
		expect(content).not.toContain('---');
	});

	it('handles missing frontmatter gracefully', () => {
		const raw = '# Just a heading\nSome content.';
		const { data, content } = parseFrontmatter(raw, 'test');
		expect(data).toEqual({});
		expect(content).toContain('# Just a heading');
	});
});

describe('normalizeProjectFrontmatter', () => {
	it('extracts all required fields', () => {
		const data = {
			title: 'Pennyworth',
			state: 'active',
			owner: 'Nick Burdick',
			created: '2026-03-16',
			sort_order: 100,
			area: 'alfred',
			target_date: '2026-06-30',
			phase: 'Phase 3'
		};
		const fm = normalizeProjectFrontmatter(data, 'pennyworth');
		expect(fm.slug).toBe('pennyworth');
		expect(fm.title).toBe('Pennyworth');
		expect(fm.state).toBe('active');
		expect(fm.sort_order).toBe(100);
		expect(fm.area).toBe('alfred');
		expect(fm.target_date).toBe('2026-06-30');
		expect(fm.phase).toBe('Phase 3');
	});

	it('applies defaults for missing fields', () => {
		const fm = normalizeProjectFrontmatter({}, 'my-slug');
		expect(fm.slug).toBe('my-slug');
		expect(fm.title).toBe('my-slug');
		expect(fm.state).toBe('active');
		expect(fm.sort_order).toBe(999);
		expect(fm.area).toBeUndefined();
		expect(fm.target_date).toBeUndefined();
		expect(fm.phase).toBeUndefined();
	});

	it('normalizes invalid state to active', () => {
		const fm = normalizeProjectFrontmatter({ state: 'bogus' }, 'slug');
		expect(fm.state).toBe('active');
	});

	it('handles all valid states', () => {
		for (const s of ['active', 'planning', 'paused', 'complete'] as const) {
			const fm = normalizeProjectFrontmatter({ state: s }, 'slug');
			expect(fm.state).toBe(s);
		}
	});
});

describe('normalizeAreaFrontmatter', () => {
	it('extracts area fields without state/phase/target_date', () => {
		const data = { title: 'Alfred', owner: 'Nick', created: '2026-01-01', sort_order: 100 };
		const fm = normalizeAreaFrontmatter(data, 'alfred');
		expect(fm.slug).toBe('alfred');
		expect(fm.title).toBe('Alfred');
		expect(fm.sort_order).toBe(100);
		expect((fm as Record<string, unknown>).state).toBeUndefined();
	});

	it('defaults sort_order to 999', () => {
		const fm = normalizeAreaFrontmatter({}, 'slug');
		expect(fm.sort_order).toBe(999);
	});
});

describe('parseDod', () => {
	it('counts checked and unchecked DoD items', () => {
		const markdown = `
## Overview
Some text.

## Definition of Done
- [x] Item one
- [ ] Item two
- [x] Item three
- [ ] Item four
`;
		const { dod, dodStats } = parseDod(markdown);
		expect(dod.length).toBe(4);
		expect(dodStats.checked).toBe(2);
		expect(dodStats.total).toBe(4);
		expect(dodStats.percent).toBe(50);
	});

	it('returns zero stats for markdown with no DoD section', () => {
		const markdown = `# Project\nSome content without checkboxes.`;
		const { dod, dodStats } = parseDod(markdown);
		expect(dod.length).toBe(0);
		expect(dodStats.total).toBe(0);
		expect(dodStats.checked).toBe(0);
		expect(dodStats.percent).toBe(0);
	});

	it('handles 100% completion', () => {
		const markdown = `## Definition of Done\n- [x] Done\n- [X] Also done\n`;
		const { dodStats } = parseDod(markdown);
		expect(dodStats.percent).toBe(100);
		expect(dodStats.checked).toBe(dodStats.total);
	});

	it('handles 0% completion', () => {
		const markdown = `## Definition of Done\n- [ ] Not done\n- [ ] Also not done\n`;
		const { dodStats } = parseDod(markdown);
		expect(dodStats.percent).toBe(0);
		expect(dodStats.checked).toBe(0);
	});

	it('ignores checkboxes outside the DoD section', () => {
		const markdown = `
## Scope
- [x] Not a dod item

## Definition of Done
- [x] Real dod item
`;
		const { dod } = parseDod(markdown);
		expect(dod.length).toBe(1);
		expect(dod[0].text).toBe('Real dod item');
	});

	it('handles checkboxes with trailing whitespace', () => {
		const markdown = `## Definition of Done\n- [x] Item with trailing   \n- [ ] Another item  \n`;
		const { dod } = parseDod(markdown);
		expect(dod.length).toBe(2);
	});
});

describe('sortByOrder', () => {
	it('sorts items ascending by sort_order', () => {
		const items = [
			{ slug: 'c', sort_order: 300 },
			{ slug: 'a', sort_order: 100 },
			{ slug: 'b', sort_order: 200 }
		];
		const sorted = sortByOrder(items);
		expect(sorted.map((i) => i.slug)).toEqual(['a', 'b', 'c']);
	});

	it('defaults missing sort_order equivalent to 999 (appears at bottom)', () => {
		const items = [
			{ slug: 'b', sort_order: 999 },
			{ slug: 'a', sort_order: 100 }
		];
		const sorted = sortByOrder(items);
		expect(sorted[0].slug).toBe('a');
		expect(sorted[1].slug).toBe('b');
	});

	it('uses slug as tiebreaker for equal sort_order', () => {
		const items = [
			{ slug: 'z-project', sort_order: 100 },
			{ slug: 'a-project', sort_order: 100 }
		];
		const sorted = sortByOrder(items);
		expect(sorted[0].slug).toBe('a-project');
		expect(sorted[1].slug).toBe('z-project');
	});

	it('handles mixed explicit and default sort_order', () => {
		const items = [
			{ slug: 'no-order', sort_order: 999 },
			{ slug: 'first', sort_order: 100 },
			{ slug: 'second', sort_order: 200 }
		];
		const sorted = sortByOrder(items);
		expect(sorted[0].slug).toBe('first');
		expect(sorted[1].slug).toBe('second');
		expect(sorted[2].slug).toBe('no-order');
	});

	it('does not mutate the original array', () => {
		const items = [
			{ slug: 'b', sort_order: 200 },
			{ slug: 'a', sort_order: 100 }
		];
		sortByOrder(items);
		expect(items[0].slug).toBe('b');
	});
});
