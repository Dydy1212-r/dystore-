# DYSTORE v2

This version connects the DYSTORE UI to the public NoBlur patch modules.

Flow:
1. Choose MP4/MOV
2. Read metadata locally
3. Normalize the MP4/MOV container
4. Apply NoBlur sample-table inflation (10x)
5. Build a new MP4 Blob
6. Download `*_dystore.mp4`

Important:
- Processing is client-side, not server-side. The original video bytes are not uploaded to DYSTORE.
- This matches the architecture of the upstream NoBlur project, which documents its main patch pipeline as browser-only and zero-reencode.
- The app imports the upstream modules from jsDelivr at runtime.
- If the upstream repository changes its module API, the import may need updating.

Deploy:
Upload `index.html`, `style.css`, and `app.js` to the `dystore` GitHub repo and let Vercel redeploy.

Source:
https://github.com/irgifebry/NoBlur
