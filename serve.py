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
import json
import webbrowser
import threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
OVERRIDES_FILE = os.path.join(DIRECTORY, "overrides.json")
MAX_BODY = 1_000_000  # 1 MB cap on override writes

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

    def do_POST(self):
        # Single tiny API: persist the dashboard's manual edits to overrides.json.
        if self.path.split("?", 1)[0] != "/api/overrides":
            self.send_error(404, "Not found")
            return
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > MAX_BODY:
            self.send_error(413, "Bad size")
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("expected object")
            tmp = OVERRIDES_FILE + ".tmp"
            with open(tmp, "w") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            os.replace(tmp, OVERRIDES_FILE)
        except Exception as e:
            self.send_error(400, f"Bad request: {e}")
            return
        body = b'{"ok":true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

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
