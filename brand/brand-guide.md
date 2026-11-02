# Roomset brand guide

Version 1.0 · 2 November 2026 · Proposed system around the user-supplied logo.

## Brand idea
Warm Habitat. A thoughtful interior-planning companion that turns a furniture decision into something a person can explore. Calm, grounded, useful and quietly optimistic. The logo supplied by the user is authoritative; the supporting palette, type system and applications are proposals, informed by the existing local design direction.

**Primary tagline:** Make room for what fits.
**Product descriptor:** An editable 3D furniture planner for your space.
**Supporting line:** See the possibilities. Arrange with confidence.
Use Roomset in prose and roomset only in the supplied wordmark. Do not recreate the wordmark by typing it in a similar font.

## Logo
assets/logo/roomset-logo-original.png is the unmodified user-provided master, 2172 × 724 px (3:1). Its background is opaque warm ivory with subtle texture; the green structure and terracotta sofa are part of the approved image. The PNG is not a vector or transparent master.

Preserve the whole image, original proportions and colors. Do not stretch, crop, recolor, add shadows, trace automatically, or separate its symbol from the wordmark. The image already includes whitespace: retain it, plus at least 0.1 image-height outside the bounds. Recommended minimum complete-image width is 180 CSS px / 45 mm. For a small mobile header use 180–210 px; use text “Roomset” as an accessible home label if space is insufficient. Do not shrink the full lockup into a favicon.

Use the original on a warm ivory/paper panel. On a forest cover, place it inside an ivory panel with generous space. Do not use CSS multiply to fake transparency. A transparent logo, icon-only lockup and true vector master require a separate approved derivative; none is claimed in this package. SVG files here are supporting artwork/icons, not vector versions of the logo.

## Color
| Token | Hex | Role |
|---|---|---|
| Ivory | #F7F4ED | Primary canvas, spacious backgrounds |
| Paper | #FFFCF6 | Cards, input surfaces |
| Forest | #273D32 | Headings, body ink, primary actions, selected geometry |
| Terracotta | #C66B48 | Furniture illustration, accents, decorative emphasis |
| Clay text | #A65030 | Accessible warm links and warning copy on ivory |
| Sage | #929B80 | Secondary illustration and large decorative fields |
| Linen | #D8D3C7 | Dividers and nonessential surfaces |
| Muted text | #5C665B | Secondary text on light surfaces |
| Error | #9D3E35 | Errors with a text explanation and icon |

Use roughly 70% ivory/paper, 20% forest/neutral structure and 10% warm/sage accents as a compositional starting point. These colors are supporting design tokens, not an exact pixel extraction of the textured logo. Do not use small ivory/white text on terracotta, or sage/linen as small text on ivory. Use forest text on light surfaces and ivory text on forest buttons. Contrast calculations are in theme/contrast-report.json; they are not an accessibility certification.

## Typography
Use Cormorant Garamond 500 for editorial headlines and DM Sans 400/500/600 for body text, labels, numbers and controls. This continues the local prototype direction. Never use the display serif for measurements, form labels or warnings.

Desktop: hero 64/1.05, section 40/1.15, subsection 28/1.2. Mobile: hero 42/1.1 and section 32/1.15. Body: 16/1.6, lead 20/1.5, label 14/1.4, caption 13/1.5. Keep reading lines around 55–75 characters; avoid all-caps paragraphs. Use tabular numbers for dimensions. Bundled font files include their SIL Open Font License texts; theme/fonts.css loads local assets. Body fallback: Arial/sans-serif; display fallback: Georgia/serif. Verify glyph coverage when adding languages.

## Layout and shape
Use a 4 px spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96. Mobile side padding: 24 px; desktop: 48 px; content maximum: 1200 px. Controls are at least 48 px high. Radius: 10 px controls, 16 px cards and 24 px bottom sheets. Prefer fine rules and broad negative space over many floating cards. Restrict shadows to elevated sheets; the room canvas can fill the available space.

## Product design language
One primary action per step. Keep dimensions and source confirmation close together. Use short helper text for “Approximate room” and “Dimensioned model.” Show field labels above inputs, inline errors below them, and a persistent return path. Avoid decorative chat bubbles when a form or clear control is easier.

The editor prioritizes the room, then fixed furniture dimensions, then move/rotate/reset/save controls. Provide labeled buttons as alternatives to touch gestures. Use pointer capture and floor-constrained dragging in implementation. Avoid accidental orbit/drag conflicts. At reduced motion, remove decorative transitions. Normal feedback duration is 140 ms and panel transitions 220 ms; do not animate furniture after release.

Selection uses a forest outline plus a labeled state. Unknown surfaces use a dashed/hatch treatment and “Not captured”; do not color them as clear space. Overlap uses an icon, outline and explicit message, not color alone. Approximate clearance is shown only for calibrated geometry and always described as an estimate. Never confuse a visually appealing render with measured evidence.

## Imagery and graphics
Use warm natural light, realistic materials, uncluttered corners and a human-height camera for future photography. Keep geometry legible; avoid extreme wide-angle views or exaggerated luxury imagery. Do not invent customer photos. Obtain consent and avoid personal documents in home imagery.

assets/illustrations/room-corner.svg is a new, editable concept illustration. It is not a reconstruction result or an exact sofa model. floor-grid.svg is a repeating background motif; keep its contrast low. UI icons use a 24 px viewBox, 1.7 px rounded strokes and forest color. Icons are supporting UI symbols, never replacement brand marks. Use visible labels or accessible names for actionable icons.

## Voice and copy
Write with warmth and specificity. Say what a person needs to do next. “Confirm the sofa dimensions” is better than “Initialize product geometry.” Say “Add one measurement to estimate clearances” rather than “AI measured your room.” Avoid claims such as perfect fit, exact digital twin, instant reconstruction, every store or guaranteed accuracy.

Recommended primary CTA: Plan my space. Intake: Add a sofa link. Capture: Photograph your corner. Clarification: Help us set the scale. Result: Try another arrangement. Save confirmation: Layout saved. Blocked listing: We could not read this page. Upload a screenshot or enter the details.

## Assets and provenance
The supplied logo is copied byte-for-byte. Fonts originate from installed @fontsource packages with licenses preserved. UI icons and room/grid SVGs are newly authored supporting graphics. Social cards and pitch covers are editable HTML compositions exported as PNG. Their depicted room is illustrative and is labeled accordingly.

assets/archive contains the old prototype mark, room artwork and tokens for reference only. The old mark is not the current logo; provenance and rights of the old room artwork were not independently established. Do not publish archived artwork without checking its origin. No third-party customer, retailer or sponsor assets are included.

## Implementation
Copy the brand folder with its relative structure. Import theme/roomset.css, use the CSS variables and rs-button/rs-input/rs-card/rs-badge classes, and reference the local logo. The token JSON uses the same palette and dimensions. Keep the original logo at its 3:1 ratio. Open preview.html for the visual system, components and downloads; it works as a local document without a build step. Templates are standalone relative HTML sources, not a deployed website.

## Release checks
Confirm the right logo, preserve whitespace, review text contrast, inspect narrow layouts, provide keyboard focus, label uncertain geometry and verify the rights of any added product photography. The included UI is a styling specimen, not a connected application. No hosted integration, consumer research or accessibility conformance is implied.
