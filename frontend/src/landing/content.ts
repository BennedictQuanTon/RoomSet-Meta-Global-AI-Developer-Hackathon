// All landing page copy and data. Statuses must stay truthful: move an item to "Working" only after it runs.

export type Status = "Working" | "Testing" | "Next";

export const NAV_LINKS = [
  ["Problem", "#problem"],
  ["Approach", "#approach"],
  ["Features", "#features"],
  ["Stack", "#stack"],
  ["Compare", "#compare"],
  ["Team", "#team"],
] as const;

export const HERO_SLIDES = [
  { src: "/landing/hero-1.jpg", label: "Room 01 / Sample sofa", alt: "A pale fabric sofa in an old sunlit room with a brick-red floor" },
  { src: "/landing/hero-2.jpg", label: "Room 02 / Sample sofa", alt: "The same sofa in front of a white tiled fireplace" },
  { src: "/landing/hero-3.jpg", label: "Room 03 / Sample sofa", alt: "A dark leather sofa in a bright room with a pale wood floor" },
  { src: "/landing/hero-4.jpg", label: "Room 04 / Sample sofa", alt: "A sofa on a tiled floor in a warm, empty house" },
];

export const STATS = [
  {
    value: "62%",
    text: "of furniture shoppers find it hard to picture how a piece will look at home.",
    source: "3D Cloud / Provoke Insights",
    href: "https://www.furnituretoday.com/technology/3d-cloud-release-study-linking-3d-visualization-and-customer-satisfaction",
  },
  {
    value: "60%",
    text: "say they have bought furniture online that turned out to be the wrong size.",
    source: "Interiors Monthly",
    href: "https://interiorsmonthly.co.uk/shoppers-expect-furniture-stores-to-pay-for-buy-try-return/",
  },
  {
    value: "19–23%",
    text: "is the reported return rate for furniture bought online.",
    source: "Eightx benchmark",
    href: "https://eightx.co/blog/average-furniture-and-home-return-rate-benchmarks",
  },
];

export const STEPS = [
  {
    number: "01",
    title: "Start with the real sofa",
    body: "Paste a listing or type the size from it. You confirm width, depth and height. Anything missing stays missing until you fill it in.",
  },
  {
    number: "02",
    title: "Show us the corner",
    body: "Take three to six overlapping photos or one short video. Blurry, dark and duplicate shots get flagged with a specific retake.",
  },
  {
    number: "03",
    title: "Build the room",
    body: "Your measurements and answers build a simple floor, walls and obstacles. Turning the photos directly into geometry is the piece we are building next.",
  },
  {
    number: "04",
    title: "Move it until it works",
    body: "Drag and rotate a model held to the confirmed size. See what it overlaps and how much room is left, then save the layout that works.",
  },
];

export const FEATURES: { title: string; body: string; status: Status; image: string; alt: string }[] = [
  { title: "True to size", body: "The sofa model always matches the width, depth and height you confirmed, however you move it.", status: "Working", image: "/landing/f-size.jpg", alt: "Front view of a pale sofa" },
  { title: "Drag and rotate", body: "Move it across the floor by touch or mouse. Dragging runs in the browser and costs no model call.", status: "Working", image: "/landing/f-move.jpg", alt: "A sofa turned at an angle in an empty room" },
  { title: "Overlap and clearance", body: "See when it hits a wall or radiator, and how far it sits from the nearest known object.", status: "Working", image: "/landing/f-clearance.jpg", alt: "A sofa close to a wall and window" },
  { title: "Layouts that stay", body: "Save an arrangement and come back to it. Reloading restores it without building anything again.", status: "Working", image: "/landing/f-save.jpg", alt: "A sofa turned toward a window, seen from a standing height" },
  { title: "Guided capture", body: "Plain instructions for each shot, with checks for blur, darkness and duplicates as you go.", status: "Working", image: "/landing/f-capture.jpg", alt: "An empty corner of a room with a window" },
  { title: "Honest labels", body: "Estimated, assisted and approximate are always marked. Space we have not seen is never shown as free.", status: "Working", image: "/landing/f-labels.jpg", alt: "Close view of a sofa's carved frame and fabric" },
  { title: "Private by default", body: "Location data is stripped from photos, sessions are isolated, and one tap deletes everything.", status: "Working", image: "/landing/f-private.jpg", alt: "Light falling through a window in an empty room" },
  { title: "Any sofa", body: "Manual entry already works with any listing. Automatic reading of a pasted link is built and being tested on real shops.", status: "Testing", image: "/landing/f-any.jpg", alt: "A dark leather sofa in a bright room" },
];

