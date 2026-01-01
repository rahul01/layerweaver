#!/bin/bash

# Script to rotate images in the standardized directory structure
# Usage: ./rotate_standard_image.sh <category> <filename> <angle>
# Example: ./rotate_standard_image.sh corporate IMG_20251225_153501485.jpg 90

if [ $# -lt 3 ]; then
    echo "Usage: $0 <category> <filename> <angle>"
    echo "Example: $0 corporate IMG_20251225_153501485.jpg 90"
    exit 1
fi

CATEGORY="$1"
FILENAME="$2"
ANGLE="$3"
PROJECT_ROOT="/Users/rahul/StudioProjects/layerweaver"
IMAGE_PATH="$PROJECT_ROOT/images/$CATEGORY/standard/$FILENAME"
WEBP_PATH="$PROJECT_ROOT/images/$CATEGORY/standard/webp/${FILENAME%.*}.webp"

# Check if image exists
if [ ! -f "$IMAGE_PATH" ]; then
    echo "Error: Image not found at $IMAGE_PATH"
    exit 1
fi

# Backup original image
cp "$IMAGE_PATH" "${IMAGE_PATH}.bak"
if [ -f "$WEBP_PATH" ]; then
    cp "$WEBP_PATH" "${WEBP_PATH}.bak"
fi

echo "Rotating image $FILENAME in $CATEGORY by $ANGLE degrees..."

# Rotate the original image
convert -rotate "$ANGLE" "$IMAGE_PATH" "$IMAGE_PATH"
if [ $? -ne 0 ]; then
    echo "Error rotating original image. Restoring backup..."
    mv "${IMAGE_PATH}.bak" "$IMAGE_PATH"
    exit 1
fi

# Regenerate WebP version
if [ -f "$WEBP_PATH" ]; then
    echo "Regenerating WebP version..."
    cwebp -q 75 "$IMAGE_PATH" -o "$WEBP_PATH"
    if [ $? -ne 0 ]; then
        echo "Error creating WebP version. Restoring backup..."
        mv "${WEBP_PATH}.bak" "$WEBP_PATH"
        exit 1
    fi
fi

# Remove backups
rm -f "${IMAGE_PATH}.bak" "${WEBP_PATH}.bak"

echo "Successfully rotated $FILENAME and updated WebP version."
echo "You may need to add a version parameter or cache-buster to the HTML references:"
echo "Example: <img src=\"images/$CATEGORY/standard/$FILENAME?v=1\" ...>"