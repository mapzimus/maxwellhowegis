import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(repoRoot, "src", "portfolio");
const assetRoot = path.join(repoRoot, "assets", "portfolio");
const siteUrl = "https://maxwellhowegis.com";

function assertInsideRepo(target) {
  const resolved = path.resolve(target);
  if (resolved !== repoRoot && !resolved.startsWith(repoRoot + path.sep)) {
    throw new Error(`Refusing to write outside repository: ${resolved}`);
  }
  return resolved;
}

function ensureDir(directory) {
  fs.mkdirSync(assertInsideRepo(directory), { recursive: true });
}

function write(target, contents) {
  ensureDir(path.dirname(target));
  fs.writeFileSync(assertInsideRepo(target), contents, "utf8");
}

function read(relativePath) {
  return fs.readFileSync(path.join(sourceRoot, relativePath), "utf8");
}

function loadProjects() {
  const source = read(path.join("js", "data", "projects.js"));
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.V2_DATA.projects;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

function description(value) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 177).trim()}…` : clean;
}

function absoluteImage(project) {
  if (!project?.thumb) return `${siteUrl}/images/projects/ma-atlas-preview.png`;
  if (/^https?:\/\//.test(project.thumb)) return project.thumb;
  return `${siteUrl}/${project.thumb.replace(/^\//, "")}`;
}

function structuredData({ title, summary, canonical, project }) {
  const data = project
    ? {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: title,
        description: summary,
        url: canonical,
        image: absoluteImage(project),
        author: {
          "@type": "Person",
          name: "Maxwell Howe",
          url: siteUrl,
        },
        keywords: project.tags || [],
      }
    : {
        "@context": "https://schema.org",
        "@type": "Person",
        name: "Maxwell Howe",
        url: siteUrl,
        jobTitle: "Web GIS Developer and Spatial Analyst",
        email: "mailto:mhowe.gis@gmail.com",
        sameAs: [
          "https://github.com/mapzimus",
          "https://www.linkedin.com/in/maxwell-howe-1a88a3298/",
        ],
      };
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}

function promoteHtml(html, { title, summary, canonical, image, project, slug }) {
  let out = html
    .replace(/\s*<meta name="robots"[^>]*>/gi, "")
    .replace(/<title>.*?<\/title>/is, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*">/i,
      `<meta name="description" content="${escapeHtml(summary)}">`,
    )
    .replaceAll('href="favicon.svg"', 'href="/assets/portfolio/favicon.svg"')
    .replaceAll('href="css/', 'href="/assets/portfolio/css/')
    .replaceAll('src="js/', 'src="/assets/portfolio/js/');

  if (slug) {
    out = out.replace("<body>", `<body data-project-slug="${escapeHtml(slug)}">`);
  }

  const seo = [
    `    <link rel="canonical" href="${canonical}">`,
    '    <meta property="og:type" content="website">',
    `    <meta property="og:title" content="${escapeHtml(title)}">`,
    `    <meta property="og:description" content="${escapeHtml(summary)}">`,
    `    <meta property="og:url" content="${canonical}">`,
    `    <meta property="og:image" content="${image}">`,
    '    <meta name="twitter:card" content="summary_large_image">',
    `    <meta name="twitter:title" content="${escapeHtml(title)}">`,
    `    <meta name="twitter:description" content="${escapeHtml(summary)}">`,
    `    <meta name="twitter:image" content="${image}">`,
    `    <script type="application/ld+json">${structuredData({ title, summary, canonical, project })}</script>`,
  ].join("\n");

  return out.replace("</head>", `${seo}\n</head>`);
}

function redirectPage(destination, title = "Page moved") {
  const safe = escapeHtml(destination);
  const canonical = destination.startsWith("/") ? `${siteUrl}${destination}` : destination;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0; url=${safe}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <title>${escapeHtml(title)}</title>
</head>
<body><p>This page moved to <a href="${safe}">${safe}</a>.</p></body>
</html>\n`;
}

function buildCompatibilityPage(projects) {
  const routes = Object.fromEntries(
    projects.map((project) => {
      if (["featured", "graduate", "additional"].includes(project.tier)) {
        return [project.slug, `/work/${project.slug}/`];
      }
      if (project.visibility === "mapzimus") {
        return [project.slug, "https://mapzimus.com/"];
      }
      const live = project.links?.live;
      return [project.slug, live && !/^https?:\/\//.test(live) ? `/${live.replace(/^\//, "")}` : (live || "/work/")];
    }),
  );
  const encoded = JSON.stringify(routes).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Project moved — Maxwell Howe</title></head>
<body><p id="message">Finding the new project page…</p><script>
const routes=${encoded};const id=new URLSearchParams(location.search).get('id');const target=routes[id]||'/work/';
document.getElementById('message').innerHTML='This project moved to <a href="'+target+'">'+target+'</a>.';location.replace(target);
</script></body></html>\n`;
}

function build() {
  const projects = loadProjects();

  assertInsideRepo(assetRoot);
  if (fs.existsSync(assetRoot)) fs.rmSync(assetRoot, { recursive: true, force: true });
  ensureDir(assetRoot);
  fs.cpSync(path.join(sourceRoot, "css"), path.join(assetRoot, "css"), { recursive: true });
  fs.cpSync(path.join(sourceRoot, "js"), path.join(assetRoot, "js"), { recursive: true });
  fs.copyFileSync(path.join(sourceRoot, "favicon.svg"), path.join(assetRoot, "favicon.svg"));

  const pages = [
    {
      source: "index.html",
      output: path.join(repoRoot, "index.html"),
      title: "Maxwell Howe — Web GIS Developer & Spatial Analyst",
      summary: "Web GIS developer and spatial analyst in Salem, Massachusetts. Interactive maps, spatial data products, and reproducible analysis built for people to use.",
      canonical: `${siteUrl}/`,
      image: `${siteUrl}/images/projects/ma-atlas-preview.png`,
    },
    {
      source: "work.html",
      output: path.join(repoRoot, "work", "index.html"),
      title: "Work — Maxwell Howe",
      summary: "Ten selected Web GIS, spatial analysis, and data-product case studies by Maxwell Howe.",
      canonical: `${siteUrl}/work/`,
      image: `${siteUrl}/images/projects/ma-atlas-preview.png`,
    },
    {
      source: "about.html",
      output: path.join(repoRoot, "about", "index.html"),
      title: "About — Maxwell Howe",
      summary: "Maxwell Howe is a Web GIS developer, spatial analyst, and math educator in Salem, Massachusetts.",
      canonical: `${siteUrl}/about/`,
      image: `${siteUrl}/images/projects/ma-atlas-preview.png`,
    },
    {
      source: "contact.html",
      output: path.join(repoRoot, "contact", "index.html"),
      title: "Contact — Maxwell Howe",
      summary: "Contact Maxwell Howe about Web GIS, spatial analysis, mapping, and geospatial development work.",
      canonical: `${siteUrl}/contact/`,
      image: `${siteUrl}/images/projects/ma-atlas-preview.png`,
    },
  ];

  for (const page of pages) {
    write(page.output, promoteHtml(read(page.source), page));
  }

  const caseStudies = projects.filter(
    (project) => project.kind === "project" && ["featured", "graduate", "additional"].includes(project.tier),
  );
  const projectTemplate = read("project.html");
  for (const project of caseStudies) {
    const canonical = `${siteUrl}/work/${project.slug}/`;
    const summary = description(project.summary);
    write(
      path.join(repoRoot, "work", project.slug, "index.html"),
      promoteHtml(projectTemplate, {
        title: `${project.title} — Maxwell Howe`,
        summary,
        canonical,
        image: absoluteImage(project),
        project,
        slug: project.slug,
      }),
    );
  }

  const redirects = new Map([
    ["portfolio.html", "/work/"],
    ["work.html", "/work/"],
    ["about.html", "/about/"],
    ["contact.html", "/contact/"],
    ["gallery.html", "https://mapzimus.com/maps/"],
    ["tools.html", "https://mapzimus.com/tools/"],
    ["side-projects.html", "https://mapzimus.com/lab/"],
    ["mapzimus.html", "https://mapzimus.com/"],
    ["games/index.html", "https://mapzimus.com/games/"],
    ["nsn.html", "/work/ebay-packages/"],
    ["feedback.html", "/contact/"],
    ["links.html", "/about/"],
    ["fieldnotes.html", "https://mapzimus.com/field-notes/"],
  ]);
  for (const [file, destination] of redirects) {
    write(path.join(repoRoot, file), redirectPage(destination));
  }
  write(path.join(repoRoot, "project.html"), buildCompatibilityPage(projects));

  const v2Redirects = new Map([
    ["index.html", "/"],
    ["work.html", "/work/"],
    ["about.html", "/about/"],
    ["contact.html", "/contact/"],
    ["gallery.html", "https://mapzimus.com/maps/"],
    ["tools.html", "https://mapzimus.com/tools/"],
    ["play.html", "https://mapzimus.com/games/"],
    ["ventures.html", "/about/"],
    ["links.html", "/about/"],
    ["fieldnotes.html", "https://mapzimus.com/field-notes/"],
  ]);
  for (const [file, destination] of v2Redirects) {
    write(path.join(repoRoot, "v2", file), redirectPage(destination));
  }
  write(path.join(repoRoot, "v2", "project.html"), buildCompatibilityPage(projects));

  const sitemapUrls = new Set([
    `${siteUrl}/`,
    `${siteUrl}/work/`,
    `${siteUrl}/about/`,
    `${siteUrl}/contact/`,
    ...caseStudies.map((project) => `${siteUrl}/work/${project.slug}/`),
  ]);
  for (const project of projects) {
    // Demoted apps (visibility "mapzimus") stay hosted but leave the professional sitemap.
    if (!["featured", "graduate", "additional"].includes(project.tier)) continue;
    if (project.visibility === "mapzimus") continue;
    const live = project.links?.live;
    if (live && !/^https?:\/\//.test(live)) {
      const normalized = live.startsWith("/") ? live : `/${live}`;
      sitemapUrls.add(`${siteUrl}${normalized}`);
    }
  }
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...sitemapUrls].sort().map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}
</urlset>\n`;
  write(path.join(repoRoot, "sitemap.xml"), sitemap);
  write(
    path.join(repoRoot, "robots.txt"),
    `User-agent: *\nAllow: /\nDisallow: /src/\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
  );

  console.log(`Built portfolio: ${pages.length} primary pages, ${caseStudies.length} case studies.`);
}

build();
