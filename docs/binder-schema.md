# Binder Book Schema

This document formalizes how Binder represents books, chapters, and related metadata on Nostr. Use it as a reference when consuming Binder content or building compatible clients.

## Book Event (kind `30003`)

- **`d` tag**: Unique book identifier (e.g., `book-the-book-386682be`). Binder generates this when a book is created.
- **`title` tag**: Human-readable title of the book.
- **`summary` tag** *(optional)*: Description or synopsis.
- **`cover` tag** *(optional)*: URL to the cover image (Binder uploads covers to media servers and references the resulting URL).
- **`a` tags**: Each chapter reference uses `['a', '30023:<author-pubkey>:<chapter-d>', '<index>']` to preserve order explicitly. The `<index>` is the zero-based serial position of the chapter.
- **Content body** is usually set to the summary text or kept empty if unnecessary.
- **`created_at`** and **`updated_at`** follow standard Nostr epoch timestamps.

Binder apps should publish a book event whenever chapters are added/reordered or metadata changes. To avoid redundant publishes, compare a stored checksum (e.g., a SHA-256 fingerprint of book metadata + order) before republishing.

## Chapter Event (kind `30023`)

- **`d` tag**: Unique chapter identifier (e.g., `chapter-01-abc123`).
- **`title` tag**: Chapter title.
- **`book` tag**: References the parent book `d` value.
- **`published_at` tag**: Timestamp of publication.
- **Event content** contains the Markdown payload with media links already uploaded.

Chapters are only re-published when content or chapter metadata changes; Binder computes fingerprints of the rendered Markdown to decide whether a re-publish is necessary.

## Supplementary Events

- **Schema announcement event** *(custom kind `30019` proposed)*: Publishes the schema text (this document) along with a version/hash so other clients can fetch and verify Binder’s expectations.
- **Annotations (kind `30014`)**: Used for inline comments or notes referencing `[ 'a', '30023:<pubkey>:<chapter-d>' ]` coordinate tags. The annotation content holds comment text, tags like `['thread', '<id>']`, and optionally moderation metadata.
- **Community reactions (kind `10002` or similar)**: Reactions to books/chapters can reuse the same coordinate structure in the `a` tag, enabling clients to aggregate likes/boosts/zaps. Binder typically stores counts locally for quick rendering.
- **Incremental diff marker (kind `30024` proposed)**: When metadata-only changes occur (e.g., only `summary` updates), Binder may publish a diff event containing `['type', 'metadata-update']`, `['book', book.d]`, and a checksum so other apps can request only the affected pieces.

## Consumption Notes

- Build clients to honor the `book` tag linking chapters to their parent book. Use the order embedded in the `a` tags to render the table of contents.
- When syncing, optionally fetch the latest schema announcement event to understand the current version of Binder’s conventions.
- To support responsiveness, cache book/chapter fingerprints locally and only re-request updates when a new checksum appears.

## Future Extensions

- Moderation tags (e.g., `['status', 'muted']`) can be attached to annotation events, enabling threaded moderation flows.
- Progress tracking events may use a dedicated kind (e.g., `30025`) and reference book/chapter coordinates with tags like `['progress', 'chapter-01']` and `['percent', '45']`.

Keep this doc updated whenever you extend Binder’s event model or react to new NIP proposals. Use `docs/` for versioned references and propagate the schema hash via published events when possible.
