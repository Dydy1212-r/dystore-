# DYSTORE V10.02

Client-side, hardware-first H.264 4K60 build.

## Fast Client H.264
Uses Mediabunny's browser conversion pipeline and WebCodecs when the browser/device can encode AVC at 3840x2160@60. The encoder request is:
- H.264 / AVC
- `avc1.640034` (High Profile, Level 5.2)
- 3840x2160
- 60 FPS
- 57.3 Mbps constant target
- keyframe interval 2 seconds
- `hardwareAcceleration: prefer-hardware`
- quality latency mode
- MP4 Fast Start
- AAC 192 kbps / 48 kHz
- no processing-server upload

The browser may choose software instead of hardware even when `prefer-hardware` is requested. The page does not fake codec metadata.

## Preserve Source
Keeps the source media data when possible while packaging a local MP4 output.

## Important
WebCodecs encoding support varies by browser/device. H.264 is broadly supported, but 4K60 encoding capability is not guaranteed. TikTok can still transcode an uploaded file after it reaches TikTok.
