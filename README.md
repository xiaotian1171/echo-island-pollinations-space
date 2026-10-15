---
title: Echo Island
emoji: 🪸
colorFrom: blue
colorTo: yellow
sdk: static
app_file: index.html
pinned: false
---

# Echo Island · a duplicate-friendly Pollinations Space

**Live Space:** https://huggingface.co/spaces/xiaotian1171/echo-island-pollinations-space

One tiny character idea becomes an original scene, an illustrated portrait, and a spoken voice note with synchronized word highlighting. A static Space visitors can duplicate and personalize without maintaining a server, a shared billing key, or any build pipeline.

[![Made with pollinations.ai](https://raw.githubusercontent.com/pollinations/pollinations/main/packages/ui/src/brand/badge-made-with.svg)](https://pollinations.ai/?ref=badge)

## Duplicate it

On Hugging Face, choose **⋯ → Duplicate this Space**. No secrets or owner API key are required: each visitor signs in with **Bring Your Own Pollen**, approves their own budget, and pays for their own requests. The callback URL is computed from the duplicated Space's current URL rather than being hard-coded. The default consent screen shows the Space's hostname when no publishable App Key is configured.

A static Space runs inside a Hugging Face iframe on a `.static.hf.space` origin. OAuth may not complete inside that embed; use the **Open the studio** link to open the running Space directly in a new tab, then connect there. The app handles blocked third-party storage gracefully. Nothing is sent to a Space backend.

## Make it your own

- In `config.js`, replace the public **model IDs**, not API keys. Text, image and speech models must support their corresponding endpoints; see [live models](https://gen.pollinations.ai/models).
- Adjust the character prompt in `app.js` and colors in `style.css`.
- Change the Space title, emoji, and metadata at the top of this README.
- All files are static. On your own computer, run `python3 -m http.server 8080` and visit `http://localhost:8080`.

## Privacy and cost

The browser redirect flow is documented in [Bring Your Own Pollen](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md). Sign-in validates `state`, receives the user-authorized key in a URL fragment, immediately removes that fragment, and keeps the token only in session storage. It is sent as an Authorization header **only** to `gen.pollinations.ai`; never put it in source code, the README, logs, or screenshots. Disconnect removes the saved token. The consent request limits models to text, image and audio, asks for a 5 Pollen budget and seven-day expiry; the user can modify/revoke their grant.

One story call uses `openai/gpt-5.4-nano`, a portrait uses `black-forest-labs/flux.1-schnell`, and a voice note with timing uses `elevenlabs/eleven-flash-v2.5`. When an account only has free-tier Pollen (where timestamped ElevenLabs speech is unavailable), the studio automatically falls back to free `openai/tts-1` speech on `/v1/audio/speech` (and browser speech synthesis as a last resort) so visitors still hear the character aloud without word highlighting. If the image fails, the illustrated placeholder remains.

**GitHub Pages preview:** https://xiaotian1171.github.io/echo-island-pollinations-space/
