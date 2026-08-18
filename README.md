# DYSTORE v3

DYSTORE v3 adds two output modes:

1. Standard MP4
   - Uses FFmpeg.wasm in the browser.
   - H.264 video + AAC audio.
   - yuv420p pixel format.
   - `+faststart` MP4 layout.
   - Metadata is stripped to reduce compatibility issues.
   - This mode re-encodes the video, so quality/file size can change.

2. Fast Patch
   - Uses the upstream NoBlur container patch.
   - No video re-encode.
   - Keeps original video bytes/quality.
   - This mode can be less compatible with platforms that reject unusual container metadata.

Use Standard MP4 first when TikTok/another platform rejects the Fast Patch output.

No video is uploaded to a DYSTORE server by this code. Processing occurs in the browser.

References:
- https://github.com/irgifebry/NoBlur
- https://ffmpeg.org/
