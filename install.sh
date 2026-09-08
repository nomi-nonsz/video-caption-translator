#!/usr/bin/env bash

set -e

INSTALL_DIR=$HOME/.local/bin
APP_NAME=video-caption-translator
BASE_URL=https://github.com/nomi-nonsz/video-caption-translator/releases/download

OS="idk"
ARCH="idk"

echo "Started $APP_NAME install script."

if [ ! -d "$INSTALL_DIR" ]; then
  mkdir -p "$INSTALL_DIR"
fi

OS_CHECK="$(uname -s)"
case "$(uname -s)" in
  Linux*) OS="linux";;
  Darwin*) OS="macos";;
  *)
    echo "Unsupported OS: $OS_CHECK"
    echo "Sorry :("
    exit 1
    ;;
esac

ARCH_CHECK="$(uname -m)"
case "$ARCH_CHECK" in
  x86_64 | amd64) ARCH="amd64";;
  arm64) ARCH="arm64";;
  *)
    echo "Unsupported architecture: $ARCH_CHECK"
    echo "Sorry :("
    exit 1
    ;;
esac

FULL_URL="$BASE_URL/latest/$APP_NAME-$OS-$ARCH"

echo "Downloading $APP_NAME-$OS-$ARCH..."

curl -sSL "$FULL_URL" -o "$INSTALL_DIR/$APP_NAME"
chmod +x "$INSTALL_DIR/$APP_NAME"

echo "Completed ✔"

if [[ -f "$INSTALL_DIR/$APP_NAME" ]]; then
  echo "Stored at $INSTALL_DIR/$APP_NAME"
  echo "If the terminal can't find the app, try to add this in your shell configuration (.bashrc, .zshrc, etc.):"
  echo ""
  echo "  export PATH="\$HOME/.local/bin:\$PATH""
fi