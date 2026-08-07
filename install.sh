#!/usr/bin/env bash

set -e

INSTALL_DIR=$HOME/.local/bin

if [ ! -d "$INSTALL_DIR" ]; then
  mkdir -p "$INSTALL_DIR"
fi

curl -sSL https://example.com/app -o "$INSTALL_DIR/app"
chmod +x "$INSTALL_DIR/app"

echo "Completed."