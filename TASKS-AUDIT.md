# SideNote — Correctness Audit

Full sweep of `src/`. Findings only — no fixes applied. Created 2026-03-26.

**Totals: 43 findings across 1 sweep wave (12 fixed, 31 remaining)**

> **Deployment context:** Local Chrome extension (MV3) for personal use. Single user.
> Items marked `#local-real` affect every session regardless of scale.
> Items marked `#at-scale-only` only matter at scale/multi-user.

---

## Fix-First List

**Tier 0 — Security:**
- [x] [fixed: added URL scheme allowlist (http/https/file only)] **A031** navigateToUrl allows javascript: URLs `content-script/index.ts:79-80` #security #local-real

**Tier 1 — Broken in every session:**
- [x] [fixed: lazy init via getAgent(), null in state] **A006** mapsChatManager ReActAgent orphan `mapsChatManager.svelte.ts:11` #resource-leak #local-real
- [x] [fixed: poll getMapsDataStatus instead of hardcoded wait] **A008_2** mapsChatManager hardcoded 2s wait `mapsChatManager.svelte.ts:119` #logic-bug #local-real
- [x] [fixed: optional chaining + early return on null data] **A009** mapsChatManager null property access `mapsChatManager.svelte.ts:521` #error-handling #local-real
- [x] [fixed: converted getQuickBookmarkClass to reactive getter] **A012** bookmarkManager CSS not reactive `bookmarkManager.svelte.ts:36` #logic-bug #local-real

**Tier 2 — State corruption / stuck states:**
- [!] **A004** summaryManager error state persists with no recovery path `summaryManager.svelte.ts:55-57` #error-handling #local-real
- [x] [fixed: stop + clearAll + null agent on reset] **A014** mapsChatManager ReActAgent not cleared on reset `mapsChatManager.svelte.ts:664` #logic-bug #at-scale-only

**Tier 3 — Data loss / silent failures:**
- [ ] **A025** Sequential saves can overwrite each other in handleContentExtraction `handleContentExtraction.svelte.ts:103-105` #data-loss #at-scale-only

---

## P1 — High (fix before production use)

### Wave 1 — Manager/State Layer
- [x] [fixed: removed invalid this.state.results references] **A001** threadgirlManager undefined state property #logic-bug #at-scale-only
- [!] **A004** summaryManager error state stuck with no recovery path `summaryManager.svelte.ts:55-57` #error-handling #local-real
- [x] [fixed: lazy init via getAgent()] **A006** mapsChatManager ReActAgent orphan #resource-leak #local-real
- [x] [fixed: poll instead of hardcoded wait] **A008_2** mapsChatManager hardcoded 2s wait #logic-bug #local-real
- [x] [fixed: optional chaining] **A009** mapsChatManager null property access #error-handling #local-real
- [x] [fixed: reactive getter] **A012** bookmarkManager CSS feedback #logic-bug #local-real

### Wave 1 — Background/Services
- [!] **A017** handleContentExtraction response may never be set in retry loop `handleContentExtraction.svelte.ts:34-65` #logic-bug #local-real
- [x] [fixed: try/catch in statusHandler] **A021** statusHandler crashes message channel #error-handling #local-real

### Wave 1 — Content Scripts
- [x] [fixed: URL scheme allowlist] **A031** navigateToUrl security #security #local-real
- [!] **A033** MutationObserver not disconnected on early resolve in waitForElements `extractMapsData.svelte.ts:921-932` #resource-leak #local-real
- [x] [fixed: skip posts with falsy IDs in dedup] **A036** LinkedIn dedup with undefined IDs #logic-bug #local-real

---

## P2 — Medium (address before sustained operation)

### Wave 1 — Manager/State Layer
- [ ] **A002** Leaked timers with no cleanup — 8+ managers use setTimeout without storing refs `panelManager.svelte.ts:465` etc. #resource-leak #at-scale-only
- [ ] **A003** Race in panelManager extraction deduplication `panelManager.svelte.ts:559-597` #race-condition #at-scale-only
- [ ] **A005** Untracked audio blob URLs in textToSpeechManager `textToSpeechManager.svelte.ts:116` #resource-leak #at-scale-only
- [ ] **A007** mapsChatManager ReActAgent not cleaned on reset `mapsChatManager.svelte.ts:664` #resource-leak #at-scale-only
- [ ] **A010** Error timeouts persist across tab switches in multiple managers #logic-bug #at-scale-only
- [ ] **A011** Concurrent API calls overwrite each other in chatManager `chatManager.svelte.ts:47-78` #race-condition #at-scale-only
- [ ] **A013** Dead code in bookmarkManager — duplicate isQuickBookmarking reset `bookmarkManager.svelte.ts:50` #dead-code #local-real
- [ ] **A015** panelManager event listeners accumulate on rapid tab switches `panelManager.svelte.ts:366-455` #resource-leak #at-scale-only

