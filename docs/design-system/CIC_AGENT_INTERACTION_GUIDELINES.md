# Cast Iron Charlie Design System — Agent Interaction & Generation Guidelines

**Version:** 1.0.0  
**Source of Truth:** `sorensencc-dotcom/castironcharlie` / `Toolforge Design System Audit`  
**Classification:** Agent Behavior & Code Generation Constraints  

---

## 1. Absolute Directives for Agents

1. **Never Invent Off-Palette Hex Values:**
   - All colors must map to the 10 canonical tokens (`--black`, `--forge`, `--iron`, `--rust`, `--ember`, `--brass`, `--ash`, `--bone`, `--paper`, `--white`) or the financial extension (`--gain`, `--loss`).
   - Flagged violation from audit: Do NOT create custom hex colors like `#D85A24` (drifted ember) or `#D98324` (off-palette timeout).

2. **Always Link Canonical CSS Bundle:**
   - Do NOT duplicate `:root` blocks in HTML files.
   - Always link `colors_and_type.css` or the bundled package `_ds/cast-iron-charlie-design-system-*/`.

3. **Zero Border Radius:**
   - Enforce `rounded-none` / `border-radius: 0` on every card, modal, button, tag, and form input.

4. **Consistent Focus States:**
   - Always set `outline-offset: 2px` on focus-visible elements.

5. **Atmospheric Contrast Over Black-on-Black:**
   - Contrast surfaces step-by-step: canvas `#0d0a08` $\rightarrow$ card `#1a1410` $\rightarrow$ raised `#241c16` $\rightarrow$ borders `rgba(154, 144, 136, 0.16)`.
   - Never place raw `#0a0806` cards on a `#0a0806` background without borders.
