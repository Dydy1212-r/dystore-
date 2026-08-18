# DYSTORE V7

DYSTORE V7 is designed around one rule: do not re-encode the user's video in the browser.

## Processing behavior

V7:
- reads the source MP4/MOV locally;
- uses the NoBlur `normalizeContainer` module;
- does not call the 10× `inflateSampleTableVideo()` operation;
- does not resize;
- does not convert H.264 to HEVC or HEVC to H.264;
- does not intentionally change FPS;
- does not intentionally change bitrate;
- outputs an MP4 Blob and downloads that exact Blob.

This means a source that is already 4K/60 HEVC can remain a 4K/60 HEVC stream if the container normalization is compatible with that source.

## Real output measurement

The OUTPUT panel is populated only after processing and reads the processed Blob.

Bitrate:
- If MP4Box exposes a video-track bitrate, that value is shown.
- Otherwise V7 calculates actual average output bitrate as `file size × 8 / duration`.
- It never copies the original input bitrate into the output panel.

## Important limitation

DYSTORE cannot force TikTok to preserve a particular bitrate, resolution, codec, or frame rate after TikTok receives the file. TikTok performs its own server-side processing.

The goal of V7 is to make the file delivered to TikTok as close as possible to the source stream, without browser re-encoding.

## Deploy

Replace the existing:
- index.html
- style.css
- app.js
- README.md

Then commit the changes to GitHub. Vercel can redeploy from the repository.

No video is uploaded to a DYSTORE server by this code.

## Upstream

NoBlur:
https://github.com/irgifebry/NoBlur
