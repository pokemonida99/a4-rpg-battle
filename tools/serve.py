"""不快取的小伺服器（改了 js 重新整理就生效）：python3 tools/serve.py [port]"""
import sys, os, http.server, socketserver
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass
socketserver.ThreadingTCPServer.allow_reuse_address = True
socketserver.ThreadingTCPServer(('', int(sys.argv[1]) if len(sys.argv) > 1 else 4630), H).serve_forever()
