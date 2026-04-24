# Changelog

## Unreleased

### Fixed

- Chat composer is no longer hidden below the fold when opening a thread on iOS Safari PWA — replaced `h-[100dvh]` with `h-full` on the chat page root so the layout fits inside its actual slot rather than overflowing the parent containers.
- Composer stays visible and focusable after sending a message on iOS Safari PWA — replaced bare `focus()` calls with `focus({ preventScroll: true })` + `scrollIntoView({ block: 'end', behavior: 'instant' })` in both the thread page (`+page.svelte`) and the `ProjectChats` component.

### Added

- Playwright `mobile-webkit-iphone15pro` device project added to `playwright.config.ts` for mobile viewport testing.
- E2E tests `ISC-13` and `ISC-14` (`tests/e2e/chat-composer-viewport.spec.ts`) assert that the chat composer is visible on thread open and after send at iPhone 15 Pro viewport dimensions.
