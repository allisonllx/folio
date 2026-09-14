# Folio: first working version

A local macOS desktop library for rediscovering installed agent skills and collecting personal evidence of their usefulness. The primary journey is browse → understand → copy a starter prompt → work in an agent → optionally record a lesson.

## Scope

Read installed SKILL.md files from the user's agent skill folders and Codex plugin cache. Never modify source skills. Display a cozy, readable bookshelf with stable suggested categories, search, favorites, and manual category overrides. A book opens to its description, exact source instructions, source locations, editable notes, and structured run reviews. Generated starter prompts explicitly ask the agent to use the selected local skill and provide space for the user's actual task. User additions persist in the app's local userData folder.

Support menu-bar access and Control+Option+K to show/hide the window; display registration failure rather than promise a working shortcut. Closing the window keeps the menu-bar app available; Quit terminates it. No automatic launch-at-login change.

The app does not capture agent conversations, score quality, alter instructions, or publish anything. Reviews are manually entered, and suggested shelves are keyword-based, editable classifications rather than semantic clustering. Similar identical copies collapse into one book, retaining locations; different versions remain separate.

## Architecture

Electron shell with sandboxed renderer, isolated context and a small preload API. A Node catalog module reads skill metadata. A local store validates and atomically saves favorites, categories, notes, and reviews. A vanilla HTML/CSS/JS renderer keeps the first build small and portable. No runtime network services or telemetry. Tests use temporary local fixtures and Electron UI automation; tests never modify installed skills.

## Verification

Test recursive discovery, duplicate handling, malformed metadata, classification, persistence and validation. Exercise actual Electron UI for search, source reading, favorites, notes, reviews, reload persistence and keyboard dismissal. Package a macOS app and open it against real installed skills.
