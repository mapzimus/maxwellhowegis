"""Local development server with caching disabled.

Plain `python -m http.server` lets the browser cache your JS and data, so edits
often don't show up on reload. This server sends `Cache-Control: no-store`, so
every reload fetches fresh files.

It uses ThreadingHTTPServer so concurrent/keep-alive browser connections never
block each other, and so the port can be reclaimed immediately on restart.

Run it:
    python server.py            # serves this folder on http://localhost:8000
    python server.py 8001       # ...or another port
"""

import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))  # serve the project folder


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        super().end_headers()

    def log_message(self, *args):
        pass  # pythonw.exe has no console; writing to stderr would crash each request


# ThreadingHTTPServer is multi-threaded and sets allow_reuse_address=True, so it
# survives quick restarts and parallel requests.
httpd = http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler)
print(f"Whydah dev server (no-cache, threaded) on http://localhost:{PORT}")
httpd.serve_forever()
