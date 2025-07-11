# SideNote

SideNote is a Chrome extension that helps you analyze and summarize web content using AI. It provides a convenient side panel for extracting content, generating summaries, analyzing research papers, and more.

## Installation

### Prerequisites
- Node.js (version 16 or higher)
- Chrome browser
- Terminal or command line interface

### Setup Instructions

1. **Clone or Download the Project**
   ```bash
   # If you have GitHub CLI installed:
   gh repo clone janzheng/sidenote
   
   # Or clone with git:
   git clone https://github.com/janzheng/sidenote.git
   
   # Navigate to the project folder:
   cd sidenote
   ```

2. **Install Dependencies**
   ```bash
   # Using npm:
   npm install
   
   # Or using yarn:
   yarn install
   ```

3. **Build the Extension**
   ```bash
   npm run build
   ```
   This creates a `dist` folder with the compiled extension files.

4. **Load Extension in Chrome**
   - Open Chrome browser
   - Click the Extensions button (puzzle piece icon) in the toolbar
   - Select "Manage Extensions" or go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Navigate to your project folder and select the `dist` folder
   - Click "Select" or "Open"

5. **Pin the Extension**
   - Click the Extensions button (puzzle piece icon) in Chrome toolbar
   - Find "SideNote" in the list
   - Click the pin icon next to it to keep it visible in your toolbar

## Usage

- Click the SideNote icon in your Chrome toolbar to open the side panel
- Navigate to any webpage to start analyzing content
- Use the various AI features available in the side panel

## Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:main` - Build main extension only
- `npm run build:content` - Build content script only

### Project Structure
- `src/` - Source code
- `dist/` - Built extension files (created after build)
- `public/` - Static assets and manifest.json

Have fun exploring and analyzing web content with SideNote!

