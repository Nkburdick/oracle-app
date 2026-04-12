#!/usr/bin/env bun
/**
 * migrate-frontmatter.ts
 *
 * One-time migration: walks all PROJECT.md and AREA.md files in the ORACLE
 * repo, extracts metadata from the existing `## Status` and `## Platform IDs`
 * sections, and PREPENDS YAML frontmatter that matches FRONTMATTER_SPEC.md.
 *
 * SAFE: This script does NOT delete or modify the existing markdown body. It
 * only adds frontmatter at the top of each file. Existing `## Status` and
 * `## Platform IDs` sections remain in place — they become redundant once
 * Oracle App reads frontmatter, but they don't break anything.
 *
 * Usage:
 *   bun run scripts/migrate-frontmatter.ts            # dry run, prints diff
 *   bun run scripts/migrate-frontmatter.ts --apply    # actually writes files
 *   bun run scripts/migrate-frontmatter.ts --sample   # only process 1 file
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';

const ORACLE_ROOT = join(process.env.HOME!, 'Code/ORACLE');
const PROJECTS_DIR = join(ORACLE_ROOT, 'Projects');
const AREAS_DIR = join(ORACLE_ROOT, 'Areas');

const APPLY = process.argv.includes('--apply');
const SAMPLE = process.argv.includes('--sample');

interface Frontmatter {
	title: string;
	state?: 'active' | 'planning' | 'paused' | 'complete';
	owner: string;
	created: string;
	sort_order: number;
	area?: string;
	target_date?: string;
	phase?: string;
	platform_ids?: Record<string, string>;
}

function findFiles(dir: string, fileName: string): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			const candidate = join(path, fileName);
			if (existsSync(candidate)) out.push(candidate);
		}
	}
	return out;
}

function alreadyHasFrontmatter(content: string): boolean {
	return content.startsWith('---\n');
}

function extractTitle(content: string): string {
	const m = content.match(/^# (.+)$/m);
	return m ? m[1].trim() : 'Untitled';
}

/**
 * Helper: extract a markdown section's body by finding the section header
 * and reading until the next `## ` header (or end of file).
 */
