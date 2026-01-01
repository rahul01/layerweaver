#!/bin/bash

# Script to install image optimization tools for LayerWeaver website
# This script is for macOS using Homebrew

echo "===== Installing image optimization tools ====="

# Update Homebrew
echo "Updating Homebrew..."
brew update

# Install ImageMagick (for JPG manipulation and conversion)
echo "Installing ImageMagick..."
brew install imagemagick

# Install OptiPNG (for PNG optimization)
echo "Installing OptiPNG..."
brew install optipng

# Install GIFsicle (for GIF optimization)
echo "Installing GIFsicle..."
brew install gifsicle

# Install WebP (for WebP conversion)
echo "Installing WebP tools..."
brew install webp

# Verify installations
echo "===== Verifying installations ====="
echo "ImageMagick: $(command -v convert) - $(convert --version | head -n 1)"
echo "OptiPNG: $(command -v optipng) - $(optipng --version | head -n 1)"
echo "GIFsicle: $(command -v gifsicle) - $(gifsicle --version | head -n 1)"
echo "WebP: $(command -v cwebp) - $(cwebp -version | head -n 1)"

echo "===== All tools installed ====="
echo "You can now run ./compress_images.sh to optimize your images"

# Alternative installation commands for other operating systems:
# 
# UBUNTU/DEBIAN:
# sudo apt-get update
# sudo apt-get install imagemagick optipng gifsicle webp
#
# FEDORA/RHEL:
# sudo dnf install ImageMagick optipng gifsicle libwebp-tools
#
# WINDOWS (using Chocolatey):
# choco install imagemagick optipng gifsicle webp