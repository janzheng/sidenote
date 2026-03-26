# Google Maps — Bug Hunt

## Scope

- `src/content-script/tasks/extractMapsData.svelte.ts`
- `src/content-script/tasks/controlMaps.svelte.ts`
- `src/background/tasks/handleMapsExtraction.svelte.ts`
- `src/background/tasks/handleMapsControl.svelte.ts`
- `src/lib/ui/mapsManager.svelte.ts`
- `src/lib/ui/mapsChatManager.svelte.ts`
- `src/lib/services/mapsToolsService.svelte.ts`
- `src/lib/components/AiMapsChat.svelte`

## Bugs Found & Fixed

- [x] [fixed: added google.com without www to all hostname checks] Incomplete hostname matching — missed `google.com` (no www) in 3 files #bug
- [x] [fixed: changed to 'h1.DUwDvf .lfPIob' with dot] Invalid CSS selector in extractCurrentPlaceName — missing dot before class name #bug
- [x] [fixed: changed to parseFloat()] extractZoomLevel used parseInt — loses decimal precision (13.5z → 13) #bug
- [x] [fixed: removed layer=c → satellite mapping] extractMapType misidentifies Street View as satellite — layer=c is camera mode #bug
- [x] [fixed: added observer.disconnect() in success path + resolved guard] MutationObserver never disconnected on success — memory leak #bug
- [x] [fixed: changed to chrome.tabs.query({}) + manual URL comparison] chrome.tabs.query({ url }) misuse — expects patterns not exact URLs, silently fails #bug
- [x] [fixed: replaced new Promise wrappers with direct await + try/catch] 6 Promise methods in mapsToolsService could hang forever on silent failure #bug
- [x] [fixed: removed Promise wrapper, made straightforward async with try/catch] executeResultAnalysis async Promise executor anti-pattern — swallows errors #bug
- [x] [fixed: changed to chrome.tabs.query({ lastFocusedWindow: true })] navigateToUrl queries all windows — picks wrong tab from other windows #bug

## Discovered

- [ ] DOM selectors use fragile class names — consider aria-labels/data attributes for resilience #discovered
- [ ] `mapsToolsService` may be partially dead code — codebase has both it and `src/lib/agents/tools/gmaps/` #discovered
