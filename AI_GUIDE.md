# Binder – Coding AI Project Guide

## Project summary

**Binder** is a progressive web app for writing, publishing, discovering, and reading long-form books on Nostr.

A book is an ordered list of long-form chapter events.
Drafting is local-first.
Publishing and engagement use existing Nostr kinds only.

Do **not** invent new protocol concepts.

---

## Primary goals

1. Enable authors to write and manage multi-chapter books
2. Publish chapters and book structure deterministically to Nostr
3. Allow readers to read books comfortably, including offline
4. Support standard Nostr interactions: reactions, boosts, replies, zaps
5. Apply Web of Trust locally for discovery and moderation

---

## Non-goals

* No new Nostr kinds
* No backend services
* No DRM or enforced paywalls
* No global reputation system
* No collaborative editing in v1

---

## Technology constraints

* **Frontend**: SvelteKit + TypeScript
* **Deployment**: Static web app + PWA
* **Storage**: IndexedDB (Dexie or equivalent)
* **Nostr**: nostr-tools
* **Signing**: NIP-07 and NIP-46 only
* **Lightning**: NIP-57
* **Rendering**: Markdown-it with sanitisation

No server-side rendering dependencies beyond SvelteKit defaults.

---

## Core data model (must follow exactly)

### Chapter (published)

* **Kind**: 30023
* **Replaceable** by `d` tag
* **Required tags**:

  * `["d", "<chapter-id>"]`
  * `["title", "<chapter title>"]`
* **Recommended tags**:

  * `["published_at", "<unix timestamp>"]`
  * `["book", "<book-id>"]`
  * `["t", "<genre>"]`
* **Content**: markdown only

### Book (table of contents)

* **Kind**: 30003 (bookmark list)
* **Replaceable** by `d` tag
* **Required tags**:

  * `["d", "<book-id>"]`
  * `["title", "<book title>"]`
* **Recommended tags**:

  * `["summary", "<blurb>"]`
  * Ordered `a` tags referencing chapters
    Format:
    `["a", "30023:<pubkey>:<chapter-id>", "<order>"]`

Tag order and explicit order field must be preserved.

---

## Drafting model

* Drafts are **never published by default**
* Drafts are stored locally:

  * Markdown content
  * Metadata
  * Chapter ID
  * Version snapshots
* Autosave required
* Drafts can be promoted to published chapters

No encrypted draft publishing in v1.

---

## Publishing workflow (strict)

1. Validate chapter metadata and IDs
2. Publish or update all chapters first
3. Publish or update book list last
4. Confirm relay acknowledgement
5. Handle retries idempotently

Never publish a book that references unpublished chapters.

---

## Reading requirements

* Book view:

  * Title, summary, author
  * Ordered table of contents
* Chapter view:

  * Clean typography
  * Reading progress tracking
  * Resume last position
* Offline support:

  * Cache book list
  * Cache chapters
  * Cache referenced images

Offline reading must work once content is fetched.

---

## Social features (standard Nostr only)

* Reactions: kind 7
* Boosts: kind 6
* Replies: kind 1 referencing chapter via `a` tag
* Zaps: NIP-57
* Follows: kind 3
* Mutes/blocks: NIP-51

Do not wrap or re-interpret these events.

---

## Web of Trust (WoT)

### Scope

Client-side only. Advisory only. Fully optional.

### Inputs

* Follow graph
* Mute/block lists
* Engagement signals

### Uses

* Feed ranking
* Discovery shelves
* Collapsing low-trust replies
* Soft trust warnings

Never block publishing or reading based on WoT.

---

## Application structure (recommended)

### Core modules

* Auth and signer abstraction
* Relay manager
* Draft manager
* Publisher
* Book resolver
* Markdown renderer
* Offline cache manager
* WoT engine (isolated module)

### UI views

* Login
* Writer dashboard
* Markdown editor
* Book builder
* Book page
* Chapter reader
* Personal library
* Settings

---

## PWA requirements

* Installable
* Service worker caching
* Background sync for publishing queue
* Graceful offline handling

---

## Error handling requirements

* Network failures must not lose drafts
* Publishing must be retryable
* Conflicting replaceable events must surface warnings
* Relay failures must degrade gracefully

---

## MVP acceptance criteria

The project is considered successful when:

* A user can write a multi-chapter book
* Publish it to public relays
* Update chapters without breaking the book
* Read the entire book offline
* Receive likes, boosts, replies, and zaps
* See discovery influenced by their trust network

All without protocol changes.

---

## Instructions to the coding AI

* Prefer clarity over abstraction
* Do not optimise prematurely
* Follow the data model exactly
* Flag ambiguities rather than guessing
* Keep WoT logic transparent and configurable
* Treat Nostr events as immutable facts

If a design choice is unclear, stop and ask.
