# DYSTORE V10.03
Android-first client-side 4K60 H.264 build.

Target: 3840x2160 @ 60 FPS, H.264 AVC High (`avc1.640034`), ~57.3 Mbps CBR, 2-second keyframes, MP4 Fast Start, AAC 192 kbps/48 kHz. WebCodecs `prefer-hardware` is requested and the page checks `VideoEncoder.isConfigSupported()` before processing. No processing-server upload in client mode.

Important: `prefer-hardware` is a hint, not a guarantee. Android browser/device support determines whether the configuration is available. TikTok can still transcode after upload.
