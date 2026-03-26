# SideNote — Chrome Extension

## Current — Phase 3: Bug Hunt (merge pending)

50 bugs found and fixed across 6 worktree branches. Needs review + merge.

- [x] [done: 9 bugs fixed] Content extraction bug hunt `-> TASKS-CONTENT.md` #content-bugs
- [x] [done: 9 bugs fixed] PDF & citations bug hunt `-> TASKS-PDF.md` #pdf-bugs
- [x] [done: 7 bugs fixed, Unknown Author resolved] Twitter/X bug hunt `-> TASKS-TWITTER.md` #twitter-bugs
- [x] [done: 7 bugs fixed] LinkedIn bug hunt `-> TASKS-LINKEDIN.md` #linkedin-bugs
- [x] [done: 9 bugs fixed] Google Maps bug hunt `-> TASKS-MAPS.md` #maps-bugs
- [x] [done: 9 bugs fixed] AI features bug hunt `-> TASKS-AI.md` #ai-bugs

## Pending — Merge & Verify

- [ ] Review + merge 6 worktree branches (resolve conflicts on shared files)
  - [ ] `worktree-agent-afe35615` — Content extraction
  - [ ] `worktree-agent-a6cf2efb` — PDF & citations
  - [ ] `worktree-agent-a729a1cc` — Twitter/X
  - [ ] `worktree-agent-ac7b3f0f` — LinkedIn
  - [ ] `worktree-agent-aaa0a8be` — Google Maps
  - [ ] `worktree-agent-a630763d` — AI features
- [ ] Build verification after merge
- [ ] Manual browser testing

## Discovered (from bug hunt agents)

- [ ] Turndown nested list handling — 3+ level lists produce inconsistent indentation #discovered
- [ ] Content script doesn't handle iframes — YouTube/Vimeo embeds stripped #discovered
- [ ] SPA pages may return incomplete content — extraction runs before async load #discovered
- [ ] `normalizeUrl` strips `v`/`version` params unconditionally — could be meaningful #discovered
- [ ] `extractIndustryContext()` scans full body text on every page — expensive #discovered
- [ ] DOM selectors use fragile class names — consider aria-labels for resilience #discovered
- [ ] `mapsToolsService` may be partially dead code #discovered
- [ ] WAV merging is naive — multi-chunk TTS produces corrupted audio #discovered
- [ ] No retry logic for transient Groq API failures (429/5xx) #discovered
- [ ] ReAct agent conversation history grows unbounded #discovered
- [ ] Threadgirl `validateSettings` always returns valid #discovered

## Later

- [ ] Further split 1000+ line extraction files #needs:twitter-bugs #needs:linkedin-bugs
- [ ] Consolidate tiny type files (summaryStatus.ts, ttsStatus.ts, etc.)
- [ ] Add constants file for magic numbers (scroll delays, max scrolls, timeouts)
- [ ] Performance: selective field loading in DataController
