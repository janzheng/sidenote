# Content Extraction — Bug Hunt

## Scope

- `src/content-script/tasks/extractContent.svelte.ts`
- `src/content-script/tasks/extractMetadata.svelte.ts`
- `src/content-script/tasks/extractJsonLd.svelte.ts`
- `src/lib/services/dataController.svelte.ts`
- `src/lib/ui/panelManager.svelte.ts`
- `src/lib/services/parseContent.svelte.ts`

## Bugs Found & Fixed

- [x] [fixed: added serializeForStorage/deserializeFromStorage methods] Set serialization bug — `activeTabIds` Set serializes to `{}` in chrome.storage, breaks on reload #bug
- [x] [fixed: added instanceof guards for Set/Map/Date] deepMerge corrupts Set/Map/Date objects — treats them as plain objects for recursive merge #bug
- [x] [fixed: added custom Turndown rules for table/tr/th/td] No HTML table-to-Markdown conversion — tables become garbled text #bug
- [x] [fixed: added Set to track visited objects] JSON-LD flattenJsonLdObjects produces duplicates — objects visited multiple times #bug
- [x] [fixed: changed to normalized URL comparison] Anchor nav triggers unnecessary re-extraction — `status=complete` handler used strict URL equality #bug
- [x] [fixed: updated regex to accept doi: and https://doi.org/ prefixes] DOI extraction too strict — misses prefixed DOIs from Dublin Core #bug
- [x] [fixed: added negative char class to strip trailing punctuation] DOI fallback captures trailing punctuation (`.`, `,`, `;`, `)`) #bug
- [x] [fixed: case-sensitive, word boundaries, min 5 digits] PMCID fallback regex too broad — false positives on short digit strings #bug
- [x] [fixed: added markdown and extractedAt fields] ContentExtractionResult type incomplete — missing fields present in returned object #bug

## Discovered

- [ ] Turndown nested list handling — deeply nested lists (3+ levels) produce inconsistent indentation #discovered
- [ ] Content script doesn't handle iframes — YouTube/Vimeo embeds stripped instead of converted to links #discovered
- [ ] SPA pages may return incomplete content — extraction runs before async content loads #discovered
