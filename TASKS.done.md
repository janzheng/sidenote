# SideNote — Completed Tasks

## 2026-03-25 — Refactoring Session (Bug Fixes + Architecture Cleanup)

- [x] [fixed: content script saves under cleaned URL, background now uses response.content.url for lookups] URL mismatch between content script and background causing "Failed to extract content" on Twitter
- [x] [done: cache-first lookup via loadData on tab switch, falls through to extraction only if no cached data] Tab switching shows error — now loads cached data instantly
- [x] [done: 3 retries with 500ms/1000ms backoff in handleContentExtraction] Content script not ready on tab switch — auto-retry instead of immediate failure
- [x] [done: .catch() added to handleDataMessage promise chain] Unhandled promise rejection in DataController message handler hangs UI
- [x] [done: per-URL save lock serializes concurrent writes] Race condition in concurrent DataController saves corrupts data
- [x] [done: DataController now imports shared normalizeUrl from contentId.ts] URL normalization mismatch between DataController and contentId.ts
- [x] [done: all 6 handlers converted to async/await, eliminated callback nesting] Promisify callback-based chrome APIs — fixes message port closures #phase1
- [x] [done: handler refs stored on class, removeListener called in cleanup()] Event listener leak in panelManager — listeners accumulate on open/close #phase2
- [x] [done: merged comprehensive param list into normalizeUrl, deleted cleanUrl from extractMetadata] Unify URL normalization — kill cleanUrl, single source of truth #phase3
- [x] [done: 480-line if-chain replaced with ~100-line dispatch map + statusHandler helper] Background message router — dispatch map with centralized error catching #phase4
- [x] [done: created socialMediaHelpers.ts + socialMediaBase.ts, both extraction files import shared code] Deduplicate social media extraction helpers #phase5

## Features (Shipped prior to tracking)

### Core

- [x] Content extraction — HTML, text, markdown via Turndown
- [x] Side panel UI — Svelte 5 with reactive state management
- [x] Data persistence — URL-scoped storage via DataController + chrome.storage
- [x] Auto-refresh on tab switch / URL change
- [x] Manual content input
- [x] Settings panel with API key management

### AI Features (Groq-powered)

- [x] AI Summary generation
- [x] AI Chat — conversational Q&A about page content
- [x] AI Summary + Chat hybrid
- [x] AI Research Paper extraction — section-by-section analysis
- [x] AI Recipe extraction
- [x] AI Text-to-Speech generation (text gen + audio gen pipeline)
- [x] AI ReAct Agent with tool use
- [x] Threadgirl processing

### Social Media

- [x] Twitter/X thread extraction with auto-scrolling
- [x] LinkedIn thread extraction with auto-scrolling + expansion
- [x] Social media markdown generation

### Documents & Citations

- [x] PDF extraction (via pdfjs-dist)
- [x] Citation generation — BibTeX, APA, Vancouver, Harvard
- [x] PDF-specific citation enhancement with AI
- [x] DOI/PMID/arXiv detection

### Maps

- [x] Google Maps data extraction (routes, places, search results)
- [x] Google Maps control commands (navigate, search, directions)
- [x] Maps + AI Chat integration

### Media & Assets

- [x] Page assets extraction (images, fonts, SVGs)
- [x] Jina pageshot / screenshot generation
- [x] Bookmarking to Google Sheets
- [x] Content structure parsing (heading tree)
