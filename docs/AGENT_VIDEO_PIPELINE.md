# AGENT Video — narrative production pipeline (Preview only)

Scope: **Premieros/agent** / **dev/multifile-work-engine-20261020** / `/video`.
No other repository, Supabase project, production environment or paid service is modified.

## Current working local workflow
1. Write an Arabic story and choose mode, fixed cast and exact scene count.
2. Upload a portrait for each recurring actor (browser only) and storyboard backgrounds.
3. Download the **scene generation plan JSON**: per-shot reference actor ID,
   continuity prompts for stills and *real motion*, exact start/end and Arabic voice cue sheets.
   This is a provider-agnostic handoff and **does not generate AI video**.
4. Once clips have been produced and reviewed **outside AGENT**, upload the motion
   clip for each scene. The browser renders those actual moving frames on a canvas,
   with titles/subtitles and available portraits as fallback when there is no clip.
5. **Record Arabic dialogue directly for each scene** with the per-scene microphone button (or upload separate audio files), ideally voiced by the assigned
   recurring character, or record/upload an overall narration. During export scene audio
   is mixed at its scene start and clipped at the scene boundary; optional original
   ambient music can play underneath. Preview voice synthesis uses browser voices only
   and is not recorded into the rendered file.
6. The session JSON now saves cast details, scene-to-character links, production mode and episode number (compatible with legacy v2). Media itself stays private and must be re-uploaded after re-opening. Short source clips loop within their assigned scene rather than freeze. Export audio is scheduled only after recording begins.\n7. Export WebM/MP4 according to MediaRecorder browser support; download SRT, timing
   manifest, credits, character bible and local project JSON. Export happens in real
   time and needs an open tab. Listen to and review the downloaded file.

## MetaBatch and provider assessment
MetaBatch was mentioned in a screenshot, but the screenshot and verifiable developer
documentation / a public official API contract are **not present in this workspace**.
No API, programmatic usage terms, pricing or automation entitlement is assumed.
Treat MetaBatch as manual/experimental only until its official integration documentation,
terms, supported reference-image conditioning, Arabic audio support and billing are
verified. Do not scrape the UI or embed a browser session / unverified endpoints.

## Production readiness and cost gates
**Not active:** text-to-image, image-to-video, persistent media storage, AI TTS,
lip-sync, automatic long-running render jobs, voice cloning, direct YouTube posting.

Enabling any provider requires: provider selection; verified official API; user consent
to upload portraits and dialogues; price per image, second, generation and retries;
moderation, consent and intellectual-property checks; safe secret storage; cancellation
and spend caps; asynchronous job/result storage owned exclusively by AGENT; real end-to-end
test of cast continuity and Arabic dialogue. Charges are **unknown**, not zero.
Provider outputs must be checked manually for identity, mouth movement, continuity,
licensing, allowed publication and audio timing before final publishing.

**Privacy:** local portraits, uploaded dialogue and motion clips are never automatically
uploaded to a provider or written to a Supabase database. A saved JSON project and the
provider handoff do not embed private media; reload uploads after refreshing.

**Rendering constraints:** browser MediaRecorder may only support WebM. Input motion clips
can fail to decode, cannot automatically deliver their own audio into Canvas.captureStream,
and should have independently supplied dialogue tracks. Real video is available only for
shots with uploaded moving source clips; otherwise visual fallback remains a still/image
sequence. CI validates code and build, but does not prove playback or lip-sync in a browser.

## Verified provider constraint (October 22, 2026)
The connected Runway workspace currently exposes no usable video generation models on its Free plan. Its existing image/voice credits do not unlock video generation without changing the plan. AGENT has not used these credits, transmitted cast media, or activated a paid plan. This is not proof of a MetaBatch API.

## Image creation engine (Preview, inside /video)

AGENT now has a **working image engine** for scene storyboards:

- **Free local mode (default):** draw an original illustrated cinematic/noir/comic keyframe as a real PNG directly in Canvas, from Arabic scene prompts. It uses deterministic scenery keywords (city, interiors, sea, gardens and desert), light, depth, and optional *exact* private character reference photo. The same uploaded portrait is composited across scenes without changing identity. The image is added to the matching clip and can be downloaded as a PNG; a single action produces images for all scenes. No model training, diffusion, server upload, external API, subscription, or hidden bill. These are **illustrations, not AI photorealistic pictures**.
- **Optional real AI mode:** OpenAI gpt-image-1 and Gemini gemini-2.5-flash-image via the project's existing tested provider adapter. Users supply their own API key in session memory and explicitly check a **per-image cost acknowledgement**. Key/scene descriptions are sent through a same-origin AGENT server request to the selected provider, never saved in files, DB or logs. The server must NOT reuse its existing OPENAI_API_KEY or Gemini key. Exactly one image request is made per click, no retries or batch image generation. Costs depend on the user's provider/account, and must be reviewed there before enabling. Real paid generation was **not invoked during development or CI**.
- Privacy and identity: in real AI mode **only character descriptions, not reference portraits** are sent; therefore identical AI-generated faces across episodes cannot be guaranteed. Local mode uses the exact private uploaded portrait and has stable facial identity. To gain AI face consistency a separately approved reference-image edit workflow would be required.
- No file is automatically posted to YouTube or sent to a database. Media created in the browser is not embedded in saved JSON and must be regenerated or re-uploaded after restore. Provider results must be reviewed for appropriateness and publication rights.
- AGENT browser CI uses a mocked AI endpoint to test the explicit-consent request contract without provider charges; it also generates and verifies a real PNG. Tests do not claim real-provider acceptance of a key or account access.
