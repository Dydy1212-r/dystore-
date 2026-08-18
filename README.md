# DYSTORE V10

Mobile + PC build.

Preserve Source:
- local browser processing
- no video re-encode
- keeps source encoded stream
- normalizes MP4 container
- works on phones and PCs with a modern browser

HEVC High-Quality:
- checks for a REAL WebCodecs HEVC encoder
- does not fake codec metadata
- does not claim success when HEVC MP4 muxing is unavailable

A real browser HEVC encoder alone is not enough: encoded HEVC frames still need a correct MP4 muxer. V10 therefore refuses to output a fake HEVC file.

TikTok can still transcode uploaded videos.