function extractSection(content: string, sectionHeader: string): string | null {
	const headerPattern = new RegExp(`^## ${sectionHeader}\\s*$`, 'm');
	const startMatch = content.match(headerPattern);
	if (!startMatch || startMatch.index === undefined) return null;
	const afterHeaderIdx = startMatch.index + startMatch[0].length;
	const remaining = content.slice(afterHeaderIdx);
	// Find the next ## section header (start of line)
	const nextSectionMatch = remaining.match(/\n## /);
	const block =
		nextSectionMatch && nextSectionMatch.index !== undefined
			? remaining.slice(0, nextSectionMatch.index)
			: remaining;
	return block;
}

/**
 * Find the `## Status` (project) or `## Type` (area) section and extract
 * bold key-value pairs:
 *   - **State:** Active
 *   - **Owner:** Nick Burdick
 *   - **Target Date:** TBD
 *   - **Created:** 2026-03-14
 */
function extractStatusFields(content: string): Record<string, string> {
	const out: Record<string, string> = {};
	// Try Status (projects) first, then Type (areas)
	const block = extractSection(content, 'Status') || extractSection(content, 'Type');
	if (!block) return out;
	const lineRe = /^- \*\*([^*]+):\*\*\s*(.+)$/gm;
	let m;
	while ((m = lineRe.exec(block)) !== null) {
		const key = m[1].trim().toLowerCase().replace(/\s+/g, '_');
		const value = m[2].trim();
		out[key] = value;
	}
	return out;
}

/**
 * Find the `## Platform IDs` section and parse the markdown table:
 *   | Platform | ID / Path |
 *   |----------|-----------|
 *   | Todoist | `6g9XRCp9Q6f7H5Mq` |
 *   | GitHub Repo | `Nkburdick/pennyworth` |
 */
function extractPlatformIds(content: string): Record<string, string> {
	const out: Record<string, string> = {};
	const block = extractSection(content, 'Platform IDs');
	if (!block) return out;
	const lines = block.split('\n');
	for (const line of lines) {
		// Skip header and divider rows
		if (line.includes('---')) continue;
		if (line.match(/\|\s*Platform\s*\|/i)) continue;
		if (!line.includes('|')) continue;
		// Parse cells
		const cells = line
			.split('|')
			.map((c) => c.trim())
			.filter((c) => c);
		if (cells.length < 2) continue;
		const platform = cells[0]
			.toLowerCase()
			.replace(/\s+/g, '_')
			.replace(/[^a-z0-9_]/g, '');
		// Strip ALL backticks and trailing parentheticals like " (Hostinger KVM 2)"
		let value = cells[1].replace(/`/g, '').trim();
		// If value has a parenthetical comment after the main value, extract just the first token
		// e.g., "31.220.21.243 (Hostinger KVM 2)" → "31.220.21.243"
		// But preserve full path-like values (e.g., "[01] Projects/Pennyworth")
		const parenSplit = value.match(/^([^\s(]+)\s*\(/);
		if (parenSplit && !value.startsWith('[')) {
			value = parenSplit[1];
		}
		// Filter out placeholder/empty values
		const placeholders = new Set(['TBD', 'N/A', 'n/a', 'tbd', 'None', 'none', '-', '']);
		if (platform && value && !placeholders.has(value)) {
			out[platform] = value;
		}
	}
	return out;
}

/**
 * Map a state string from the markdown to the canonical enum value.
 */
function normalizeState(raw: string | undefined): Frontmatter['state'] | undefined {
	if (!raw) return undefined;
	const lower = raw.toLowerCase().trim();
	if (lower.includes('active')) return 'active';
	if (lower.includes('planning')) return 'planning';
	if (lower.includes('paused') || lower.includes('on hold')) return 'paused';
	if (lower.includes('complete') || lower.includes('done')) return 'complete';
	return 'active'; // default fallback
}

/**
 * Try to extract an ISO date from a created field that may be free-form.
 */
function normalizeDate(raw: string | undefined): string | undefined {
	if (!raw) return undefined;
	const m = raw.match(/(\d{4}-\d{2}-\d{2})/);
	return m ? m[1] : undefined;
}

/**
 * Build the frontmatter object for a project file.
 */
function buildProjectFrontmatter(
	filePath: string,
	content: string,
	sortOrder: number
): Frontmatter {
	const slug = basename(dirname(filePath));
	const title = extractTitle(content);
	const status = extractStatusFields(content);
	const platformIds = extractPlatformIds(content);

	const fm: Frontmatter = {
		title,
		state: normalizeState(status.state) || 'active',
		owner: status.owner || 'Nick Burdick',
		created: normalizeDate(status.created) || '2026-01-01',
		sort_order: sortOrder
	};

	// Optional area field — try to extract from status, normalize to slug
	if (status.area && status.area !== 'TBD') {
		// Try to parse a markdown link like "[Alfred](../../Areas/alfred/AREA.md)"
		const linkMatch = status.area.match(/\(.*?\/Areas\/([^/]+)\/AREA\.md\)/);
		if (linkMatch) {
			fm.area = linkMatch[1];
		} else {
			// Fallback: lowercase + slugify the raw value (strips markdown link syntax)
			const rawText = status.area.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
			fm.area = rawText
				.toLowerCase()
				.trim()
				.replace(/\s+/g, '-')
				.replace(/[^a-z0-9-]/g, '');
		}
	}

	// Optional target_date
	const td = normalizeDate(status.target_date);
	if (td) fm.target_date = td;

	// Optional phase — only if it doesn't look like just a date
	if (status.phase && status.phase !== 'TBD') {
		fm.phase = status.phase;
	}

	if (Object.keys(platformIds).length > 0) {
		fm.platform_ids = platformIds;
	}

	return fm;
}

/**
 * Build the frontmatter object for an area file.
 * Areas don't have state/target_date/phase.
 */
function buildAreaFrontmatter(
	filePath: string,
	content: string,
	sortOrder: number
): Omit<Frontmatter, 'state' | 'target_date' | 'phase'> {
	const slug = basename(dirname(filePath));
	const title = extractTitle(content);
	const status = extractStatusFields(content);
	const platformIds = extractPlatformIds(content);

	const fm: Omit<Frontmatter, 'state' | 'target_date' | 'phase'> = {
		title,
		owner: status.owner || 'Nick Burdick',
		created: normalizeDate(status.created) || '2026-01-01',
		sort_order: sortOrder
	};

	if (Object.keys(platformIds).length > 0) {
		fm.platform_ids = platformIds;
	}

	return fm;
}

/**
 * Serialize a frontmatter object to YAML manually (avoiding deps).
 */
function serializeFrontmatter(fm: Record<string, any>): string {
	const lines: string[] = ['---'];
	for (const [key, value] of Object.entries(fm)) {
		if (value === undefined || value === null) continue;
		if (typeof value === 'object' && !Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const [k, v] of Object.entries(value)) {
				// Quote the value if it contains special chars
				const needsQuote =
					typeof v === 'string' &&
					(v.includes(':') ||
						v.includes('@') ||
						v.includes('#') ||
						v.includes('[') ||
						v.includes(']') ||
						v.startsWith('-'));
				const formatted = needsQuote ? `"${String(v).replace(/"/g, '\\"')}"` : v;
				lines.push(`  ${k}: ${formatted}`);
			}
		} else if (typeof value === 'string') {
			// Quote strings that have special chars
			const needsQuote =
				value.includes(':') || value.includes('#') || value.includes('—') || value.includes('"');
			const formatted = needsQuote ? `"${value.replace(/"/g, '\\"')}"` : value;
			lines.push(`${key}: ${formatted}`);
		} else {
			lines.push(`${key}: ${value}`);
		}
	}
	lines.push('---');
	return lines.join('\n');
}

