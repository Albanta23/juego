#!/bin/bash
# Game Arcade - Start Server
cd "$(dirname "$0")/web"
PORT=${1:-8080}
echo "Starting Game Arcade on http://localhost:$PORT"
python3 -m http.server "$PORT" &
echo "PID: $!"
