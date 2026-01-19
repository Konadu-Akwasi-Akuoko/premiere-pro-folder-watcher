#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RUST_DIR="$PROJECT_DIR/rust-watcher"
BIN_DIR="$PROJECT_DIR/bin"

echo "Building folder-watcher binary..."
echo "Project directory: $PROJECT_DIR"

mkdir -p "$BIN_DIR/mac"
mkdir -p "$BIN_DIR/win"

build_mac() {
    echo ""
    echo "Building macOS binaries..."

    if [[ "$(uname)" != "Darwin" ]]; then
        echo "Skipping macOS build (not on macOS)"
        return
    fi

    echo "Building x86_64-apple-darwin..."
    cargo build --release --target x86_64-apple-darwin --manifest-path "$RUST_DIR/Cargo.toml"

    echo "Building aarch64-apple-darwin..."
    cargo build --release --target aarch64-apple-darwin --manifest-path "$RUST_DIR/Cargo.toml"

    echo "Creating universal binary..."
    lipo -create \
        "$RUST_DIR/target/x86_64-apple-darwin/release/folder-watcher" \
        "$RUST_DIR/target/aarch64-apple-darwin/release/folder-watcher" \
        -output "$BIN_DIR/mac/folder-watcher"

    chmod +x "$BIN_DIR/mac/folder-watcher"

    echo "macOS build complete: $BIN_DIR/mac/folder-watcher"
    ls -lh "$BIN_DIR/mac/folder-watcher"
}

build_windows() {
    echo ""
    echo "Building Windows binary..."

    if ! command -v x86_64-w64-mingw32-gcc &> /dev/null; then
        echo "Warning: mingw-w64 not found, skipping Windows build"
        echo "Install with: brew install mingw-w64"
        return
    fi

    echo "Building x86_64-pc-windows-gnu..."
    cargo build --release --target x86_64-pc-windows-gnu --manifest-path "$RUST_DIR/Cargo.toml"

    cp "$RUST_DIR/target/x86_64-pc-windows-gnu/release/folder-watcher.exe" "$BIN_DIR/win/"

    echo "Windows build complete: $BIN_DIR/win/folder-watcher.exe"
    ls -lh "$BIN_DIR/win/folder-watcher.exe"
}

build_dev() {
    echo ""
    echo "Building development binary (current platform)..."

    cargo build --manifest-path "$RUST_DIR/Cargo.toml"

    if [[ "$(uname)" == "Darwin" ]]; then
        cp "$RUST_DIR/target/debug/folder-watcher" "$BIN_DIR/mac/"
        chmod +x "$BIN_DIR/mac/folder-watcher"
        echo "Dev build: $BIN_DIR/mac/folder-watcher"
    else
        cp "$RUST_DIR/target/debug/folder-watcher.exe" "$BIN_DIR/win/" 2>/dev/null || true
        echo "Dev build: $BIN_DIR/win/folder-watcher.exe"
    fi
}

run_tests() {
    echo ""
    echo "Running tests..."
    cargo test --manifest-path "$RUST_DIR/Cargo.toml"
}

run_clippy() {
    echo ""
    echo "Running clippy..."
    cargo clippy --manifest-path "$RUST_DIR/Cargo.toml" -- -D warnings
}

case "${1:-all}" in
    mac)
        build_mac
        ;;
    win|windows)
        build_windows
        ;;
    dev)
        build_dev
        ;;
    test)
        run_tests
        ;;
    lint)
        run_clippy
        ;;
    all)
        run_tests
        build_mac
        build_windows
        ;;
    *)
        echo "Usage: $0 {mac|win|dev|test|lint|all}"
        echo ""
        echo "Commands:"
        echo "  mac     - Build macOS universal binary"
        echo "  win     - Build Windows binary (requires mingw-w64)"
        echo "  dev     - Build debug binary for current platform"
        echo "  test    - Run tests"
        echo "  lint    - Run clippy"
        echo "  all     - Run tests and build all platforms"
        exit 1
        ;;
esac

echo ""
echo "Done!"
