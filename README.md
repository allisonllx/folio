# Folio

A small, local macOS bookshelf for agent skills. Browse what is on your machine, copy a starter prompt into your agent, and keep personal notes and run reviews beside each skill.

## Open

Open `release/Folio-darwin-arm64/Folio.app`. This build targets Apple Silicon Macs. Keep it in the Dock if useful, or move the app to your Applications folder yourself.

- **Control + Option + K:** show/hide Folio while it is running.
- **Command + K:** focus search inside Folio.
- **Menu-bar book icon:** open the library.
- Closing the window keeps the app running. **Folio → Quit** stops it.
- Launch at login is not changed automatically.

## Use

1. Browse a shelf or search names, descriptions, shelves and saved notes.
2. Open a book to read its description and exact instructions.
3. Copy a starter prompt, paste it in Codex or another agent on this Mac, and replace the task placeholder.
4. Bookmark the skill or change its shelf. Save personal notes separately from the original skill.
5. After useful work, add a manual run review: intention, iterations, lesson and output/session reference.

## Local data and sources

Reads `~/.agents/skills`, `~/.codex/skills`, `~/.codex/plugins/cache` and `~/.claude/skills`. It neither executes nor edits skill instructions. Identical file contents collapse into a book with multiple locations; differing versions remain separate.

The plugin cache can include inactive versions. Folio does not verify agent activation. “Personal” identifies a folder location, not authorship. Suggested shelves use keyword rules and are editable. No AI services, runtime network requests or telemetry are used.

User metadata is saved in `~/Library/Application Support/Folio/library.json`. Library details shows the actual path. Back up that file to preserve your notes. IDs currently derive from the canonical source path: moving a skill or upgrading a plugin into a different path may make its old notes inaccessible in the UI; the original metadata remains in the JSON file.

## First-version boundaries

- Reviews are manual; there is no automatic Codex/Cursor session capture.
- The starter prompt is copied, not automatically sent to an agent.
- Output references are stored as text, not uploaded or previewed.
- No skill quality scores, automatic skill edits, portability audit or GitHub publishing yet.
- Custom scan roots and semantic clustering are future work.
- This is a locally packaged development app, not a signed/notarized public release.

## Develop

Requires Node.js and npm. Run `npm ci`, then `npm start`.

`npm test` runs filesystem fixture tests for scanning, duplicate handling, YAML metadata and durable storage. `npm run test:ui` launches Electron against temporary fixture roots and data to test browsing, escaped source display, favorites, notes, reviews and reload persistence. `npm run package` creates the Apple Silicon macOS app.

The renderer is sandboxed with context isolation. Its narrow preload API provides catalog reads, validated metadata writes, clipboard copying and revealing known skill paths. New windows and navigation are blocked. Imported text is escaped and never interpreted as executable HTML.

## Files

- `main.cjs`, `preload.cjs`: desktop lifecycle, shortcuts, menu bar and IPC.
- `lib/catalog.cjs`: read-only discovery and metadata parsing.
- `lib/store.cjs`: validated, serialized, atomic metadata storage.
- `renderer/`: bookshelf and review interface.
- `tests/`: backend fixtures and Electron integration test.
- `docs/`: agreed first-build scope and implementation checklist.
