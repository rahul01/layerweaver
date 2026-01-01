#!/bin/bash

# Script to verify that all images referenced in the HTML files exist
PROJECT_ROOT="/Users/rahul/StudioProjects/layerweaver"
GALLERY_HTML="$PROJECT_ROOT/gallery.html"
INDEX_HTML="$PROJECT_ROOT/index.html"
MISSING_IMAGES="$PROJECT_ROOT/missing_images.txt"

# Remove previous files
rm -f "$MISSING_IMAGES"

# Extract all image paths from the gallery and index HTML files
grep -o 'src="images/[^"]*"' "$GALLERY_HTML" | sed 's/src="//' | sed 's/"//' > "$PROJECT_ROOT/temp_gallery_src.txt"
grep -o 'srcset="images/[^"]*"' "$GALLERY_HTML" | sed 's/srcset="//' | sed 's/"//' > "$PROJECT_ROOT/temp_gallery_srcset.txt"
grep -o 'src="images/[^"]*"' "$INDEX_HTML" | sed 's/src="//' | sed 's/"//' > "$PROJECT_ROOT/temp_index_src.txt"
grep -o 'srcset="images/[^"]*"' "$INDEX_HTML" | sed 's/srcset="//' | sed 's/"//' > "$PROJECT_ROOT/temp_index_srcset.txt"

# Combine sources
cat "$PROJECT_ROOT/temp_gallery_src.txt" "$PROJECT_ROOT/temp_gallery_srcset.txt" | sort | uniq > "$PROJECT_ROOT/temp_gallery_all.txt"
cat "$PROJECT_ROOT/temp_index_src.txt" "$PROJECT_ROOT/temp_index_srcset.txt" | sort | uniq > "$PROJECT_ROOT/temp_index_all.txt"

# Function to check if a file exists in standard or original location
check_file_exists() {
    local path="$1"
    local html_file="$2"
    
    # Remove query parameters (e.g., ?v=3)
    local clean_path=$(echo "$path" | sed 's/\?.*$//')
    
    # Check if file exists directly
    if [ -f "$PROJECT_ROOT/$clean_path" ]; then
        return 0  # File exists
    fi
    
    # If file doesn't exist, check if it's an original path that needs to be redirected to standard
    # Pattern: images/category/filename.ext -> images/category/standard/filename.ext
    local standard_path=$(echo "$clean_path" | sed -E 's#(images/[^/]+)/([^/]+)$#\1/standard/\2#')
    
    if [ "$standard_path" != "$clean_path" ] && [ -f "$PROJECT_ROOT/$standard_path" ]; then
        echo "Warning: $html_file references $clean_path but file exists at $standard_path" >> "$MISSING_IMAGES"
        return 0  # File exists at standard path
    fi
    
    # If file doesn't exist in either location, report it as missing
    echo "Missing from $html_file: $clean_path" | tee -a "$MISSING_IMAGES"
    return 1  # File does not exist
}

# Check each file from gallery.html
echo "Checking images from gallery.html..." > "$MISSING_IMAGES"
echo "--------------------------------" >> "$MISSING_IMAGES"
GALLERY_MISSING=0
while read -r path; do
    check_file_exists "$path" "gallery.html" || ((GALLERY_MISSING++))
done < "$PROJECT_ROOT/temp_gallery_all.txt"

# Check each file from index.html
echo "" >> "$MISSING_IMAGES"
echo "Checking images from index.html..." >> "$MISSING_IMAGES"
echo "--------------------------------" >> "$MISSING_IMAGES"
INDEX_MISSING=0
while read -r path; do
    check_file_exists "$path" "index.html" || ((INDEX_MISSING++))
done < "$PROJECT_ROOT/temp_index_all.txt"

# Count missing files
MISSING_COUNT=$((GALLERY_MISSING + INDEX_MISSING))

if [ "$MISSING_COUNT" = "0" ]; then
    echo "All images exist! No missing references."
    rm -f "$MISSING_IMAGES"
else
    echo "Found $MISSING_COUNT missing images. See $MISSING_IMAGES for details."
fi

# Clean up temp files
rm -f "$PROJECT_ROOT/temp_gallery_src.txt" "$PROJECT_ROOT/temp_gallery_srcset.txt" "$PROJECT_ROOT/temp_gallery_all.txt"
rm -f "$PROJECT_ROOT/temp_index_src.txt" "$PROJECT_ROOT/temp_index_srcset.txt" "$PROJECT_ROOT/temp_index_all.txt"