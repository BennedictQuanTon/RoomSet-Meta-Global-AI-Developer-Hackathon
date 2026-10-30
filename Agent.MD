# Roomset — agent context

Phone-first web app for the Meta Global AI Developer Hackathon. A person photographs a room, taps one piece of furniture (or names it), and sees that object replaced in place. Everything outside the selected object stays the original photo. The end of the flow is a before/after slider and a shopping list of real items similar to the result.

This file is the project brief for agents working in this repo. It records decisions, verified API behavior, and limits. It does not contain API keys, redemption links, or credentials. Those stay in the local `.env`, which is gitignored.

Last verified against live calls and docs on 29–30 October 2026. Where a number comes from a secondary writeup of the event waiver rather than a page fetched that day, it is marked as such.

## Current state

- Local folder: `d:\Code\Project\Meta-hack`
- GitHub: https://github.com/khanhtuongnakitomo/RoomSet (public, created 27 October 2026)
- Application code does not exist yet. The product described below is the intended build, not implemented behavior.
- Participant: Huỳnh Khánh Tường (`khanhtuongnakitomo`).
- Deadline: project submission **9:00 PM ET, Wednesday 4 November 2026**, which is **9:00 AM Thursday 5 November 2026** in Vietnam (ICT, UTC+7). After 1 November 2026, US Eastern time is EST (UTC−5).

## Product

**Who it is for.** Renters and small-space dwellers decorating without a designer, and small furniture sellers who need lifestyle shots of items they cannot afford to photograph staged.

**The firsthand problem.** Mentally placing a sofa into a room you cannot picture exactly. Online home and furniture return rates are high because the item does not match the listing. Existing AI room tools regenerate the whole image, so walls warp and windows move. The product requirement is to change one object and keep every other pixel of the source photo.

**What a session does.**

1. Capture one wide photo.
2. Segment furniture. Selection is a tap or a short text phrase such as "the sofa".
3. Read the scene and write edit constraints: lighting direction, color palette, perspective, floor contact.
4. Regenerate the selected object only (for example a walnut boucle sofa or a matte-black desk).
5. Composite that result so pixels outside the mask are the untouched source photo.
6. Export a before/after slider and a shopping list of similar real items.

**How success is measured.** A benchmark of real room photos with hand-checked furniture masks. Three metrics:

- Pixel identity outside the mask. Goal: more than 95% of non-target pixels unchanged. This is achieved by compositing, not by asking the image model to behave.
- Style adherence, scored by a vision-language model.
- Blind human preference against a naive full-image regeneration of the same photo.

Latency goal: under 10 seconds per edit. That fights the default Muse Image path, which reasons and may search the web before it renders. Use low reasoning for previews.

**The seam is the real technical bet.** A sofa's contact shadow, reflection, and overlap with the floor sit outside the object mask. Pasting only inside the mask keeps the room honest and can leave the new sofa floating. A dilated mask, or a second pass only for the contact shadow, is the design problem. Do not claim pixel identity and a grounded sofa without deciding how shadows are handled.

**Not chosen yet.** Indie versus startup track. Web framework. Where the shopping catalog comes from (a generated search query is enough for a demo; a real retailer catalog is separate work). Whether the 100-photo benchmark is finished or a smaller hand-checked set is the submission evidence.

## Hackathon

Source for dates, tracks, and themes: https://dev.meta.ai/events/global-hackathon (fetched 29 October 2026).

- Virtual, ten days, started 26 October 2026 with the kickoff. Workshops and office hours run 27 October–4 November. Judging 4–8 November. Closing ceremony and live finals 9 November.
- Two tracks, one project in one track. Indie: creativity, technical ambition, and whether it works. Startup: technical execution and whether it holds up in production. Indie teams are up to four people.
- Roomset is Theme 1, "bring the models into a domain you know firsthand." Theme 2 is frontier work on software, robotics, manufacturing, energy, materials, and physical systems. Do not reframe Roomset as Theme 2.
- Build with Muse Spark, Muse Image, and SAM 3.1 through Meta Model API, Meta open-weight models, and Muse Code.

Scoring weights below are from the event waiver as summarized before the hackathon by a secondary writeup, not from the event page itself. Official rules were due before 26 October 2026 and override this if they differ.

