"""
Project Controls Whiteboard - Local Production Server
Run this script to launch the Whiteboard locally on any OS.
Supports automatic port detection, browser opening, and clean shutdown.
"""

import http.server
import os
import socket
import socketserver
import sys
import threading
import time
import webbrowser

DEFAULT_PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class ReusableThreadingServer(http.server.ThreadingHTTPServer):
    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        super().server_bind()


class WhiteboardHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Add basic caching and security headers
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, format, *args):
        # Clean logging format
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")


def find_available_port(start_port=DEFAULT_PORT, max_attempts=10):
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start_port


def main():
    port = find_available_port(DEFAULT_PORT)
    server_address = ("127.0.0.1", port)

    try:
        httpd = ReusableThreadingServer(server_address, WhiteboardHTTPHandler)
    except Exception as e:
        print(f"[-] Failed to start server on port {port}: {e}", file=sys.stderr)
        sys.exit(1)

    url = f"http://127.0.0.1:{port}"
    print("\n" + "=" * 60)
    print(" [*] Project Controls Whiteboard Server Running")
    print(f" [*] Local URL:  {url}")
    print(" [*] Directory:  " + DIRECTORY)
    print(" [*] Press Ctrl+C to stop the server")
    print("=" * 60 + "\n")

    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    # Open browser automatically after short delay
    time.sleep(0.4)
    webbrowser.open(url)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Stopping server...")
        httpd.shutdown()
        httpd.server_close()
        print("[*] Server stopped cleanly.")
        sys.exit(0)


if __name__ == "__main__":
    main()
