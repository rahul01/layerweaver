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

# Check each file from gallery.html
echo "Checking images from gallery.html..." > "$MISSING_IMAGES"
echo "--------------------------------" >> "$MISSING_IMAGES"
while read -r path; do
    if [ ! -f "$PROJECT_ROOT/$path" ]; then
        echo "$GALLERY_HTML:$path" >> "$MISSING_IMAGES"
        echo "Missing from gallery.html: $path"
    fi
done < "$PROJECT_ROOT/temp_gallery_all.txt"

# Check each file from index.html
echo "" >> "$MISSING_IMAGES"
echo "Checking images from index.html..." >> "$MISSING_IMAGES"
echo "--------------------------------" >> "$MISSING_IMAGES"
while read -r path; do
    if [ ! -f "$PROJECT_ROOT/$path" ]; then
        echo "$INDEX_HTML:$path" >> "$MISSING_IMAGES"
        echo "Missing from index.html: $path"
    fi
done < "$PROJECT_ROOT/temp_index_all.txt"

# Count missing files
MISSING_COUNT=$(grep -c ":" "$MISSING_IMAGES" || echo "0")

if [ "$MISSING_COUNT" = "0" ]; then
    echo "All images exist! No missing references."
    rm -f "$MISSING_IMAGES"
else
    echo "Found $MISSING_COUNT missing images. See $MISSING_IMAGES for details."
fi

# Clean up temp files
rm -f "$PROJECT_ROOT/temp_gallery_src.txt" "$PROJECT_ROOT/temp_gallery_srcset.txt" "$PROJECT_ROOT/temp_gallery_all.txt"
rm -f "$PROJECT_ROOT/temp_index_src.txt" "$PROJECT_ROOT/temp_index_srcset.txt" "$PROJECT_ROOT/temp_index_all.txt"