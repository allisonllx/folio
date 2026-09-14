# Folio Implementation Plan

> Execute the approved concept as a first local build. Backend discovery and storage are delegated independently under the executing-plans workflow; desktop integration and UI remain in the main task.

**Goal:** Make the user's installed skills browsable and give each skill a persistent place for personal lessons.

**Architecture:** Read-only local scanner, validated JSON store, isolated Electron UI.

**Tech stack:** Node, Electron, HTML/CSS/JavaScript; Playwright for desktop integration tests.

**Spec:** design.md

## Constraints

- Local data only; no publishing or automatic skill edits.
- Source folders are read-only.
- Actual files populate the library; no fake usage or quality metrics.
- One app supports browsing and menu-bar/shortcut reopening.

## Tasks

- [x] Catalog and store: create lib/catalog.cjs, lib/store.cjs and tests/backend.test.cjs. scanSkills(roots) returns skills and warnings; createStore(path) exposes read() and updateSkill(id, patch). Use temporary filesystem fixtures; run node --test tests/backend.test.cjs before and after implementation.
- [x] Desktop integration: main.cjs and preload.cjs expose catalog, update, clipboard and reveal operations. Deny new windows and navigation; use context isolation and sandboxing. Enforce known skill IDs for every source-related action.
- [x] Library interface: renderer/index.html, style.css, app.js implement shelves, search, favorites, detail dialog, source view, notes and manual reviews. Escape all imported text. Show empty/error states and scanner warnings.
- [x] Verification and delivery: tests/ui.cjs drives real Electron with fixture roots and temporary userData. Verify search, edit persistence and source rendering. Run npm test and npm run test:ui; package with npm run package; launch real app. Document use and limitations in README.md.
