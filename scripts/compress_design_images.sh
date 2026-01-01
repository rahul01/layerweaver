#!/bin/bash

# Script to compress and create WebP versions of the new design images
echo "Creating WebP versions for new design images..."

# Base directory
BASE_DIR="/Users/rahul/StudioProjects/layerweaver/images"

# Make sure WebP directory exists
mkdir -p "$BASE_DIR/design/webp"

# Process PNG files
echo "Processing PNG files..."
find "$BASE_DIR/design" -maxdepth 1 -name "Screenshot*PM.png" | while read file; do
    filename=$(basename "$file")
    
    # Skip if WebP version already exists
    if [ -f "$BASE_DIR/design/webp/${filename%.*}.webp" ]; then
        echo "WebP version for $filename already exists, skipping..."
        continue
    fi
    
    echo "Converting: $filename to WebP"
    
    # Create WebP version (75% quality)
    cwebp -q 75 "$file" -o "${BASE_DIR}/design/webp/${filename%.*}.webp"
done

echo "Conversion complete!"