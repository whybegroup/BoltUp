#!/bin/sh
# Xcode runs script phases with a minimal PATH. expo-configure-project.sh uses bash 3.2 + set -e and
# `export NODE_BINARY=$(command -v node)`, which exits the whole script before .xcode.env is sourced
# when `node` is not on PATH. Patch that line, then run the generated script.
set -e
EXPO_SH="${SRCROOT:?}/Pods/Target Support Files/Pods-Moija/expo-configure-project.sh"
if grep -qF 'export NODE_BINARY=$(command -v node)' "$EXPO_SH" 2>/dev/null; then
  sed -i '' 's/export NODE_BINARY=$(command -v node)/export NODE_BINARY=$(command -v node 2>\/dev\/null || true)/' "$EXPO_SH"
fi
exec /bin/bash "$EXPO_SH"
