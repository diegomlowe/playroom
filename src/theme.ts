/**
 * App Theme Configuration
 *
 * Edit this file to change colors, font, and border radius.
 * The ThemeProvider applies these values as CSS variables on startup.
 *
 * Colors use HSL format: "hue saturation% lightness%"
 *
 * For preset inspiration, see src/lib/themes.ts — copy any preset's
 * values here and customize as needed.
 */

// ── Font presets (uncomment one, or add your own Google Fonts URL) ──
// Geometric sans — tech, clean, modern
// const font = { url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap', family: "'Inter', sans-serif" };
// const font = { url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400..700&display=swap', family: "'Space Grotesk', sans-serif" };
// const font = { url: 'https://fonts.googleapis.com/css2?family=Sora:wght@400..700&display=swap', family: "'Sora', sans-serif" };
// Humanist sans — friendly, approachable
// const font = { url: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400..700&display=swap', family: "'DM Sans', sans-serif" };
// const font = { url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..700&display=swap', family: "'Plus Jakarta Sans', sans-serif" };
// Serif — luxury, editorial, premium
// const font = { url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..900&display=swap', family: "'Playfair Display', serif" };
// const font = { url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400..700&display=swap', family: "'Cormorant Garamond', serif" };
// Mono — developer, hacker, terminal
// const font = { url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400..700&display=swap', family: "'JetBrains Mono', monospace" };
// const font = { url: 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap', family: "'Space Mono', monospace" };
// Display — bold, creative, expressive
// const font = { url: 'https://fonts.googleapis.com/css2?family=Unbounded:wght@400..700&display=swap', family: "'Unbounded', sans-serif" };
// const font = { url: 'https://fonts.googleapis.com/css2?family=Syne:wght@400..700&display=swap', family: "'Syne', sans-serif" };

// TapWars — Fast-paced arcade game. Orbitron for headings, Rajdhani for body.
const font = {
  url: 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;700;900&display=swap',
  family: "'Rajdhani', sans-serif",
};

export const theme = {
  colors: {
    background: '265 95% 4%',
    foreground: '200 100% 92%',
    card: '265 60% 8%',
    'card-foreground': '200 100% 92%',
    popover: '265 70% 7%',
    'popover-foreground': '200 100% 92%',
    primary: '280 100% 65%',
    'primary-foreground': '265 95% 4%',
    secondary: '265 50% 14%',
    'secondary-foreground': '200 80% 85%',
    muted: '265 40% 12%',
    'muted-foreground': '265 30% 55%',
    accent: '45 100% 55%',
    'accent-foreground': '265 95% 4%',
    destructive: '0 85% 60%',
    'destructive-foreground': '0 0% 100%',
    border: '265 50% 18%',
    input: '265 50% 14%',
    ring: '280 100% 65%',
    link: '185 100% 60%',
    'link-hover': '185 100% 75%',
    button: '280 100% 55%',
    'button-foreground': '0 0% 100%',
    'button-border': '280 100% 70%',
    'button-hover': '280 100% 70%',
    'button-hover-foreground': '0 0% 100%',
    'button-hover-border': '280 100% 85%',
    'button-ring': '280 100% 65%',
    'chart-1': '280 100% 65%',
    'chart-2': '45 100% 55%',
    'chart-3': '185 100% 60%',
    'chart-4': '320 90% 60%',
    'chart-5': '160 80% 50%',
    'sidebar-background': '265 95% 3%',
    'sidebar-foreground': '200 80% 85%',
    'sidebar-primary': '280 100% 65%',
    'sidebar-primary-foreground': '0 0% 100%',
    'sidebar-accent': '265 50% 12%',
    'sidebar-accent-foreground': '200 80% 85%',
    'sidebar-border': '265 50% 15%',
    'sidebar-ring': '280 100% 65%',
  },
  font,
  radius: '0.75rem',
};
