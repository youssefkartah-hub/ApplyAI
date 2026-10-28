#!/bin/bash
# Double-click this file to launch SARAH.
# It grabs the latest version first, then starts the server.
cd "$(dirname "$0")"

BRANCH="claude/app-access-question-qh197n"
echo "Checking for updates..."
if git fetch origin "$BRANCH" 2>/dev/null; then
  git checkout -q "$BRANCH" 2>/dev/null
  if git merge -q --ff-only "origin/$BRANCH" 2>/dev/null; then
    echo "Up to date with the latest version."
  else
    echo "Couldn't fast-forward (local edits?). Launching the version already on disk."
  fi
else
  echo "No connection to GitHub. Launching the version already on disk."
fi

# Free port 8000 if an old copy of the server is still running.
lsof -ti :8000 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

python3 notion_server.py
