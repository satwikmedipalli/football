"""python -m gridiron [fetch|build]"""

import sys

from . import export, fetch

cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
if cmd == "fetch":
    fetch.fetch_all()
elif cmd == "build":
    fetch.fetch_all()
    export.run()
else:
    sys.exit(f"unknown command: {cmd}")