### Wave 1 — Background/Services
- [ ] **A016** Unhandled rejection in dataController sendMessage `dataController.svelte.ts:373` #error-handling #local-real
- [ ] **A018** Missing null check on response after retry loop `handleContentExtraction.svelte.ts:77` #logic-bug #local-real
- [ ] **A019** Missing tab validation before sendMessage in PDF handler `handlePDFExtraction.svelte.ts:46` #error-handling #local-real
- [x] [fixed: removed from dispatch map] **A020** Dead handlers getAllTabData, getRawStorageData #dead-code #local-real
- [ ] **A022** Unhandled PDFExtraction chrome.tabs.query error `handlePDFExtraction.svelte.ts:31` #error-handling #local-real
- [ ] **A023** Silent error swallow in action.onClicked `background/index.ts:251` #error-handling #local-real
- [ ] **A024** Sequential saves create race in handleContentExtraction `handleContentExtraction.svelte.ts:93-123` #race-condition #at-scale-only
- [ ] **A025** Data loss from stale reads between saves `handleContentExtraction.svelte.ts:103-105` #data-loss #at-scale-only
- [ ] **A026** Inconsistent return patterns from dispatch handlers `background/index.ts:46,54` #wiring #local-real
- [ ] **A027** Twitter extraction retry doesn't validate stale response `handleTwitterThreadExtraction.svelte.ts:130` #error-handling #local-real

### Wave 1 — Content Scripts
- [ ] **A028** Unknown message handler doesn't return true `content-script/index.ts:164` #wiring #local-real
- [ ] **A029** setInterval leak in scrollCapture.wait `scrollCapture.svelte.ts:395-409` #resource-leak #at-scale-only
- [ ] **A030** MutationObserver callback may fire after disconnect `controlMaps.svelte.ts:15-30` #race-condition #local-real
- [ ] **A032** Scroll loop may not terminate on extraction error `scrollCapture.svelte.ts:188-279` #logic-bug #at-scale-only
- [x] [fixed: fallback to getBoundingClientRect when translateY is null] **A034** Tweet classification null Y #logic-bug #local-real
- [ ] **A035** sendResponse called multiple times on error paths `content-script/index.ts:18-27` #race-condition #local-real
- [ ] **A037** normalizeUrl throws on about:blank, chrome:// `contentId.ts:7-62` #error-handling #local-real
- [ ] **A038** Metadata image extraction fails on about:blank `extractMetadata.svelte.ts:140-150` #error-handling #local-real
- [ ] **A039** TreeWalker in findElementByText has no depth limit `scrollCapture.svelte.ts:377-390` #logic-bug #at-scale-only
- [ ] **A040** Dead code: threadBoundaries populated but unused `extractTwitterThreadWithScroll.svelte.ts:363-369` #dead-code #local-real
- [ ] **A041** setInterval not cleared on early promise resolution in scrollCapture `scrollCapture.svelte.ts:395-409` #resource-leak #local-real

---

## Top Themes

1. **Error state management** (8 findings) — Managers get stuck in error states or clear errors at wrong times. No consistent recovery pattern.
2. **Resource leaks** (9 findings) — MutationObservers, timers, audio blobs, ReActAgent instances not cleaned up.
3. **Concurrent operation races** (5 findings) — No guards against rapid double-clicks or concurrent API calls.
4. **Missing null/error checks** (7 findings) — Properties accessed without validation, especially in Maps and content extraction.
5. **Dead code** (4 findings) — Unused handlers, variables, and code paths.

## Stats
| Category | Count |
|----------|-------|
| error-handling | 12 |
| resource-leak | 9 |
| logic-bug | 9 |
| race-condition | 5 |
| dead-code | 4 |
| data-loss | 1 |
| security | 1 |
| wiring | 2 |
| **Total** | **43** |
