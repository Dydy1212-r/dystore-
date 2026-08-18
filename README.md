# DYSTORE v5 — 4K 60FPS Safe Patch

- Designed for 3840×2160 60FPS source videos.
- No FFmpeg and no video re-encoding.
- No 10× sample-table inflation.
- Preserves the original video/audio samples and timing.
- Processing happens locally in the browser.

The previous DYSTORE Fast Patch used NoBlur sample-table inflation. That technique intentionally inflates the sample table, which can make a 60FPS source be reported by some players as 600FPS. v5 removes that step so the source FPS is preserved.

**Important:** v5 preserves the source FPS; it does not manufacture 60FPS from a non-60FPS source. For a 3840×2160 60FPS input, the output is intended to remain 3840×2160 60FPS without re-encoding.
