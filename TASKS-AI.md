# AI Features — Bug Hunt

## Scope

- `src/lib/services/groqService.svelte.ts`
- `src/lib/services/summaryService.svelte.ts`
- `src/lib/services/chatService.svelte.ts`
- `src/lib/services/researchPaperService.svelte.ts`
- `src/lib/services/recipeService.svelte.ts`
- `src/lib/services/textToSpeechService.svelte.ts`
- `src/lib/services/threadgirlService.svelte.ts`
- `src/lib/agents/reactAgent.svelte.ts`
- `src/lib/utils/extractJsonFromResponse.ts`
- `src/lib/ui/textToSpeechManager.svelte.ts`
- `src/lib/ui/chatManager.svelte.ts`
- Background handlers for each feature

## Bugs Found & Fixed

- [x] [fixed: moved null/empty checks before log statements in 3 locations] Crash-on-access before null check in groqService — log accesses data before guard #bug
- [x] [fixed: added specific messages for HTTP 429, 413/token-limit, timeout] No rate limit or context-window error messaging — cryptic errors shown to user #bug
- [x] [fixed: replaced JSON.parse with extractJsonFromResponse] Recipe service uses fragile raw JSON.parse on LLM output #bug
- [x] [fixed: changed to cleanAndParseJson, fixed non-greedy regex to greedy] Research paper section ID uses raw JSON.parse with wrong regex #bug
- [x] [fixed: summary 100k→20k, chat 100k→80k, TTS 120k→60k, research added 200k limit] Content truncation too large for model context windows — silent API failures #bug
- [x] [fixed: store handler refs in audioHandlers object, use for both add/remove] TTS audio event listener memory leak — removeEventListener with new anonymous funcs never matches #bug
- [x] [fixed: revert messages to previousHistory on error/failure] Chat manager doesn't revert optimistic message on API failure — confusing UI state #bug
- [x] [fixed: added empty-content checks with descriptive errors in summary + TTS handlers] Missing empty-content validation in background task handlers #bug
- [x] [fixed: added JSON array extraction fallback /\[[\s\S]*\]/] extractJsonFromResponse doesn't handle JSON arrays from LLM output #bug

## Discovered

- [ ] WAV merging is naive — `mergeAudioBlobs` concatenates raw bytes without handling headers, multi-chunk TTS produces corrupted audio #discovered
- [ ] No retry logic for transient API failures — groqService has no backoff for 429/5xx #discovered
- [ ] ReAct agent conversation history grows unbounded — long sessions will exceed context limits #discovered
- [ ] Threadgirl `validateSettings` always returns valid — no upfront check if external service is down #discovered
