#!/bin/bash

# Script to remove old WebP folders that are no longer referenced
PROJECT_ROOT="/Users/rahul/StudioProjects/layerweaver"
IMAGES_DIR="$PROJECT_ROOT/images"

echo "Cleaning up old WebP directories..."

# List of categories
CATEGORIES=("craft" "corporate" "design" "ondemand" "personalized" "workshop" "feedback" "gallery")

# Function to safely remove directories if they exist
safe_remove() {
    if [ -d "$1" ]; then
        echo "Removing $1"
        rm -rf "$1"
    fi
}

# For each category, remove the old webp directory
for category in "${CATEGORIES[@]}"; do
    echo "Processing $category category..."
    
    # Remove webp directory at the category root level
    safe_remove "$IMAGES_DIR/$category/webp"
done

echo "Cleanup complete. All redundant WebP folders have been removed."