# Serveur local du jeu : comme « python -m http.server », mais sans cache
# (sinon le navigateur peut garder une ancienne version du jeu après une mise à jour)
# et en IPv4 + IPv6 (« localhost » peut passer par l'un ou l'autre).
import http.server
import socket
import sys


class SansCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()


class DoublePile(http.server.ThreadingHTTPServer):
    address_family = socket.AF_INET6

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8642
print(f'Zone Morte : http://127.0.0.1:{port}/ (laisser cette fenêtre ouverte)', flush=True)
DoublePile(('::', port), SansCache).serve_forever()
