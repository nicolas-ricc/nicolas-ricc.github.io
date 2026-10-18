#!/usr/bin/env bash
# Prepares a fresh clone of this repository for the factory agent.
# Runs as root inside the factory container, in the repository root, before
# the agent starts. If it fails, the run fails.
set -euo pipefail

# The runner image has node 22 and npm; the lockfile pins everything else.
npm ci --no-audit --no-fund

# content/blog.generated.json is gitignored and imported by src/main.ts, so
# tsc and vite need it. The feed script writes an empty list if the blog RSS
# is unreachable, so this never fails on network alone.
npm run feed

# PixiJS DevTools para agent-browser (ver CLAUDE.md). Es opcional: si falla la
# red o falta un descompresor, el run sigue sin la extensión.
install_pixi_devtools() {
  local dest="${HOME}/.agent-browser/extensions/pixijs-devtools"
  local url="https://github.com/pixijs/devtools/releases/download/v2.3.1/chrome.zip"
  local tmp
  [ -f "$dest/ext/manifest.json" ] && return 0
  tmp="$(mktemp -d)"
  curl -fsSL "$url" -o "$tmp/chrome.zip" || return 1
  if command -v unzip >/dev/null; then
    unzip -q "$tmp/chrome.zip" -d "$tmp"
  elif command -v python3 >/dev/null; then
    python3 -I -m zipfile -e "$tmp/chrome.zip" "$tmp"
  else
    return 1
  fi
  mkdir -p "$dest" && rm -rf "$dest/ext" && mv "$tmp/dist/chrome" "$dest/ext" && rm -rf "$tmp"
}
install_pixi_devtools || echo "aviso: no se pudo instalar PixiJS DevTools; agent-browser sigue sin la extensión" >&2
