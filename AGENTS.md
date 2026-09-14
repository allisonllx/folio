# Folio project context

Folio is a local macOS Electron app for browsing agent skills as books on shelves.

## Product intent
Help users rediscover installed capabilities. Work stays in Codex/Cursor; Folio is for browsing, remembering useful recipes and learning from skill usage. Keep private context local.

## Current implementation
- Read-only scanner for ~/.agents/skills, ~/.codex/skills, ~/.codex/plugins/cache, ~/.claude/skills.
- Editable keyword-based shelves, search, favorites, source viewing, copied starter prompts.
- Local notes and manually entered run reviews, stored in Electron userData/library.json.
- Menu-bar access and Control+Option+K while running.
- No runtime network requests, source skill modification, automatic conversation capture or GitHub publishing.

## Planned directions, not implemented
- Agent-triggered run capture/reviews, with iterations and lessons.
- Evidence-backed improvements for user-authored skills with reviewable diffs.
- Prepare-for-sharing workflow: identify private file dependencies, extract reusable method, document configurable inputs, test a public variant without leaking personal context.
- Preserve a shared method with private local configuration rather than divergent personal/public copies.

## Development
npm ci
npm start
npm test
npm run test:ui
npm run package

The UI test launches Electron using isolated temporary skill fixtures and data. Never mutate the user’s real skills for testing. Inspect README.md and docs/design.md for scope and limitations. main.cjs is the desktop entry, renderer/ the interface, and lib/ discovery and persistence.

## Known limitations
Plugin caches can include inactive skills. Category suggestions use keywords. IDs are based on canonical source paths, so moved/upgraded skills can lose their metadata association. Starter prompts copy to clipboard. Reviews are manual; output references are plain text. Packaged app is a local development build, not signed/notarized for public distribution.
