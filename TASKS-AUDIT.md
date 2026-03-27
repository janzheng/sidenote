# SideNote — Correctness Audit

Full sweep of `src/`. Findings only — no fixes applied. Created 2026-03-26.

**Totals: 43 findings across 1 sweep wave — ALL RESOLVED (35 fixed, 8 verified safe)**

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
- [x] [fixed: clear error at start of retry] **A004** summaryManager error recovery #error-handling #local-real
- [x] [fixed: stop + clearAll + null agent on reset] **A014** mapsChatManager ReActAgent not cleared on reset #logic-bug #at-scale-only

**Tier 3 — Data loss / silent failures:**
- [x] [verified: DataController save locks prevent this] **A025** Sequential saves race #data-loss #at-scale-only

---

## P1 — High (fix before production use)

### Wave 1 — Manager/State Layer
- [x] [fixed: removed invalid this.state.results references] **A001** threadgirlManager undefined state property #logic-bug #at-scale-only
- [x] [fixed: clear error state at start of new operation] **A004** summaryManager error recovery #error-handling #local-real
- [x] [fixed: lazy init via getAgent()] **A006** mapsChatManager ReActAgent orphan #resource-leak #local-real
- [x] [fixed: poll instead of hardcoded wait] **A008_2** mapsChatManager hardcoded 2s wait #logic-bug #local-real
- [x] [fixed: optional chaining] **A009** mapsChatManager null property access #error-handling #local-real
- [x] [fixed: reactive getter] **A012** bookmarkManager CSS feedback #logic-bug #local-real

### Wave 1 — Background/Services
- [x] [fixed: exhaustedRetries flag + explicit null response handling] **A017** handleContentExtraction retry loop #logic-bug #local-real
- [x] [fixed: try/catch in statusHandler] **A021** statusHandler crashes message channel #error-handling #local-real

### Wave 1 — Content Scripts
- [x] [fixed: URL scheme allowlist] **A031** navigateToUrl security #security #local-real
- [x] [fixed: resolved guard on timeout + observer?.disconnect on all paths] **A033** waitForElements observer leak #resource-leak #local-real
- [x] [fixed: skip posts with falsy IDs in dedup] **A036** LinkedIn dedup with undefined IDs #logic-bug #local-real

---

## P2 — Medium (address before sustained operation)

### Wave 1 — Manager/State Layer
- [x] [fixed: store timeout refs + clear in reset() across 9 managers] **A002** Leaked timers #resource-leak #at-scale-only
- [x] [fixed: track extractionPromiseUrl, await existing instead of racing] **A003** panelManager extraction race #race-condition #at-scale-only
- [x] [fixed: revoke old blob URL before creating new one] **A005** Audio blob URL leak #resource-leak #at-scale-only
- [x] [fixed: stop + clearAll + null on reset] **A007** mapsChatManager ReActAgent leak #resource-leak #at-scale-only
- [x] [fixed: all managers now clear timers in reset()] **A010** Error timeouts across tab switches #logic-bug #at-scale-only
- [x] [verified: chatManager already guards with isGenerating] **A011** Concurrent chat API calls #race-condition #at-scale-only
- [x] [fixed: replaced duplicate resets with finally block] **A013** bookmarkManager dead code #dead-code #local-real
- [x] [verified: listeners added once in constructor, removed in cleanup()] **A015** panelManager listener accumulation #resource-leak #at-scale-only

### Wave 1 — Background/Services
- [x] [fixed: explicit .catch() on sendMessage promise] **A016** dataController sendMessage rejection #error-handling #local-real
- [x] [verified: exhaustedRetries flag + null check already handles this] **A018** handleContentExtraction null response #logic-bug #local-real
- [x] [verified: tabs.length + tab.id checks + outer try/catch already handle this] **A019** PDF handler tab validation #error-handling #local-real
- [x] [fixed: removed from dispatch map] **A020** Dead handlers getAllTabData, getRawStorageData #dead-code #local-real
- [x] [verified: outer try/catch at line 9/70-74 covers chrome.tabs.query] **A022** PDFExtraction query error #error-handling #local-real
- [x] [fixed: console.warn in catch instead of silent swallow] **A023** action.onClicked error swallow #error-handling #local-real
- [x] [verified: DataController save locks serialize per-URL, preventing TOCTOU] **A024** Sequential saves race #race-condition #at-scale-only
- [x] [verified: save locks serialize, stale reads not possible] **A025** Stale reads between saves #data-loss #at-scale-only
- [x] [verified: dispatcher wraps with Promise.resolve().catch(), pattern is safe] **A026** Inconsistent handler returns #wiring #local-real
- [x] [fixed: null response before retry block to prevent stale data] **A027** Twitter extraction stale response #error-handling #local-real

### Wave 1 — Content Scripts
- [x] [verified: already returns true at line 165] **A028** Unknown handler return true #wiring #local-real
- [x] [fixed: main setTimeout now clears interval before resolving] **A029** scrollCapture.wait interval leak #resource-leak #at-scale-only
- [x] [fixed: added found flag to prevent callback after disconnect] **A030** MutationObserver post-disconnect #race-condition #local-real
- [x] [fixed: try/catch wrapping scroll loop body, stop on error] **A032** Scroll loop non-termination #logic-bug #at-scale-only
- [x] [fixed: fallback to getBoundingClientRect when translateY is null] **A034** Tweet classification null Y #logic-bug #local-real
- [x] [fixed: responded guard wrapper prevents double sendResponse] **A035** Double sendResponse #race-condition #local-real
- [x] [fixed: early return for known special URL schemes] **A037** normalizeUrl special schemes #error-handling #local-real
- [x] [verified: try/catch already handles about:blank, falls back to original URL] **A038** Metadata image about:blank #error-handling #local-real
- [x] [fixed: 10K node iteration limit on TreeWalker] **A039** TreeWalker depth limit #logic-bug #at-scale-only
- [x] [fixed: removed unused threadBoundaries array] **A040** Dead threadBoundaries #dead-code #local-real
- [x] [fixed: main setTimeout clears interval directly] **A041** scrollCapture interval leak #resource-leak #local-real

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
