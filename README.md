# DYSTORE V10.01

Targeted H.264 4K60 build for Android and PC browsers.

## Modes

### Preserve Source
No video re-encode. It normalizes the MP4 container using the local NoBlur module.

### H.264 High Quality
Uses FFmpeg.wasm + libx264 locally in the browser:
- 3840x2160
- 60 FPS
- H.264 High Profile
- Level 5.2
- yuv420p
- BT.709
- target video bitrate ~57.3 Mbps
- maxrate 57.3 Mbps
- AAC 192 kbps
- MP4 + faststart

This target is based on the measured TheZiess output supplied by the user. It is not claimed to be the exact proprietary encoder settings of TheZiess.

## Important
4K60 H.264 encoding in a phone browser can be very slow and can heat the device. The page processes locally. TikTok can still transcode the uploaded video.
