// ===== FIELD NOTES =====
// In-progress work, project writeups, and short observations.
// No fixed tone — a 200-word note sits next to a 3,000-word piece, and
// the tags tell the reader what they're walking into.
//
// Tag conventions (extend as needed):
//   build     — something I shipped or am shipping
//   research  — historical, academic, source-driven
//   teaching  — math/education materials
//   data      — datasets, pipelines, exploration
//   note      — short observation, no claim of completeness
//   whydah    — Whydah pirate ship research
//   gis       — GIS / cartography / spatial analysis
//   geometry  — math, geometry, spherical / spatial reasoning
//
// Entries are sorted newest-first by `date` (YYYY-MM-DD) at render time.

const fieldNotes = [
    {
        id: 1,
        slug: "orthodromes",
        date: "2026-05-24",
        title: "Orthodromes & Antipodal Geometry",
        tags: ["build", "research", "geometry"],
        summary: "What if any city on Earth were the North Pole? Every point on a sphere has a unique \"personal equator\" — the orthodrome (great circle) perpendicular to the axis through that point and its antipode. This is a research-and-explainer companion to Geopuesto: it walks through spherical geometry from first principles, traces the concept's long history in cartography and astronomy (formally: the antipodal equatorial orthodrome, used since Ptolemy's \"oblique sphere\" and behind every oblique Mercator projection), and lets you draw any city's personal equator on a 3D globe.",
        readingTime: "interactive · ~15 min read",
        dashboardUrl: "/geopuesto/great-circles/", // TODO: confirm path in geopuesto submodule
        externalLabel: "Open the dashboard"
    }
];
