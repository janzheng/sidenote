# LinkedIn — Bug Hunt

## Scope

- `src/content-script/tasks/extractLinkedInThreadWithScroll.svelte.ts`
- `src/lib/services/linkedInExtractionService.ts`
- `src/lib/ui/linkedInManager.svelte.ts`
- `src/background/tasks/handleLinkedInThreadExtraction.svelte.ts`
- `src/lib/components/LinkedInThread.svelte`
- `src/content-script/tasks/socialMediaHelpers.ts`

## Bugs Found & Fixed

- [x] [fixed: 3-tier fallback: exact match, origin+pathname wildcard, LinkedIn tab pathname filter] Tab lookup fails for LinkedIn URLs with tracking params #bug
- [x] [fixed: added null guards on response before accessing .success/.error] Null response crash from chrome.tabs.sendMessage — TypeError when content script not ready #bug
- [x] [fixed: added /activity/ slash pattern, data-urn extraction, broader regex] extractPostId missed activity URL patterns — only matched /activity- (dash) #bug
- [x] [fixed: only extract usernames from /in/ patterns] extractAuthorFromDOM treated post slugs as usernames — activity IDs used as fake profile URLs #bug
- [x] [fixed: added short-form parsing for 1h/2d/3w/1mo/1yr] parseRelativeTime only handled long-form "X hours ago" — missed "1h" format #bug
- [x] [fixed: check .social-details-social-counts first, then specific button selectors] Engagement extraction matched comment editor instead of engagement counts #bug
- [x] [fixed: updated selectors for posts, text, author, see-more, comments, replies] Outdated DOM selectors across multiple extraction areas #bug

## Discovered

- [ ] `extractIndustryContext()` scans `document.body.textContent` on every page — extremely expensive, matches generic words #discovered
- [ ] LinkedIn DOM changes frequently — all selectors need periodic live verification #discovered
