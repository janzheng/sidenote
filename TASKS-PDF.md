# PDF & Citations — Bug Hunt

## Scope

- `src/lib/services/pdfExtractionService.svelte.ts`
- `src/lib/services/pdfCitationService.svelte.ts`
- `src/lib/services/citationService.svelte.ts`
- `src/lib/services/pdfDownloadService.svelte.ts`
- `src/background/tasks/handlePDFExtraction.svelte.ts`
- `src/background/tasks/handleContentExtraction.svelte.ts`

## Bugs Found & Fixed

- [x] [fixed: replaced private method with import from contentId.ts] pdfExtractionService duplicate cleanUrl — only 12 params vs shared 40+ #bug
- [x] [fixed: both handlers now use shared PDFExtractionService.isPDFUrl()] Incomplete PDF detection in background handlers — inline checks missed patterns #bug
- [x] [fixed: added ScienceDirect, JSTOR, ACM, IEEE, bioRxiv/medRxiv content patterns] Missing PDF URL patterns in isPDFUrl #bug
- [x] [fixed: added proper parenthesization] Operator precedence bug in isPDFUrl — `&&`/`||` without parens #bug
- [x] [fixed: changed to authors.join(' and ')] BibTeX author format — used comma-separated instead of ` and ` #bug
- [x] [fixed: changed to note={Correspondence: ...}] Non-standard BibTeX `correspondence` field — causes LaTeX warnings #bug
- [x] [fixed: now uses eprint/archiveprefix fields] arXiv BibTeX used `note` instead of standard `eprint`/`archiveprefix` #bug
- [x] [fixed: updated to APA 7th edition with doi.org link] arXiv APA citation format incorrect #bug
- [x] [fixed: detect and return specific errors for encrypted/corrupted PDFs] Missing error handling for corrupted/encrypted PDFs #bug

## Discovered

- [ ] `normalizeUrl` strips `v` and `version` params unconditionally — could remove meaningful query params on some URLs #discovered