| Weight | Criterion |
|---|---|
| 30% | Impact: who it helps, whether people would use it |
| 25% | Use of Meta's AI tools, beyond a basic integration |
| 25% | Working demo, including the demo video |
| 20% | Technical depth and execution |

Anticipated prize pool from that same waiver summary: $1,000,000. Startup track about $550,000 (top prize $250,000). Indie track about $400,000 (top prize $150,000). Bonus prizes up to $50,000, separate from the track prizes. Treat these as anticipated, not confirmed by the event page.

Record the demo video before the final day. The demo that matters is one wide photo, a tap, a visible mask, a composited swap, and a before/after slider where the window has not moved.

## Architecture that matches the APIs

The pitch line "Muse Image regenerates only inside the mask" is not what the API does. Build the pipeline below.

1. **SAM 3.1** (`sam-3.1`) returns a box and a pixel mask. A text prompt is one concrete noun phrase per request ("sofa", not a list). A tap is a point or box prompt, which the segmentation docs support. Several furniture types means several requests. Docs: https://dev.meta.ai/docs/media-segmentation
2. **Muse Spark** reads the photo and returns text: constraints and the edit instruction. It does not paint pixels. Hosted model for this is `muse-spark-1.3`. The open-weight bulk worker is Baseten's hackathon model, below.
3. **Muse Image** (`muse-image-1.0`) edits from a text prompt and optional reference images. `POST /v1/images/edits` returns **400** if you send `mask`, `input_fidelity`, or `partial_images`. `size` sets aspect ratio only. The returned image is the generator's own resolution and will not line up pixel-for-pixel with the phone photo. Default `reasoning_strength` is `high`. Web search, image search, and code execution are on unless disabled. `low` is a single pass and is the preview setting. Price does not change with reasoning strength: $0.01 per successful image. Docs: https://dev.meta.ai/docs/image-generation
4. **Composite in our code.** Align the generated image to the source, then copy generated pixels only inside the SAM mask. Outside the mask, copy the original photo. That composite is what makes ">95% of non-target pixels unchanged" true.
5. **Shopping list** is a retrieval step. Spark can write the query. No catalog is connected.

Open-weight models do not make the preview images. Muse Spark Open (816B total, about 42B active) and Muse Glimmer (30B) accept images and return text. Fireworks, Baseten, and Modal host Muse Spark Open for that. The only image generator in this stack is Muse Image on Meta Model API.

Muse Code is the terminal coding agent (`irm https://dev.meta.ai/install.ps1 | iex` on Windows). It is for building the app, not for the furniture-edit loop. Do not spend `muse-wonder-1.0` on every edit. Wonder is $4 / $20 per million input/output tokens and is for long coding work.

## Accounts and how to spend them

Three accounts are already granted. Keys live only in local `.env` as `MUSE_API` and `BASETEN_API`. Never print them, commit them, or paste them into this file.

### Meta Model API — $150 free credits

Dashboard showed **$150.00 free credits** and a **0** paid balance on 29 October 2026. While free credits are in use, content may be used for product improvement. Base URL `https://api.meta.ai/v1`. Auth: `Authorization: Bearer` the `MUSE_API` value.

| Model | Role in Roomset | Price (docs, 29 Oct 2026) |
|---|---|---|
| `sam-3.1` | Masks from a tap or a noun phrase | $2.50 per 1,000 images. Video is $0.20 per 1,000 frames, minimum 50 frames. 3,000 RPM |
| `muse-image-1.0` | The furniture swap | $0.01 per successful image. Built-in search is included. 150 RPM. `n` images cost `n` times |
| `muse-spark-1.3` | Scene reading and edit instructions when the hosted model is required | $1.25 / $4.25 per million input/output tokens. Cached input $0.15. 3,000 RPM, 4,000,000 TPM |
| `muse-spark-1.3-contributor` | Same, cheaper, content may train future models | $0.10 / $0.20 per million tokens. 150 RPM |
| `muse-wonder-1.0` | Coding-agent work only | $4 / $20 per million tokens |

$150 spent only on images is 15,000 renders. SAM is a fraction of a cent per photo. Keep `n` at 1. Prefer Baseten for bulk scene reads so this balance stays on SAM and Muse Image.

### Baseten — hackathon Muse Spark Open

