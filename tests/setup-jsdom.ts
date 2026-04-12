/**
 * Vitest setup for jsdom-environment tests (component tests).
 *
 * Imports the jest-dom custom matchers (`toBeInTheDocument`, `toBeDisabled`,
 * `toHaveTextContent`, etc.) and registers them with Vitest's `expect`.
 *
 * Loaded only by tests that opt into the jsdom environment via the
 * `// @vitest-environment jsdom` file directive — node-environment tests
 * skip this entirely.
 */
import '@testing-library/jest-dom/vitest';

/**
 * Polyfill matchMedia for jsdom (not implemented natively).
 * Defaults to desktop (min-width queries match, max-width don't).
 * Individual tests can override via vi.spyOn or Object.defineProperty.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
	window.matchMedia = (query: string): MediaQueryList => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false
	});
}
