#!/usr/bin/env python3
"""
Tiny local server for the Job Search Dashboard.

Why this is needed: browsers block JavaScript `fetch()` of local files when a
page is opened directly via file://. Serving the folder over http://localhost
makes the dashboard's auto-refresh (polling data.json) work.

Usage:
    python3 serve.py            # serves on http://localhost:8000 and opens it
    python3 serve.py 9000       # custom port

Stop with Ctrl+C.
"""
import http.server
import socketserver
import sys
import os
import webbrowser
import threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Never serve these over HTTP, even though they live in the folder.
BLOCKED = {"credentials.json", "token.json", ".sync_state.json"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def _is_blocked(self):
        name = os.path.basename(self.path.split("?", 1)[0]).lower()
        return name in BLOCKED

    def do_GET(self):
        if self._is_blocked():
            self.send_error(404, "Not found")
            return
        super().do_GET()

    def do_HEAD(self):
        if self._is_blocked():
            self.send_error(404, "Not found")
            return
        super().do_HEAD()

    def end_headers(self):
        # Never cache data.json, so every poll sees the latest sync.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, *args):
        pass  # quiet


def main():
    url = f"http://localhost:{PORT}/job-dashboard.html"
    try:
        httpd = socketserver.TCPServer(("", PORT), Handler)
    except OSError as e:
        print(f"Could not start server on port {PORT}: {e}")
        print(f"Another process may be using it. Try: python3 serve.py {PORT + 1}")
        sys.exit(1)
    with httpd:
        print(f"Job Search Dashboard serving at:\n    {url}\n")
        print("Auto-refresh is live — the page polls data.json on your chosen interval.")
        print("Keep this running. Press Ctrl+C to stop.")
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
