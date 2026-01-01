#!/bin/bash

# Script to clean up old image directories after standardization
PROJECT_ROOT="/Users/rahul/StudioProjects/layerweaver"
IMAGES_DIR="$PROJECT_ROOT/images"

echo "Cleaning up old image directories..."

# List of categories
CATEGORIES=("craft" "corporate" "design" "ondemand" "personalized" "workshop" "feedback" "gallery")

# Function to safely remove directories if they exist
safe_remove() {
    if [ -d "$1" ]; then
        echo "Removing $1"
        rm -rf "$1"
    fi
}

# For each category, remove the clean, rotated, and old webp directories
for category in "${CATEGORIES[@]}"; do
    echo "Processing $category category..."
    
    # Remove clean directory
    safe_remove "$IMAGES_DIR/$category/clean"
    
    # Remove rotated directory
    safe_remove "$IMAGES_DIR/$category/rotated"
    
    # Move any remaining images to standard dir if they're not already there
    if [ -d "$IMAGES_DIR/$category" ] && [ "$(ls -A "$IMAGES_DIR/$category" 2>/dev/null | grep -v 'standard\|webp')" ]; then
        echo "Moving remaining images from $category to standard directory..."
        mkdir -p "$IMAGES_DIR/$category/standard"
        # Move jpg, png, gif files
        find "$IMAGES_DIR/$category" -maxdepth 1 -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" \) -exec mv {} "$IMAGES_DIR/$category/standard/" \;
    fi
    
    # WebP directory at the category root level will be preserved temporarily as some images may still reference it
    # We will check usage before removing it
done

echo "Cleanup complete. All images are now organized in the standard directory structure."