# SideNote — Chrome Extension

## Current

- [x] [done: all 6 branches merged, build clean, 40 files changed] Review + merge 6 worktree branches
- [x] [done: committed as f382903] Build verification after merge

- [ ] Manual browser testing
  - [ ] Regular webpage extraction
  - [ ] Twitter tweet — verify author name shows correctly
  - [ ] Twitter thread scroll extraction
  - [ ] LinkedIn post extraction
  - [ ] PDF extraction + citation generation
  - [ ] Google Maps extraction + control
  - [ ] Tab switching (5+ tabs rapidly)
  - [ ] AI summary, chat, TTS

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
