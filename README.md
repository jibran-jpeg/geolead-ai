# 🌐 GeoLead AI — Chrome Extension

> Extract business leads from Google Maps & generate AI-powered email pitches

![Version](https://img.shields.io/badge/version-1.0.0-6366f1)
![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-blue)
![React](https://img.shields.io/badge/React-18-61dafb)

## 🚀 Features

- **🔍 Smart Scraping** — Extract business data directly from Google Maps search results
- **📊 Lead Scoring** — Automatically prioritize leads (HOT/WARM/MEDIUM/LOW)
- **🤖 AI Email Pitches** — Generate personalized emails using Google Gemini Pro
- **📥 CSV Export** — Download all leads + pitches as a structured CSV file
- **📧 Gmail Integration** — Draft emails directly in Gmail with one click
- **💾 Session Memory** — All data persists across popup open/close
- **🎯 Category Filtering** — Select specific business types to target

## 📦 Tech Stack

| Component      | Technology            |
|----------------|----------------------|
| UI Framework   | React 18             |
| Styling        | Tailwind CSS v4      |
| Build Tool     | Vite 7               |
| State Mgmt     | Zustand              |
| Extension API  | Chrome Manifest V3   |
| AI             | Google Gemini Pro    |
| Export         | PapaParse (CSV)      |

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 18+
- Google Chrome browser
- (Optional) Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Build the Extension

```bash
# Install dependencies
npm install

# Build for production
npm run build
```

### Load in Chrome

1. Open Chrome → Navigate to `chrome://extensions/`
2. Enable **Developer Mode** (top-right toggle)
3. Click **"Load unpacked"**
4. Select the `dist/` folder from this project
5. The GeoLead AI icon will appear in your toolbar! 🎉

### Development

```bash
# Start dev server (for UI preview only)
npm run dev

# After code changes, rebuild and refresh:
npm run build
# Then click 🔄 on chrome://extensions page
```

## 📖 How to Use

1. **Open Google Maps** and search for a location (e.g., "restaurants in New York")
2. **Click the GeoLead AI** extension icon in your toolbar
3. **Select categories** you want to target (Hotels, Restaurants, etc.)
4. **Click "Start Scraping"** — the extension will auto-scroll and extract data
5. **Generate AI pitches** by clicking ✨ on each lead (requires Gemini API key)
6. **Export to CSV** or draft directly in Gmail!

## ⚙️ Settings

- **Gemini API Key** — Get your free key at [Google AI Studio](https://aistudio.google.com/apikey)
- **Scraping Speed** — Slow (safest) / Medium (recommended) / Fast
- **Scroll Depth** — How many results to load (10-100)

## 📁 Project Structure

```
geolead-ai/
├── public/manifest.json     # Chrome Manifest V3
├── src/
│   ├── popup/               # React UI (components + tabs + store)
│   ├── content/scraper.js   # Google Maps content script
│   ├── background/          # Service worker + Gemini API
│   └── utils/               # Constants, scoring, export, templates
├── dist/                    # Built extension (load this in Chrome)
└── vite.config.js           # Build configuration
```

## ⚠️ Important Notes

- Google Maps DOM structure changes frequently. The scraper uses multiple fallback selectors.
- Use **Medium** scraping speed to avoid detection.
- Free Gemini API tier: 60 requests/min, 1500/day.
- All data stays local — nothing is sent to external servers (except Gemini API for pitch generation).

## 📄 License

MIT License — Free for personal and commercial use.