export const ROADMAP: { title: string; body: string; status: Status }[] = [
  { title: "Style previews", body: "Ask for a look, such as warm Japandi, and see your current view restyled by Muse Image. Decoration only; size still comes from the plan.", status: "Testing" },
  { title: "AI questions about your photos", body: "Muse Spark reads the photos and asks about the boundaries, obstacles and orientation it finds unclear.", status: "Testing" },
  { title: "Photos to 3D", body: "VGGT recovers cameras, depth and points from your photos, so walls and floor come from the room itself.", status: "Next" },
  { title: "Object segmentation", body: "SAM picks out furniture and obstacles in the photos.", status: "Next" },
  { title: "Your sofa's real shape", body: "SAM 3D Objects could rebuild the listed product instead of using a sample shape held to its size.", status: "Next" },
];

export const STACK: { layer: string; tool: string; role: string; status: Status }[] = [
  { layer: "Interface", tool: "React, TypeScript, Vite", role: "Phone-first product flow", status: "Working" },
  { layer: "3D editor", tool: "Three.js", role: "Dragging, rotation, views and placement checks", status: "Working" },
  { layer: "API", tool: "FastAPI", role: "Sessions, guarded uploads, background builds", status: "Working" },
  { layer: "Geometry", tool: "trimesh, Blender", role: "Room and sofa assets held to real dimensions", status: "Working" },
  { layer: "Storage", tool: "Postgres, S3 API", role: "Private session data and files", status: "Working" },
  { layer: "Reading", tool: "Muse Spark Open on Baseten", role: "Listings, photos and useful questions", status: "Testing" },
  { layer: "Rendering", tool: "Muse Image on Meta Model API", role: "Style previews on request", status: "Testing" },
  { layer: "Reconstruction", tool: "VGGT on Modal", role: "Cameras, depth and points from photos", status: "Next" },
  { layer: "Segmentation", tool: "SAM 3.1 on Meta Model API", role: "Objects in the room", status: "Next" },
];

export const COMPARE_COLUMNS = ["Roomset", "IKEA Kreativ", "Wayfair View in Room", "Planner 5D", "RoomGPT"];

export const COMPARE_ROWS: { label: string; cells: string[] }[] = [
  { label: "Which furniture", cells: ["Any sofa you can get the size of", "IKEA range", "Wayfair range", "Its own catalog", "Generated, not a chosen product"] },
  { label: "Your room comes from", cells: ["Your measurements. Photos next", "A scan in the IKEA app", "A photo or live camera", "A plan you draw", "One photo"] },
  { label: "Real product size", cells: ["Yes, confirmed by you", "Yes", "Yes", "Yes", "No"] },
  { label: "Move it afterwards", cells: ["Yes, in 3D", "Yes", "Yes", "Yes, in 3D", "No, generate again"] },
  { label: "Shows overlap and clearance", cells: ["Yes", "Not its focus", "Not its focus", "By eye, against your plan", "No"] },
  { label: "Runs in a phone browser", cells: ["Yes", "Scanning needs the app", "Needs the app", "Web and app", "Yes"] },
];

export const COMPARE_NOTE =
  "Based on public product pages and reviews read in November 2026. These products change, so check them before relying on this table.";

export const TEAM = [
  { name: "Huỳnh Khánh Tường", role: "Software engineering", focus: "Product flow, backend, hosting and submission", github: "khanhtuongnakitomo" },
  { name: "Long Quan (Bennedict) Ton", role: "AI and 3D engineering", focus: "Photo analysis, reconstruction, geometry and the 3D editor", github: "BennedictQuanTon" },
];
