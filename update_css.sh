#!/bin/bash
sed -i -e '/^:root {/!b' -e ':a' -e 'N' -e '/^}$/!ba' -e 'c\
:root {\n\
  --bg-app: #f9fafb /* gray 50 */;\n\
\n\
  /* True Surface */\n\
  --bg-surface: rgba(255, 255, 255, 0.85);\n\
  --bg-surface-hover: rgba(255, 255, 255, 1);\n\
  --bg-glass-active: rgba(255, 255, 255, 1);\n\
  --bg-secondary: rgba(243, 244, 246, 0.7) /* gray 100 translucent */;\n\
\n\
  /* Borders */\n\
  --border-color: rgba(229, 231, 235, 1) /* gray 200 */;\n\
  --border-hover: rgba(209, 213, 219, 1) /* gray 300 */;\n\
  --border-inset: rgba(0, 0, 0, 0.05);\n\
\n\
  /* Elegant Accents */\n\
  --primary: #101828 /* Gray 900 - sleek primary */;\n\
  --primary-hover: #344054 /* Gray 700 */;\n\
  --primary-light: #475467 /* Gray 600 */;\n\
  --primary-glow: rgba(16, 24, 40, 0.1);\n\
\n\
  --secondary: #344054 /* Gray 700 */;\n\
  --accent: #0ea5e9 /* Sky */;\n\
\n\
  /* Status Colors (Slightly more muted/professional) */\n\
  --success: #027a48 /* Emerald darker */;\n\
  --success-bg: rgba(2, 122, 72, 0.1);\n\
  --warning: #b54708 /* Orange darker */;\n\
  --warning-bg: rgba(181, 71, 8, 0.1);\n\
  --danger: #b42318 /* Red darker */;\n\
  --danger-bg: rgba(180, 35, 24, 0.1);\n\
\n\
  /* Stark Contrast Typography */\n\
  --text-primary: #101828 /* Gray 900 */;\n\
  --text-secondary: #475467 /* Gray 600 */;\n\
  --text-muted: #667085 /* Gray 500 */;\n\
\n\
  /* Fluid Geometry */\n\
  --radius-sm: 6px;\n\
  --radius-md: 10px;\n\
  --radius-lg: 16px;\n\
  --radius-full: 9999px;\n\
\n\
  --shadow-sm: 0 1px 3px 0 rgba(16, 24, 40, 0.1), 0 1px 2px -1px rgba(16, 24, 40, 0.1);\n\
  --shadow-glass: 0 4px 6px -1px rgba(16, 24, 40, 0.1), 0 2px 4px -2px rgba(16, 24, 40, 0.1);\n\
  --shadow-inset: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02);\n\
  --shadow-glow: 0 0 12px var(--primary-glow);\n\
\n\
  --orb-top: #f1f5f9; /* Slate 100 */\n\
  --orb-bottom: #f8fafc; /* Slate 50 */\n\
}' src/index.css

sed -i -e '/^\.dark {/!b' -e ':a' -e 'N' -e '/^}$/!ba' -e 'c\
.dark {\n\
  /* Ultra-Premium Palette (Dark Mode Surface) */\n\
  --bg-app: #0c111d /* Gray 900+ */;\n\
\n\
  --bg-surface: rgba(31, 41, 55, 0.5) /* Gray 800 */;\n\
  --bg-surface-hover: rgba(31, 41, 55, 0.8);\n\
  --bg-glass-active: rgba(31, 41, 55, 1);\n\
  --bg-secondary: rgba(17, 24, 39, 0.6) /* Gray 900 translucent */;\n\
\n\
  --border-color: rgba(255, 255, 255, 0.08);\n\
  --border-hover: rgba(255, 255, 255, 0.15);\n\
  --border-inset: rgba(0, 0, 0, 0.3);\n\
\n\
  --text-primary: #f9fafb /* Gray 50 */;\n\
  --text-secondary: #9ca3af /* Gray 400 */;\n\
  --text-muted: #6b7280 /* Gray 500 */;\n\
\n\
  --primary: #ffffff /* White */;\n\
  --primary-hover: #f3f4f6 /* Gray 100 */;\n\
  --primary-light: #d1d5db /* Gray 300 */;\n\
  --primary-glow: rgba(255, 255, 255, 0.2);\n\
\n\
  --success: #34d399;\n\
  --warning: #fbbf24;\n\
  --danger: #f87171;\n\
\n\
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.3);\n\
  --shadow-glass: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3);\n\
  --shadow-inset: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);\n\
\n\
  --orb-top: #1f2937; /* Gray 800 */\n\
  --orb-bottom: #111827; /* Gray 900 */\n\
}' src/index.css
bash update_css.sh
