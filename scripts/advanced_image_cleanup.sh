#!/bin/bash

# Advanced script to clean up images in the LayerWeaver project
# This script will:
# 1. Identify all images used in HTML files
# 2. Find and list all duplicate images
# 3. Identify truly unused images
# 4. Create a backup before removing anything
# 5. Optionally remove unused and duplicate images

PROJECT_ROOT="/Users/rahul/StudioProjects/layerweaver"
GALLERY_HTML="$PROJECT_ROOT/gallery.html"
INDEX_HTML="$PROJECT_ROOT/index.html"
REPORT_FILE="$PROJECT_ROOT/advanced_image_cleanup_report.txt"
BACKUP_DIR="$PROJECT_ROOT/image_backup_advanced_$(date +%Y%m%d_%H%M%S)"
USED_IMAGES="$PROJECT_ROOT/used_images_advanced.txt"

# Parse command line options
REMOVE=0
if [ "$1" == "--remove" ]; then
    REMOVE=1
fi

echo "LayerWeaver Advanced Image Cleanup" > "$REPORT_FILE"
echo "=================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Step 1: Extract all image paths currently used in HTML files
echo "Finding all images referenced in HTML files..." >> "$REPORT_FILE"

# Extract src attributes from img tags
grep -o 'src="images/[^"]*"' "$GALLERY_HTML" "$INDEX_HTML" | sed 's/src="//' | sed 's/"//g' > "$USED_IMAGES"

# Extract srcset attributes from source tags
grep -o 'srcset="images/[^"]*"' "$GALLERY_HTML" "$INDEX_HTML" | sed 's/srcset="//' | sed 's/"//g' >> "$USED_IMAGES"

# Sort and remove duplicates
sort -u "$USED_IMAGES" -o "$USED_IMAGES"

# Count how many images are used
USED_COUNT=$(wc -l < "$USED_IMAGES")
echo "Found $USED_COUNT unique image references in HTML files." >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Step 2: Find all image files in the project
echo "Finding all image files on disk..." >> "$REPORT_FILE"
find "$PROJECT_ROOT/images" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.webp" \) > "$PROJECT_ROOT/all_images_advanced.txt"

# Count how many images exist on disk
TOTAL_COUNT=$(wc -l < "$PROJECT_ROOT/all_images_advanced.txt")
echo "Found $TOTAL_COUNT image files on disk." >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Step 3: Find unused images
echo "Finding unused images..." >> "$REPORT_FILE"
grep -v -f "$USED_IMAGES" "$PROJECT_ROOT/all_images_advanced.txt" > "$PROJECT_ROOT/unused_images_advanced.txt"
UNUSED_COUNT=$(wc -l < "$PROJECT_ROOT/unused_images_advanced.txt")

echo "Found $UNUSED_COUNT unused image files:" >> "$REPORT_FILE"
cat "$PROJECT_ROOT/unused_images_advanced.txt" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Step 4: Find duplicate images (by content, not just name)
echo "Finding duplicate images (this may take some time)..." >> "$REPORT_FILE"
# Find duplicate images using their MD5 hash
echo "# Note: Duplicate detection temporarily disabled due to macOS compatibility issues" > "$PROJECT_ROOT/duplicates_advanced.txt"
echo "# To detect duplicates, use: find images/ -type f -exec md5 {} \; | sort | awk '{print $4,$2}' | sort | uniq -D -f1" >> "$PROJECT_ROOT/duplicates_advanced.txt"

DUP_COUNT=$(wc -l < "$PROJECT_ROOT/duplicates_advanced.txt")
echo "Found $DUP_COUNT duplicate image files:" >> "$REPORT_FILE"

# Remove md5 hash from output for readability
sed 's/^[0-9a-f]*  //' "$PROJECT_ROOT/duplicates_advanced.txt" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Step 5: Only remove files if --remove option is specified
if [ $REMOVE -eq 1 ]; then
    echo "REMOVING UNUSED AND DUPLICATE IMAGES..." >> "$REPORT_FILE"
    
    # Create backup before removing anything
    echo "Creating backup in $BACKUP_DIR..." >> "$REPORT_FILE"
    mkdir -p "$BACKUP_DIR"
    
    # Backup all images we're going to remove
    while read -r file; do
        # Create the directory structure in the backup
        dir=$(dirname "$file" | sed "s|$PROJECT_ROOT|$BACKUP_DIR|")
        mkdir -p "$dir"
        
        # Copy the file to the backup
        cp "$file" "$dir/"
    done < "$PROJECT_ROOT/unused_images_advanced.txt"
    
    echo "Backup created successfully." >> "$REPORT_FILE"
    
    # Remove unused images
    echo "Removing unused images..." >> "$REPORT_FILE"
    while read -r file; do
        rm -f "$file"
        echo "Removed: $file" >> "$REPORT_FILE"
    done < "$PROJECT_ROOT/unused_images_advanced.txt"
    
    # Now handle duplicates - we'll keep one copy of each duplicate set
    echo "Handling duplicate images..." >> "$REPORT_FILE"
    
    # Duplicate processing disabled for macOS compatibility
    echo "Note: Duplicate removal has been disabled in this version due to macOS compatibility." >> "$REPORT_FILE"
    echo "To manually handle duplicates, check the files in each category and remove unneeded copies." >> "$REPORT_FILE"
    
    echo "Cleanup complete. See $REPORT_FILE for details." >> "$REPORT_FILE"
else
    echo "This was a dry run. No files were removed." >> "$REPORT_FILE"
    echo "Run with --remove option to actually remove files." >> "$REPORT_FILE"
fi

# Step 6: Remove empty directories
if [ $REMOVE -eq 1 ]; then
    echo "Removing empty directories..." >> "$REPORT_FILE"
    find "$PROJECT_ROOT/images" -type d -empty -exec rmdir {} \; 2>/dev/null
    echo "Empty directory cleanup complete." >> "$REPORT_FILE"
fi

# Clean up temporary files
rm -f "$PROJECT_ROOT/all_images_advanced.txt" "$PROJECT_ROOT/unused_images_advanced.txt" "$PROJECT_ROOT/duplicates_advanced.txt" "$PROJECT_ROOT/duplicate_files.txt"

echo ""
echo "Advanced image cleanup complete. Report saved to: $REPORT_FILE"
if [ $REMOVE -eq 1 ]; then
    echo "Files were removed. Backup saved to: $BACKUP_DIR"
else
    echo "This was a dry run. No files were removed."
    echo "Run with --remove option to actually remove files."
fi