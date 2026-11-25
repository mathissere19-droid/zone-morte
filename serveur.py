# Serveur local du jeu : comme « python -m http.server », mais sans cache
# (sinon le navigateur peut garder une ancienne version du jeu après une mise à jour).
import http.server
import sys


class SansCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8642
http.server.ThreadingHTTPServer(('', port), SansCache).serve_forever()
