"""Локальная эмуляция GitHub Pages: репозиторий /whiteboard/ -> каталог out/."""
import http.server
import os
import sys

OUT = "/home/z/my-project/out"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173


class PagesHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Убираем query string
        path = path.split("?", 1)[0].split("#", 1)[0]
        # /whiteboard/... -> out/... ; / -> out/index.html
        if path.startswith("/whiteboard/"):
            rel = path[len("/whiteboard/"):]
        elif path == "/whiteboard":
            rel = ""
        else:
            rel = path.lstrip("/")
        full = os.path.join(OUT, rel)
        if os.path.isdir(full):
            full = os.path.join(full, "index.html")
        return full

    def guess_type(self, path):
        if path.endswith(".js"):
            return "application/javascript"
        return super().guess_type(path)


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), PagesHandler)
    print(f"serving {OUT} at http://127.0.0.1:{PORT}/", flush=True)
    server.serve_forever()
