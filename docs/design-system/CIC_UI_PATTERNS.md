# Cast Iron Charlie Design System — UI Patterns (CICDS)

**Version:** 1.0.0  
**Source of Truth:** `sorensencc-dotcom/castironcharlie` / `Toolforge Design System Audit`  
**Classification:** Canonical Pattern Specification  

---

## 1. Core Component Patterns

### 1.1 Section Eyebrow Label
```css
.section-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 0.65rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--ember);
  display: flex;
  align-items: center;
  gap: 1rem;
}
.section-label::after {
  content: '';
  flex: 1;
  max-width: 60px;
  height: 1px;
  background: var(--ember);
}
```

### 1.2 Pull Quotes & Stat Blocks
```css
.stat-block {
  border-left: 3px solid var(--ember);
  padding: 1.25rem 1.5rem;
  background: rgba(139, 58, 26, 0.06);
}
/* Financial variant */
.stat-block.gain {
  border-left-color: var(--gain);
  background: var(--gain-tint);
}
.stat-block.loss {
  border-left-color: var(--loss);
  background: var(--loss-tint);
}
```

### 1.3 Ghost Watermark
```css
.ghost-watermark {
  position: absolute;
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 900;
  color: rgba(139, 58, 26, 0.05);
  pointer-events: none;
  line-height: 1;
  z-index: 0;
  user-select: none;
}
```

### 1.4 Status & Tag Badges
```css
.tag-badge {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 0.25rem 0.6rem;
  border: 1px solid;
  border-radius: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.tag-high { color: var(--ember); border-color: rgba(196,80,26,0.45); background: rgba(196,80,26,0.07); }
.tag-new  { color: var(--brass); border-color: rgba(184,146,42,0.45); background: rgba(184,146,42,0.07); }
.tag-live { color: var(--gain); border-color: rgba(90,158,111,0.4); background: var(--gain-tint); }
```

---

## 2. Interactive States & Controls

### 2.1 Buttons
- **Primary CTA (`.btn-primary`):** `background: var(--ember); color: var(--black); font-weight: 700; text-transform: uppercase; letter-spacing: 0.3em;`
- **Secondary CTA (`.btn-secondary`):** Border-bottom 1px solid `rgba(196, 80, 26, 0.3)`, text `var(--ember)`, hovers to `var(--white)`.
- **Zero Radius:** Strictly `0px` radius on all interactive elements.

### 2.2 Focus Rings
- Standard focus ring for keyboard navigation: `outline: 2px solid var(--ember); outline-offset: 2px;` (Never negative offset).
