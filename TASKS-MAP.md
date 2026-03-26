# SideNote — Map

## Phase 1: Foundation [shipped]

- [x] Chrome Extension MV3 scaffold #scaffold
- [x] Background service worker + message routing #messaging
- [x] Content script injection + DOM extraction #content-script
- [x] Side panel UI (Svelte 5) #side-panel
- [x] DataController + chrome.storage persistence #data-layer
- [x] Settings management #settings

## Phase 2: Features [shipped]

### Lane A: Content Extraction (independent)

- [x] General content extraction — HTML, text, markdown #content-extract
- [x] PDF extraction via pdfjs-dist #pdf-extract #needs:content-extract
- [x] Twitter/X thread extraction with scroll #twitter #needs:content-extract
- [x] LinkedIn thread extraction with scroll #linkedin #needs:content-extract
- [x] Google Maps extraction + control #maps #needs:content-extract
- [x] Page assets extraction (images, fonts, SVGs) #page-assets #needs:content-extract

### Lane B: AI Features (needs content)

- [x] Groq API integration #groq-api
- [x] AI Summary generation #summary #needs:content-extract #needs:groq-api
- [x] AI Chat #chat #needs:content-extract #needs:groq-api
- [x] AI Research Paper analysis #research-paper #needs:content-extract #needs:groq-api
- [x] AI Recipe extraction #recipe #needs:content-extract #needs:groq-api
- [x] AI Text-to-Speech #tts #needs:groq-api
- [x] AI ReAct Agent #react-agent #needs:content-extract #needs:groq-api
- [x] Threadgirl processing #threadgirl

### Lane C: Utilities (independent)

- [x] Citation generation (BibTeX, APA, etc.) #citations #needs:content-extract
- [x] PDF citation enhancement with AI #pdf-citations #needs:pdf-extract #needs:groq-api
- [x] Jina pageshot / screenshot #screenshots
- [x] Bookmarking to Google Sheets #bookmarks
- [x] Content structure parsing #content-structure #needs:content-extract

## Phase 3: Stability — Bug Hunt [current]

All lanes are independent — can fan out in parallel.

### Lane A: Social Media Extraction

- [ ] Twitter/X bug hunt + fixes #twitter-bugs `-> TASKS-TWITTER.md`
- [ ] LinkedIn bug hunt + fixes #linkedin-bugs `-> TASKS-LINKEDIN.md`

### Lane B: Document Extraction

- [ ] PDF extraction + citations bug hunt #pdf-bugs `-> TASKS-PDF.md`
- [ ] General content extraction bug hunt #content-bugs `-> TASKS-CONTENT.md`

### Lane C: Maps

- [ ] Google Maps extraction + control bug hunt #maps-bugs `-> TASKS-MAPS.md`

### Lane D: AI Features

- [ ] AI features bug hunt (summary, chat, TTS, research paper, recipe, ReAct) #ai-bugs `-> TASKS-AI.md`

## Phase 4: Polish

- [ ] Further split 1000+ line extraction files #needs:twitter-bugs #needs:linkedin-bugs
- [ ] Consolidate tiny type files
- [ ] Constants file for magic numbers
- [ ] Performance: selective field loading in DataController
