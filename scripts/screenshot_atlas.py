"""
Headless screenshot of the MA Education Atlas, saved as
images/projects/ma-atlas-preview.png.

Runs a local http.server in a background thread, opens the atlas in
Playwright/Chromium with a viewport sized for the portfolio card aspect
ratio, waits for tiles to load, then captures.
"""

from __future__ import annotations

import http.server
import socketserver
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8765
OUT_DIR = ROOT / "images" / "projects"
OUT = OUT_DIR / "ma-atlas-preview.png"


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_a, **_kw):
        pass


def serve_in_background():
    handler = _QuietHandler
    handler.directory = str(ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    httpd = serve_in_background()
    try:
        time.sleep(0.5)
        url = (f"http://127.0.0.1:{PORT}/ma-atlas/"
               "#level=district&metric=grad_4yr&palette=Viridis&classify=jenks")
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(viewport={"width": 1600, "height": 900},
                                       device_scale_factor=2)
            page = ctx.new_page()
            print(f"Loading {url}")
            page.goto(url, wait_until="networkidle", timeout=60000)
            # Give MapLibre + GeoJSON layers a chance to paint
            page.wait_for_timeout(4500)
            page.screenshot(path=str(OUT), full_page=False)
            browser.close()
        print(f"Saved {OUT} ({OUT.stat().st_size // 1024} KB)")
    finally:
        httpd.shutdown()
        httpd.server_close()


if __name__ == "__main__":
    main()
