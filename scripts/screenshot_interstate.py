"""
Headless screenshot of the Sequential Interstate Challenge page, saved as
images/projects/interstate-challenge-thumb.png for the portfolio card.

Serves the repo over a local http.server, opens the page in
Playwright/Chromium, waits for the basemap tiles + connector layers to
paint, then captures.
"""

from __future__ import annotations

import glob
import http.server
import os
import socketserver
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


def _chromium_executable():
    """Use the env's pre-installed Chromium if present (avoids playwright install)."""
    for pat in ("/opt/pw-browsers/chromium-*/chrome-linux/chrome",
                "/opt/pw-browsers/chromium/chrome-linux/chrome"):
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    return None

ROOT = Path(__file__).resolve().parent.parent
PORT = 8766
OUT_DIR = ROOT / "images" / "projects"
OUT = OUT_DIR / "interstate-challenge-thumb.png"


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_a, **_kw):
        pass


def serve_in_background():
    handler = _QuietHandler
    handler.directory = str(ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    httpd = serve_in_background()
    try:
        time.sleep(0.5)
        url = f"http://127.0.0.1:{PORT}/interstate-challenge/"
        with sync_playwright() as p:
            exe = _chromium_executable()
            browser = p.chromium.launch(headless=True, executable_path=exe) if exe \
                else p.chromium.launch(headless=True)
            ctx = browser.new_context(viewport={"width": 1600, "height": 1000},
                                      device_scale_factor=2)
            page = ctx.new_page()
            print(f"Loading {url}")
            page.goto(url, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(5000)  # basemap tiles + connector layers
            page.screenshot(path=str(OUT), full_page=False)
            browser.close()
        print(f"Saved {OUT} ({OUT.stat().st_size // 1024} KB)")
    finally:
        httpd.shutdown()
        httpd.server_close()


if __name__ == "__main__":
    main()
