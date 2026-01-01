#!/bin/bash

# Script to compress new category images for LayerWeaver gallery
echo "Starting compression of category images..."

# Base directory
BASE_DIR="/Users/rahul/StudioProjects/layerweaver/images"

# Create WebP directories for each category
mkdir -p "$BASE_DIR/carft/webp"
mkdir -p "$BASE_DIR/corporate/webp"
mkdir -p "$BASE_DIR/design/webp"
mkdir -p "$BASE_DIR/ondemand/webp"
mkdir -p "$BASE_DIR/personalized/webp"
mkdir -p "$BASE_DIR/workshop/webp"

# Compress JPG/JPEG files
echo "Compressing JPG images..."
find "$BASE_DIR/carft" "$BASE_DIR/corporate" "$BASE_DIR/design" "$BASE_DIR/ondemand" "$BASE_DIR/personalized" "$BASE_DIR/workshop" -name "*.jpg" | while read file; do
    filename=$(basename "$file")
    directory=$(dirname "$file")
    category=$(basename "$directory")
    
    echo "Compressing: $filename in $category"
    
    # Create compressed JPG (max width 1200px, 80% quality)
    convert "$file" -resize "1200x>" -quality 80 "$file.compressed"
    mv "$file.compressed" "$file"
    
    # Create WebP version (75% quality)
    cwebp -q 75 "$file" -o "${directory}/webp/${filename%.*}.webp"
done

# Compress PNG files
echo "Compressing PNG images..."
find "$BASE_DIR/carft" "$BASE_DIR/corporate" "$BASE_DIR/design" "$BASE_DIR/ondemand" "$BASE_DIR/personalized" "$BASE_DIR/workshop" -name "*.png" | while read file; do
    filename=$(basename "$file")
    directory=$(dirname "$file")
    category=$(basename "$directory")
    
    echo "Compressing: $filename in $category"
    
    # Optimize PNG
    optipng -o5 "$file"
    
    # Create WebP version
    cwebp -q 75 "$file" -o "${directory}/webp/${filename%.*}.webp"
done

echo "Compression complete!"