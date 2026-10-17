# Tend Marriage icon set

15 theme-aware SVG icons: 6 Foundations and 9 Rhythms. All use a 24×24 viewBox, 1.8px rounded outline strokes, transparent backgrounds, and `currentColor`.

## Usage
Marriage uses the centralized `marriageIconHTML` renderer in `app-categoryrhythms.js`. It maps known Foundation and Rhythm IDs to these external SVGs and applies them as CSS masks so each icon inherits Tend's `currentColor` theme. Use that renderer in cards and detail views instead of duplicating SVG markup.

The renderer pairs each icon with Tend's soft-tinted circular background. The SVG files remain unmodified and work with both light and dark theme colors.

`icons.json` lists filenames and groups. Foundation identifiers: connection, communication, fun-adventure, spiritual-growth, partnership, intimacy.

Daily Connection topics (Unhurried Conversation, Intentional Affection, Express Appreciation) are suggestions within the Daily Connection Rhythm, not separate Rhythms.
