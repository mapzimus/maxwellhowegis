#!/usr/bin/env python3
"""Build additions for bivariate mode:
  1) New 3x3 bivariate palettes (blend method + two published schemes),
     emitted as JS-ready arrays + an SVG swatch preview of ALL palettes.
  2) Fresh curated metric-pair candidates mined from all_correlations.csv,
     excluding the 18 pairs already shipped and trivial/same-construct pairs.
Run from repo root: python3 scripts/analysis/build_bivar_additions.py
"""
import json, csv, os, re

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

# ── existing palettes (for the preview) ──────────────────────────────────────
EXISTING = {
    "Pink × Blue":      ["#e8e8e8","#b0d5df","#64acbe","#e4acac","#ad9ea5","#627f8c","#c85a5a","#985356","#574249"],
    "Green × Blue":     ["#e8e8e8","#b8d6be","#73ae80","#b5c0da","#90b2b3","#5a9178","#6c83b5","#567994","#2a5a5b"],
    "Purple × Orange":  ["#e8e8e8","#e4c0a8","#c8865d","#c0a4c2","#a98876","#8e6e57","#7b4f88","#6a4974","#4a3a47"],
}

# ── two well-established published schemes (Observable/d3 bivariate set) ──────
PUBLISHED = {
    "Purple × Teal":  ["#e8e8e8","#ace4e4","#5ac8c8","#dfb0d6","#a5add3","#5698b9","#be64ac","#8c62aa","#3b4994"],
    "Purple × Gold":  ["#e8e8e8","#e4d9ac","#c8b35a","#cbb8d7","#c8ada0","#af8e53","#9972af","#976b82","#804d36"],
}

def hex2rgb(h): h=h.lstrip("#"); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def rgb2hex(t): return "#%02x%02x%02x" % tuple(max(0,min(255,round(c))) for c in t)

def blend_palette(darkA, darkB, low="#e8e8e8"):
    """Bivariate 3x3 via the biscale-style blend: build a light->dark sequential
    ramp for each axis, then average the two ramps per cell. index = tA*3 + tB,
    [0,0]=low/low light corner, [2,2]=both-high (darkest)."""
    lo = hex2rgb(low)
    dA, dB = hex2rgb(darkA), hex2rgb(darkB)
    # 3-step ramps from the light corner to each dark hue
    def ramp(dark):
        return [tuple(lo[i] + (dark[i]-lo[i])*t/2 for i in range(3)) for t in range(3)]
    rA, rB = ramp(dA), ramp(dB)
    cells = []
    for tA in range(3):
        for tB in range(3):
            # average the two axis colors; deepen the high/high corner a touch
            mix = tuple((rA[tA][i] + rB[tB][i]) / 2 for i in range(3))
            if tA == 2 and tB == 2:
                mix = tuple(c*0.82 for c in mix)
            cells.append(rgb2hex(mix))
    cells[0] = low
    return cells

# darkA = the metric-A (rows) hue at high; darkB = metric-B (cols) hue at high
CONSTRUCTED = {
    "Red × Green":    blend_palette("#c1483a", "#3a8c4f"),
    "Blue × Yellow":  blend_palette("#33548c", "#c9a227"),
    "Teal × Magenta": blend_palette("#2f8f8a", "#b6418f"),
}

ALL = {**EXISTING, **PUBLISHED, **CONSTRUCTED}
NEW = {**PUBLISHED, **CONSTRUCTED}

# ── SVG preview of every palette ─────────────────────────────────────────────
def svg_preview(palettes, path):
    cell, gap, pad, label_h, col_w = 34, 3, 16, 22, 230
    cols = 2
    rows = (len(palettes) + cols - 1) // cols
    grid_w = cell*3 + gap*2
    block_w = col_w
    block_h = label_h + cell*3 + gap*2 + pad
    W = pad + cols*(block_w) + pad
    H = pad + rows*block_h + pad
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="Inter,Arial,sans-serif">']
    out.append(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
    items = list(palettes.items())
    for idx,(name,colors) in enumerate(items):
        r,c = divmod(idx, cols)
        ox = pad + c*block_w
        oy = pad + r*block_h
        new_tag = " (new)" if name in NEW else ""
        out.append(f'<text x="{ox}" y="{oy+13}" font-size="13" font-weight="600" fill="#0A1F44">{name}{new_tag}</text>')
        gy = oy + label_h
        # render with [0,0] bottom-left like the legend: row 0 = high A on top
        for visual_row in range(3):           # 0=top
            tA = 2 - visual_row                # top row is high A
            for tB in range(3):
                col = colors[tA*3 + tB]
                x = ox + tB*(cell+gap)
                y = gy + visual_row*(cell+gap)
                out.append(f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" fill="{col}" stroke="#ddd" stroke-width="0.5"/>')
    out.append('</svg>')
    open(path,"w").write("\n".join(out))

svg_preview(ALL, os.path.join(HERE, "preview_palettes.svg"))

# JS-ready arrays for the NEW palettes
print("=== NEW palette JS arrays ===")
keymap = {"Purple × Teal":"purpleteal","Purple × Gold":"purplegold",
          "Red × Green":"redgreen","Blue × Yellow":"blueyellow","Teal × Magenta":"tealmagenta"}
for name,colors in NEW.items():
    arr = ",".join(f'"{c}"' for c in colors)
    print(f'    {keymap[name]}: {{ name: "{name}", colors: [{arr}] }},')

# ── mine all_correlations.csv for new metric pairs ───────────────────────────
print("\n=== fresh metric-pair candidates (not already shipped, non-trivial) ===")
used = set()
pre = json.load(open(os.path.join(HERE,"correlation_presets.json")))
for p in pre["expected"]+pre["surprising"]:
    used.add(frozenset((p["metricA"], p["metricB"])))

rows = list(csv.DictReader(open(os.path.join(HERE,"all_correlations.csv"))))
def num(x):
    try: return float(x)
    except: return None
cand = []
for r in rows:
    if r["trivial"].lower() in ("true","1"): continue
    if r["cross_cat"].lower() not in ("true","1"): continue
    a,b = r["metricA"], r["metricB"]
    if frozenset((a,b)) in used: continue
    n = num(r["n"]); pr = num(r["pearson"]); sp = num(r["spearman"])
    if n is None or n < 80 or pr is None: continue
    cand.append((a,b,r["labelA"],r["labelB"],r["catA"],r["catB"],pr,sp,int(n)))

# de-dup mirrored pairs, keep the strongest representative
seen=set(); uniq=[]
for c in sorted(cand, key=lambda x:-abs(x[6])):
    k=frozenset((c[0],c[1]))
    if k in seen: continue
    seen.add(k); uniq.append(c)

print("\n-- STRONG (|r|>=0.6), cross-category, for 'expected'-style adds --")
for c in [u for u in uniq if abs(u[6])>=0.6][:25]:
    print(f'  {c[6]:+.2f} r / {c[7]:+.2f} rho / n={c[8]:>3}  [{c[4]} × {c[5]}]  {c[0]} × {c[1]}  ::  {c[2]} × {c[3]}')

print("\n-- INTERESTING WEAK / NEGATIVE (0.15<=|r|<=0.45) for 'surprising' adds --")
weak=[u for u in uniq if 0.15<=abs(u[6])<=0.45]
for c in weak[:35]:
    print(f'  {c[6]:+.2f} r / {c[7]:+.2f} rho / n={c[8]:>3}  [{c[4]} × {c[5]}]  {c[0]} × {c[1]}  ::  {c[2]} × {c[3]}')
