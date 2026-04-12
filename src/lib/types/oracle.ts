/** Project state — drives the sidebar status indicator */
export type ProjectState = 'active' | 'planning' | 'paused' | 'complete';

/** Frontmatter shape — what we read from PROJECT.md / AREA.md YAML */
export interface ProjectFrontmatter {
	/** URL slug — derived from folder name, not stored in frontmatter */
	slug: string;
	/** Display title from frontmatter `title` or first H1 of body */
	title: string;
	/** Current state — defaults to 'active' if missing */
	state: ProjectState;
	/** Sort position in the sidebar — lower = higher in list. Defaults to 999. */
	sort_order: number;
	/** Linked area slug — clickable in metadata card. Optional. */
	area?: string;
	/** Owner display name */
	owner: string;
	/** ISO date when the project was created */
	created: string;
	/** ISO date target. Optional — only shown when set. */
	target_date?: string;
	/** Phase label like "Phase 3 — Oracle as App". Optional. */
	phase?: string;
	/** Platform IDs table — flexible key/value */
	platform_ids?: Record<string, string>;
	/** Reserved for Phase 2+ category grouping */
	category?: string;
}

/** Same shape for areas — areas use AREA.md but the structure mirrors projects */
export type AreaFrontmatter = Omit<ProjectFrontmatter, 'state' | 'target_date' | 'phase'>;

/** Definition of Done item — parsed from `## Definition of Done` section */
export interface DoDItem {
	text: string;
	checked: boolean;
	section?: string;
	line: number;
}

/** Aggregated DoD stats for the dashboard cards */
export interface DoDStats {
	checked: number;
	total: number;
	/** Integer 0-100 */
	percent: number;
}

/** Full parsed project — what the server load function returns */
export interface Project {
	frontmatter: ProjectFrontmatter;
	bodyMarkdown: string;
	bodyHtml: string;
	dod: DoDItem[];
	dodStats: DoDStats;
	filePath: string;
	githubEditUrl: string;
}

/** Same for areas */
export interface Area {
	frontmatter: AreaFrontmatter;
	bodyMarkdown: string;
	bodyHtml: string;
	filePath: string;
	githubEditUrl: string;
}

/** Sidebar list item */
export interface SidebarItem {
	slug: string;
	title: string;
	state: ProjectState | 'area';
	sort_order: number;
	subtitle?: string;
}

/** Dashboard card data */
export interface DashboardCard {
	slug: string;
	title: string;
	state: ProjectState;
	sort_order: number;
	phase?: string;
	dodStats: DoDStats;
}

/** SSE event payload */
export interface OracleEvent {
	type:
		| 'project-updated'
		| 'area-updated'
		| 'project-created'
		| 'area-created'
		| 'project-deleted'
		| 'area-deleted';
	slug: string;
	timestamp: string;
}
