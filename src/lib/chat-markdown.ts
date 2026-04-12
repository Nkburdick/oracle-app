/**
 * Client-side markdown renderer for chat messages.
 *
 * Uses Marked (already a dependency) with GFM enabled. Code blocks get
 * CSS-only styling (no Shiki — that's server-side only and adds ~2MB WASM).
 * Syntax highlighting can be added as a progressive enhancement later.
 */

import { Marked } from 'marked';

const chatMarked = new Marked();

chatMarked.use({
	renderer: {
		code({ text, lang }) {
			const langAttr = lang ? ` data-lang="${lang}"` : '';
			const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			return `<pre class="chat-code-block"${langAttr}><code>${escaped}</code></pre>`;
		}
	}
});

chatMarked.setOptions({ gfm: true, breaks: true });

export function renderChatMarkdown(content: string): string {
	return chatMarked.parse(content) as string;
}