interface MigrationResult {
	filePath: string;
	alreadyMigrated: boolean;
	frontmatter?: any;
	newContent?: string;
}

function migrateFile(
	filePath: string,
	type: 'project' | 'area',
	sortOrder: number
): MigrationResult {
	const content = readFileSync(filePath, 'utf-8');
	if (alreadyHasFrontmatter(content)) {
		return { filePath, alreadyMigrated: true };
	}
	const fm =
		type === 'project'
			? buildProjectFrontmatter(filePath, content, sortOrder)
			: buildAreaFrontmatter(filePath, content, sortOrder);
	const yaml = serializeFrontmatter(fm);
	const newContent = `${yaml}\n\n${content}`;
	return { filePath, alreadyMigrated: false, frontmatter: fm, newContent };
}

// ─── MAIN ───

const projectFiles = findFiles(PROJECTS_DIR, 'PROJECT.md').sort();
const areaFiles = findFiles(AREAS_DIR, 'AREA.md').sort();

console.log(`Found ${projectFiles.length} projects and ${areaFiles.length} areas`);
console.log(
	`Mode: ${APPLY ? 'APPLY (will write files)' : 'DRY RUN (no writes)'}${SAMPLE ? ' [SAMPLE: only 1 file]' : ''}`
);
console.log('');

const sampleSlice = SAMPLE ? 1 : Infinity;

const results: MigrationResult[] = [];

projectFiles.slice(0, sampleSlice).forEach((file, i) => {
	const sortOrder = (i + 1) * 100;
	const result = migrateFile(file, 'project', sortOrder);
	results.push(result);
});

areaFiles.slice(0, sampleSlice).forEach((file, i) => {
	const sortOrder = (i + 1) * 100;
	const result = migrateFile(file, 'area', sortOrder);
	results.push(result);
});

let migrated = 0;
let skipped = 0;

for (const result of results) {
	const relative = result.filePath.replace(ORACLE_ROOT + '/', '');
	if (result.alreadyMigrated) {
		console.log(`SKIP  ${relative} (already has frontmatter)`);
		skipped++;
		continue;
	}
	console.log(`${APPLY ? 'WRITE' : 'WOULD'} ${relative}`);
	if (!APPLY || SAMPLE) {
		console.log('  Frontmatter:');
		const yamlPreview = serializeFrontmatter(result.frontmatter)
			.split('\n')
			.map((l) => `    ${l}`)
			.join('\n');
		console.log(yamlPreview);
	}
	if (APPLY && result.newContent) {
		writeFileSync(result.filePath, result.newContent, 'utf-8');
	}
	migrated++;
}

console.log('');
console.log(`Done. ${migrated} ${APPLY ? 'migrated' : 'would be migrated'}, ${skipped} skipped.`);