OpenAI-compatible chat completions at `https://inference.baseten.co/v1`. The hackathon key works only with model **`meta-models/muse-spark-open-1026`**. The public slug `meta-models/muse-spark-open` is a different name and this key will not call it.

Muse Spark Open reads text, images, audio, and video and writes text. Vision limits on the public model: 8 images per request, 10 MB per image, 2 videos, 300 seconds. Public token price, if billed, matches hosted Spark: $1.25 input, $0.15 cached input, $4.25 output per million tokens. The quickstart does not state the remaining hackathon allowance.

It always reasons. A one-word reply still spent 289 reasoning tokens. If `max_tokens` is 64, `content` comes back null and `finish_reason` is `length`. Give the call several hundred tokens of room, then read `message.content`. The reasoning trace is in `reasoning_content` and should not be shown to the user.

Use it for furniture lists, lighting and perspective constraints, edit prompts, and vision-language scoring of the benchmark.

### Modal — $100, not usable from this machine yet

Approved by email on or before 29 October 2026 for being among the first 1,000 applicants. Credits last for the hackathon and cover Meta open-weight models on Modal Endpoints, plus serverless GPUs, sandboxes, and training. The redemption form in that email has not been completed here: no `modal` CLI and no `~/.modal.toml` as of 30 October 2026. Do not commit the redemption link. It is limited and was marked do-not-share.

After redemption, two modes exist (https://modal.com/docs/guide/endpoints):

- **Shared endpoint:** per-token. Muse Spark Open is listed at the same $1.25 / $4.25 rate. Do not spend the $100 calling the model Baseten already serves.
- **Your own GPU or sandbox:** billed while the machine runs, and it can scale to zero. This is the Modal job: batch the benchmark, run the composite, or a short training run. Muse Glimmer 30B is a dedicated-endpoint model. A GPU left running will consume the $100. Modal's supported-model table lists Glimmer as text input.

Docs: https://modal.com/docs/guide/intro and https://modal.com/docs/guide/supported-models

### Split the work this way

1. SAM on Meta turns the tap, or "the sofa," into a mask.
2. Baseten `meta-models/muse-spark-open-1026` reads the photo and writes constraints. Cap output so reasoning cannot swallow the answer.
3. Muse Image on Meta makes one new sofa. `reasoning_strength: low` and tools off for previews. `high` only for a final.
4. Our composite, on Modal once credits are redeemed if the batch needs a machine, pastes the masked region onto the original photo.
5. Muse Wonder and Muse Code stay on building the repository, not on the edit loop.

## Calls already made

These were smoke tests, not product calls. No image was generated and SAM was not called.

**Baseten, 29 October 2026.** `POST https://inference.baseten.co/v1/chat/completions` with `meta-models/muse-spark-open-1026` and the prompt "Reply with exactly the word pong and nothing else."

- `max_tokens: 64` → `content` null, `finish_reason` `length`, 61 reasoning tokens, about 12 seconds. Prompt tokens 155, of which 128 were cached.
- `max_tokens: 512` → `content` exactly `pong`, `finish_reason` `stop`, about 8 seconds. Completion tokens 300, reasoning tokens 289.

**Meta Model API, 29 October 2026.** `POST https://api.meta.ai/v1/responses` with `muse-spark-1.3`, `reasoning.effort` `low`, same prompt.

- `max_output_tokens: 64` → status `incomplete`, no text. Output tokens 64, reasoning tokens 62. About 7 seconds.
- `max_output_tokens: 400` → status `completed`, message text `pong`. Input tokens 18, output tokens 115, reasoning tokens 105. About 8 seconds.

**Modal, 29 October 2026.** Not called. CLI missing and no local Modal login.

## Working rules for this repo

- Do not commit `.env`, credentials, or the Modal redemption link. `.gitignore` already excludes `.env`.
- Do not send a mask to Muse Image. Composite after generation.
- Do not use Fireworks, Baseten, or Modal as the image generator. They do not host Muse Image.
- Do not set a tiny output-token cap on either Spark. Reasoning consumes it and the answer is empty.
- Do not default Muse Image to `n` greater than 1 or to `reasoning_strength: high` for previews.
- Preserve source pixels outside the chosen mask, including alignment when the generated image's pixel size differs from the phone photo.
- The shopping list must point at real items. A pretty render the person cannot buy misses the stated goal.
- Official hackathon rules, if they differ from the waiver summary above, win.
