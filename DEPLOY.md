# Deploying to GitHub Pages

## Quick Setup (5 minutes)

### 1. Create a GitHub Repository

Go to https://github.com/new and create a new repo:
- **Name:** `maxwellhowegis.com` (or whatever you prefer)
- **Visibility:** Public (required for free GitHub Pages)
- Don't initialize with README — we'll push existing files

### 2. Push This Folder to GitHub

Open a terminal in this folder and run:

```bash
git init
git add .
git commit -m "Initial portfolio site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/maxwellhowegis.com.git
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to your repo on GitHub
2. Settings → Pages (left sidebar)
3. Under "Source", select **Deploy from a branch**
4. Branch: `main`, folder: `/ (root)`
5. Click Save

Your site will be live at `https://YOUR_USERNAME.github.io/maxwellhowegis.com/` within a few minutes.

### 4. Connect Your Custom Domain

1. In your repo's Settings → Pages, enter `maxwellhowegis.com` under "Custom domain"
2. Check "Enforce HTTPS"
3. At your domain registrar (wherever you bought the domain), add these DNS records:

**Option A — A Records (recommended):**
```
Type: A    Name: @    Value: 185.199.108.153
Type: A    Name: @    Value: 185.199.109.153
Type: A    Name: @    Value: 185.199.110.153
Type: A    Name: @    Value: 185.199.111.153
```

**Plus a CNAME for www:**
```
Type: CNAME    Name: www    Value: YOUR_USERNAME.github.io
```

DNS propagation takes 1-24 hours. After that, `maxwellhowegis.com` will serve your new portfolio.

---

## File Structure

```
maxwellhowegis.com/
├── index.html          ← Home page
├── portfolio.html      ← Full project gallery
├── mapzimus.html       ← @Mapzimus page
├── about.html          ← About & skills
├── tools.html          ← Web tools page
├── DEPLOY.md           ← This file (delete before deploying if you want)
├── css/
│   └── style.css       ← All styles
├── js/
│   ├── projects.js     ← Project data (edit this to add/change projects)
│   └── main.js         ← Shared JS (nav, modals, filters, animations)
└── images/
    └── projects/       ← Project screenshots
        ├── central-campus.png
        ├── change-analysis.png
        ├── education.png
        ├── lynn.png
        ├── lynnfield.png
        ├── salem-evacuation.png
        └── salem-pantry.png
```

## How to Add a New Project

1. Open `js/projects.js`
2. Add a new object to the `projects` array:

```js
{
    id: 9,  // next available ID
    title: "Your Project Name",
    category: "Spatial Analysis",
    type: "analysis",  // map, analysis, web, remote, or viz
    tags: ["ArcGIS Pro", "Python"],
    summary: "One sentence summary.",
    description: "Full paragraph description.",
    tools: ["ArcGIS Pro", "Python", "Census ACS"],
    year: "2025",
    course: null,  // or "GPH9XX — Course Name"
    thumb: "images/projects/your-image.png",
    liveUrl: null,  // or "https://..."
    repoUrl: null   // or "https://github.com/..."
}
```

3. Add a screenshot to `images/projects/`
4. Commit and push — GitHub Pages auto-deploys

## How to Add a New Tool

Edit `tools.html` directly — add a new `<div class="tool-card">` block following the existing pattern.

## How to Host an Interactive Map

1. Create a folder like `tools/my-map/`
2. Put your HTML/JS map files inside
3. Add a card to `tools.html` linking to `tools/my-map/index.html`
4. Commit and push
