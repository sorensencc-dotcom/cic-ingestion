# Cast Iron Charlie Design System — Design Tokens (CICDS)

**Version:** 1.0.0  
**Source of Truth:** `sorensencc-dotcom/castironcharlie` / `colors_and_type.css`  
**Classification:** Canonical Token Specification  

---

## 1. Color Palette Tokens

### 1.1 Core Palette (10 Sanctioned Colors)
| Token Name | Hex Value | Semantic Role |
|---|---|---|
| `--black` | `#0a0806` | Primary background, root canvas |
| `--forge` | `#1a1410` | Secondary background, cards, container surfaces |
| `--iron` | `#2c2420` | Raised surfaces, table headers, elevated cards |
| `--rust` | `#8B3A1A` | Hover/pressed accents, section labels, dark borders |
| `--ember` | `#C4501A` | Primary accent — CTAs, active borders, alert tags |
| `--brass` | `#B8922A` | Brand logo, highlighted italic titles, golden tags |
| `--ash` | `#9a9088` | Secondary body text, captions, muted metadata |
| `--bone` | `#e8e0d4` | Primary body copy, readouts |
| `--paper` | `#f2ece2` | Near-white warm surface accents, highlights |
| `--white` | `#faf6f0` | Hero headlines, primary headings |

### 1.2 Financial Extension Tokens (Additive)
| Token Name | Value | Usage |
|---|---|---|
| `--gain` | `#5a9e6f` | Credits, positive deltas, verified status |
| `--gain-bright` | `#8fc79e` | Bright gain text, 100% confidence |
| `--gain-tint` | `rgba(90, 158, 111, 0.10)` | Stat block backgrounds, positive tag fills |
| `--loss` | `#b8412f` | Debits, negative deltas, error states |
| `--loss-bright` | `#e2765f` | Bright loss text, low match scores |
| `--loss-tint` | `rgba(184, 65, 47, 0.12)` | Negative tag fills, critical alerts |

---

## 2. Typography Tokens

### 2.1 Font Families
- **Display / Hero / Headline:** `'Playfair Display', Georgia, serif` (weights: 700, 900)
- **Body Copy / Annotations:** `'Libre Baskerville', Georgia, serif` (weights: 400, 700, italic)
- **UI Chrome / Navigation / Badges:** `'Barlow Condensed', sans-serif` (weights: 600, 700, 800)
- **Code / Monospace / Data:** `'Geist Mono'` or `'JetBrains Mono', monospace` (weights: 400, 600)

### 2.2 Typography Scale & Tracking
| Class | Font Family | Size | Tracking / Weight |
|---|---|---|---|
| `.t-hero` | Playfair Display | `clamp(4rem, 10vw, 9rem)` | 900, Line-height 0.9 |
| `.t-h1` | Playfair Display | `clamp(2.5rem, 5vw, 4.5rem)` | 900, Line-height 1.1 |
| `.t-h2` | Playfair Display | `clamp(2rem, 4vw, 3.5rem)` | 900, Line-height 1.1 |
| `.t-body` | Libre Baskerville | `1rem` (16px) | 400, Line-height 1.9 |
| `.t-label` | Barlow Condensed | `0.7rem` (11px) | 600, Tracking `0.4em`, Uppercase |
| `.t-stat-number` | Barlow Condensed / Playfair | `2.5rem` (40px) | 800/900, Line-height 1.0 |

---

## 3. Geometry & Spacing Tokens

### 3.1 Strict Geometry Rules
- **Corner Radius:** `0px` (NO rounded corners anywhere — `rounded-none` mandatory).
- **Shadows:** None (`--shadow: none` or soft directional `0 4px 14px rgba(0,0,0,0.3)` only on cards).
- **Borders:** `1px solid rgba(154, 144, 136, 0.12)` default, `rgba(139, 58, 26, 0.25)` warm section borders.
- **Dividers:** `linear-gradient(to right, transparent, rgba(139, 58, 26, 0.4), transparent)` 1px height.
