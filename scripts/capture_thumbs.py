"""Capture project thumbnails at 16:10 (1600x1000) for portfolio site."""
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "images" / "projects"
W, H = 1600, 1000

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

def capture(url: str, out_name: str, wait_ms: int = 2500, wait_selector: str | None = None, click_text: str | None = None, extra_wait_ms: int = 0):
    out_path = OUT / out_name
    print(f"[capture] {url} -> {out_path}")
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    exe = os.environ.get("CHROMIUM_PATH")  # override when the installed browsers don't match the playwright pin
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=exe or None,
                                    proxy={"server": proxy} if proxy else None,
                                    args=["--no-sandbox"] if os.geteuid() == 0 else [])
        ctx = browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=2, user_agent=UA, locale="en-US")
        page = ctx.new_page()
        page.goto(url, wait_until="networkidle", timeout=60000)
        if click_text:
            try:
                btn = page.get_by_text(click_text, exact=False)
                if btn.count() > 0:
                    print(f"  clicking '{click_text}' to wake app...")
                    btn.first.click()
                    page.wait_for_timeout(extra_wait_ms or 15000)
                    page.wait_for_load_state("networkidle", timeout=60000)
            except Exception as e:
                print(f"  (click skipped: {e})")
        if wait_selector:
            try:
                page.wait_for_selector(wait_selector, timeout=20000)
            except Exception as e:
                print(f"  (selector wait skipped: {e})")
        page.wait_for_timeout(wait_ms)
        page.screenshot(path=str(out_path), full_page=False)
        browser.close()
    print(f"  ok: {out_path.stat().st_size:,} bytes")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    if target in ("geopuesto", "all"):
        capture(
            (ROOT / "geopuesto" / "index.html").as_uri(),
            "geopuesto-thumb.png",
            wait_ms=4000,
            wait_selector=".leaflet-tile-loaded",
        )
    if target in ("lynn-data-dive", "lynn", "all"):
        capture(
            "https://maxwellhowegis.com/Lynn-data-dive/maps/",
            "lynn-data-dive-thumb.png",
            wait_ms=6000,
            wait_selector="canvas, .maplibregl-canvas, .leaflet-container, .mapboxgl-canvas",
        )
    if target in ("optitrek", "all"):
        capture(
            (ROOT / "scripts" / "optitrek_card.html").as_uri(),
            "optitrek-thumb.png",
            wait_ms=2500,
            wait_selector="circle.route-node",
        )
    if target in ("transit", "all"):
        # network.json is ~5 MB + a 33k-dot canvas layer — give it time to draw
        capture(
            "https://maxwellhowegis.com/transit/",
            "transit-thumb.png",
            wait_ms=8000,
            wait_selector=".leaflet-tile-loaded",
        )
