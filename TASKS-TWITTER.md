# Twitter/X — Bug Hunt

## Scope

- `src/content-script/tasks/extractTwitterThreadWithScroll.svelte.ts`
- `src/lib/services/twitterExtractionService.ts`
- `src/lib/ui/twitterManager.svelte.ts`
- `src/background/tasks/handleTwitterThreadExtraction.svelte.ts`
- `src/lib/components/TwitterThread.svelte`
- `src/content-script/tasks/socialMediaHelpers.ts`

## Bugs Found & Fixed

- [x] [fixed: rewrote to iterate all a[role=link] elements, distinguish @handle from display name, 3 fallback strategies] "Unknown Author" — extractAuthorFromTweetElement grabbed wrong link in User-Name element #bug
- [x] [fixed: changed to extract from first tweet article element, URL-based fallback] "Unknown Author" — extractAuthorFromDOM used non-existent data-testid="UserName" on tweet pages #bug
- [x] [fixed: 3-tier fallback: exact match, origin+pathname wildcard, /status/ pattern search] Tab lookup failure — exact URL match fails with tracking params #bug
- [x] [fixed: targets role=group engagement container, aria-labels as primary source, analytics link for views] Engagement extraction too broad — matched non-engagement buttons, wrong counts #bug
- [x] [fixed: added comma-separated number handling, reordered matching] parseEngagementCount didn't handle "1,234 Likes" format #bug
- [x] [fixed: replaced with content-based hashing using text+timestamp+author] Position-based dedup IDs — getBoundingClientRect changes on scroll, causing duplicate extraction #bug
- [x] [fixed: added avatar container, emoji/twemoji, small image checks] Image extraction too permissive — included avatars, emojis, tiny icons #bug

## Discovered

- [ ] handleTwitterThreadExtraction receives raw URL without cleaning — consider normalizing at entry point #discovered
- [ ] Thread extraction early-stop may still occur if stable extraction threshold (12 cycles) is too aggressive #discovered
- [ ] Verification badge selectors (`icon-verified`, `svg[aria-label*="Verified"]`) need live DOM verification #discovered
