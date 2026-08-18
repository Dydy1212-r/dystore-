# DYSTORE V6

## What changed

DYSTORE V6 is a clean replacement for the previous versions.

### Processing
- Uses the NoBlur `normalizeContainer` module only.
- Does NOT call the 10× `inflateSampleTableVideo()` function.
- Does NOT re-encode the video.
- Does NOT intentionally change resolution.
- Does NOT intentionally change FPS.
- The processed Blob is the file used for output inspection and download.

### Real OUTPUT information

The OUTPUT panel reads the **processed output Blob**, not the original input.

It displays:
- Resolution
- FPS
- Bitrate
- File size
- Format
- Method
- Codec
- Duration
- Audio
- Sample count

### Bitrate note

If MP4Box exposes the video-track bitrate, DYSTORE shows that value.

If MP4Box does not expose it, DYSTORE falls back to:

    output file bytes × 8 ÷ output duration

That fallback is the **actual average bitrate of the whole output file**, not a copied value from the original.

The UI labels this fallback as "Actual output average" so it is not presented as a fake video-track bitrate.

## Important

This version does not promise that TikTok will preserve a source bitrate after TikTok processes the upload. TikTok controls its own server-side transcoding.

DYSTORE's responsibility here is to make sure its own downloaded output is measured honestly and is not intentionally re-encoded by this client.

## Deploy

1. Extract this ZIP.
2. Replace the existing `index.html`, `style.css`, `app.js`, and `README.md` in the `dystore` GitHub repository.
3. Commit the changes.
4. Vercel will redeploy automatically.

## NoBlur

Runtime modules are loaded from:

https://github.com/irgifebry/NoBlur
