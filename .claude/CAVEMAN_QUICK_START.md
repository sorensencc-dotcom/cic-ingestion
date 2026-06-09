# 🪨 Caveman Quick Start

Caveman is installed and ready to use in Claude Code!

## Activate Caveman

Pick one:

### Option 1: Slash Command
```
/caveman
```

### Option 2: Natural Language
Just say:
- "caveman mode"
- "talk like caveman"
- "compress your responses"

---

## What Happens When Active

✓ All responses use simplified, efficient language
✓ 🪨 Rock emoji appears in statusline (shows mode is on)
✓ ~65-75% fewer tokens per response
✓ Full technical accuracy maintained

---

## Using Compression in Code

The `CavemanCompressor` module is ready in your autonomy engine:

```typescript
import { compressAutonomyOutput } from './CavemanCompressor';

const { signals, proposals, stats } = compressAutonomyOutput(
  detectedSignals,
  generatedProposals
);

console.log(`Saved ${stats.reductionPercent}% of tokens`);
```

See `CAVEMAN.md` for full API.

---

## Status

✅ Caveman plugin installed for Claude Code  
✅ Hooks configured (activation, stats, statusline)  
✅ MCP caveman-shrink registered  
✅ CavemanCompressor module in cic-ingestion  
✅ Tests passing  

Ready to go! 🚀
