# DYSTORE V9

V9 is a TikTok-ready source preparation build.

Default Preserve Source mode:
- keeps the encoded video stream;
- normalizes the MP4 container;
- does not call 10x sample-table inflation;
- measures the actual output.

HEVC High-Quality mode is deliberately guarded. The browser must have a real HEVC encoder and an MP4 muxer. This build will not fake HEVC metadata or silently create a downgraded file.

Target for a future native-PC encoder:
3840x2160 / 60 CFR / HEVC / high bitrate / MP4 / AAC / faststart.

TikTok may still transcode uploaded videos. V9 cannot disable TikTok's server-side processing.
