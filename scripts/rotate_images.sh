#!/bin/bash

# Script to rotate images for LayerWeaver gallery
# This script requires ImageMagick to be installed

# Display usage if no arguments are provided
if [ $# -lt 3 ]; then
  echo "Usage: $0 <image_path> <rotation_angle> <output_dir>"
  echo "Example: $0 images/design/standard/design-5.png 90 images/design/rotated"
  echo "Rotation angle can be: 90, 180, 270 (clockwise degrees)"
  echo "IMPORTANT: Now that images are standardized, you may want to use rotate_standard_image.sh instead."
  echo "           Example: ./rotate_standard_image.sh design design-5.png 90"
  exit 1
fi

IMAGE_PATH=$1
ROTATION=$2
OUTPUT_DIR=$3

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/webp"

# Get just the filename without path
FILENAME=$(basename "$IMAGE_PATH")
BASENAME="${FILENAME%.*}"
EXTENSION="${FILENAME##*.}"

# Convert extension to lowercase
EXTENSION=$(echo "$EXTENSION" | tr '[:upper:]' '[:lower:]')

# Output paths
ROTATED_IMAGE="$OUTPUT_DIR/$FILENAME"
ROTATED_WEBP="$OUTPUT_DIR/webp/$BASENAME.webp"

# Perform the rotation
echo "Rotating $IMAGE_PATH by $ROTATION degrees..."
convert "$IMAGE_PATH" -rotate "$ROTATION" "$ROTATED_IMAGE"

# Create WebP version
echo "Creating WebP version..."
if [ "$EXTENSION" = "jpg" ] || [ "$EXTENSION" = "jpeg" ]; then
  cwebp -q 75 "$ROTATED_IMAGE" -o "$ROTATED_WEBP"
elif [ "$EXTENSION" = "png" ]; then
  cwebp -q 75 "$ROTATED_IMAGE" -o "$ROTATED_WEBP"
else
  echo "Unsupported image format: $EXTENSION"
  exit 1
fi

echo "Rotation complete!"
echo "Rotated image: $ROTATED_IMAGE"
echo "WebP version: $ROTATED_WEBP"
echo ""
echo "Note: Since images are now in a standard structure, consider using:"
echo "./rotate_standard_image.sh <category> <filename> <angle>"