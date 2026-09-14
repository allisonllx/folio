# Evidence-based classification

Implemented locally in Folio; source skills and installer metadata remain read-only.

The catalog fingerprints every skill folder using Git tree semantics and attaches provenance from Skills CLI v3 records or local bundled Codex plugin sources. Manual relationship metadata is separate from evidence. Automatic is represented by missing relationship metadata or the explicit value `auto`; explicit `unclassified` suppresses automatic inference just like other manual labels.

A changed original never proves personal authorship. Mismatches become unclassified with a suggestion to review and mark adapted. Missing remote originals and unknown activation stay visibly unknown. No network lookup or cloud upload occurs. A bundled version mismatch cannot be called a user edit. Cache visibility is separate from local enabled/disabled settings.

Full-folder fingerprints replace SKILL.md-only duplicate grouping. Existing IDs still derive from canonical paths; moving a skill or plugin to a new path may break metadata association. A subsequent identity/migration feature should address this without treating multiple cached versions as the same active installation.

Verification includes Git-generated tree hashes with nested files, executable modes and symlinks; reference-only edits; updated installer records; missing and malformed metadata; name collisions outside tracked directories; same instructions with differing references; enabled/disabled/stale plugin caches; and manual override priority. The Electron fixture test covers automatic labels, source evidence, refresh after a reference change, manual-label retention and return to automatic mode.
