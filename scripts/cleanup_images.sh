#!/bin/bash

# Script to find and remove duplicate, unused, and renamed images in LayerWeaver
# Run this script to generate a report first, then run with --remove to actually remove files

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ROOT="/Users/rahul/StudioProjects/layerweaver"
IMAGES_DIR="$PROJECT_ROOT/images"
GALLERY_HTML="$PROJECT_ROOT/gallery.html"
INDEX_HTML="$PROJECT_ROOT/index.html"
REPORT_FILE="$PROJECT_ROOT/image_cleanup_report.txt"
USED_IMAGES_FILE="$PROJECT_ROOT/used_images.txt"
ALL_IMAGES_FILE="$PROJECT_ROOT/all_images.txt"
ABSOLUTE_USED_IMAGES_FILE="$PROJECT_ROOT/absolute_used_images.txt"

# Create a backup directory
BACKUP_DIR="$PROJECT_ROOT/image_backup_$(date +%Y%m%d_%H%M%S)"

if [ "$1" == "--remove" ]; then
    REMOVE_FILES=1
    echo -e "${RED}WARNING: This will remove files based on the report${NC}"
    echo "Creating backup directory at $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
else
    REMOVE_FILES=0
    echo -e "${BLUE}Running in report-only mode. To actually remove files, run with --remove${NC}"
fi

# Remove previous reports
rm -f "$REPORT_FILE" "$USED_IMAGES_FILE" "$ALL_IMAGES_FILE" "$ABSOLUTE_USED_IMAGES_FILE"

echo -e "${GREEN}Step 1: Finding all images used in the website...${NC}"

# Extract all image paths from the gallery and index HTML files
grep -o 'src="images/[^"]*"' "$GALLERY_HTML" "$INDEX_HTML" | sed 's/src="//' | sed 's/"//' > "$USED_IMAGES_FILE"
grep -o 'srcset="images/[^"]*"' "$GALLERY_HTML" "$INDEX_HTML" | sed 's/srcset="//' | sed 's/"//' >> "$USED_IMAGES_FILE"

# Count the number of images used
USED_COUNT=$(wc -l < "$USED_IMAGES_FILE")
echo "Found $USED_COUNT image references in HTML files"

# Create absolute paths for used images
while read -r relative_path; do
    echo "$PROJECT_ROOT/$relative_path" >> "$ABSOLUTE_USED_IMAGES_FILE"
done < "$USED_IMAGES_FILE"

echo -e "${GREEN}Step 2: Finding all image files in the project...${NC}"

# Find all image files
find "$IMAGES_DIR" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" -o -name "*.gif" \) \
    | grep -v "favicon" > "$ALL_IMAGES_FILE"

# Count the total number of images
TOTAL_COUNT=$(wc -l < "$ALL_IMAGES_FILE")
echo "Found $TOTAL_COUNT image files in the project"

echo -e "${GREEN}Step 3: Identifying unused images...${NC}"

# Find unused images
echo "Unused Images:" > "$REPORT_FILE"
echo "-------------" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

UNUSED_COUNT=0
while read -r image_path; do
    RELATIVE_PATH=${image_path#$PROJECT_ROOT/}
    if ! grep -q "$RELATIVE_PATH" "$USED_IMAGES_FILE"; then
        echo "$image_path" >> "$REPORT_FILE"
        UNUSED_COUNT=$((UNUSED_COUNT + 1))
        
        if [ $REMOVE_FILES -eq 1 ]; then
            # Create directories in backup
            BACKUP_PATH="$BACKUP_DIR/$(dirname "$RELATIVE_PATH")"
            mkdir -p "$BACKUP_PATH"
            
            # Copy to backup then remove
            cp "$image_path" "$BACKUP_DIR/$RELATIVE_PATH"
            rm "$image_path"
            echo -e "${RED}Removed: $image_path${NC}"
        fi
    fi
done < "$ALL_IMAGES_FILE"

echo "Found $UNUSED_COUNT unused images"
echo "" >> "$REPORT_FILE"

echo -e "${GREEN}Step 4: Identifying original images that have clean/rotated versions...${NC}"

# Identify original images that have been moved to clean/rotated folders
echo "Original Images with Clean/Rotated Versions:" >> "$REPORT_FILE"
echo "---------------------------------------" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

ORIGINAL_WITH_CLEAN_COUNT=0

# Look for pairs where both clean/rotated and original exist
for dir in "design" "ondemand" "corporate" "personalized"; do
    # Find clean versions
    if [ -d "$IMAGES_DIR/$dir/clean" ]; then
        find "$IMAGES_DIR/$dir/clean" -type f \( -name "*.jpg" -o -name "*.png" \) | while read -r clean_image; do
            clean_basename=$(basename "$clean_image")
            clean_number=$(echo "$clean_basename" | grep -o '[0-9]\+' | head -1)
            
            # Find corresponding original file
            find "$IMAGES_DIR/$dir" -maxdepth 1 -type f \( -name "*.jpg" -o -name "*.png" \) | while read -r original_image; do
                # Skip if this is already in a clean or rotated directory
                if [[ "$original_image" == *"/clean/"* || "$original_image" == *"/rotated/"* ]]; then
                    continue
                fi
                
                original_basename=$(basename "$original_image")
                
                # Check if this original has been cleaned
                ORIG_PATH="$original_image"
                ORIG_RELATIVE=${ORIG_PATH#$PROJECT_ROOT/}
                
                # Check if the original is still referenced in HTML
                if grep -q "$ORIG_RELATIVE" "$USED_IMAGES_FILE"; then
                    continue
                fi
                
                # Check if it might be a corresponding file based on index number
                if [[ -n "$clean_number" ]]; then
                    echo "$original_image -> $clean_image" >> "$REPORT_FILE"
                    ORIGINAL_WITH_CLEAN_COUNT=$((ORIGINAL_WITH_CLEAN_COUNT + 1))
                    
                    if [ $REMOVE_FILES -eq 1 ]; then
                        # Create directories in backup
                        BACKUP_PATH="$BACKUP_DIR/$(dirname "$ORIG_RELATIVE")"
                        mkdir -p "$BACKUP_PATH"
                        
                        # Copy to backup then remove
                        cp "$original_image" "$BACKUP_DIR/$ORIG_RELATIVE"
                        rm "$original_image"
                        echo -e "${RED}Removed original with clean version: $original_image${NC}"
                    fi
                    break
                fi
            done
        done
    fi
    
    # Find rotated versions
    if [ -d "$IMAGES_DIR/$dir/rotated" ]; then
        find "$IMAGES_DIR/$dir/rotated" -type f \( -name "*.jpg" -o -name "*.png" \) | while read -r rotated_image; do
            rotated_basename=$(basename "$rotated_image")
            
            # Find corresponding original file
            original_path="$IMAGES_DIR/$dir/$rotated_basename"
            if [ -f "$original_path" ]; then
                # Check if the original is still referenced in HTML
                ORIG_RELATIVE="images/$dir/$rotated_basename"
                if ! grep -q "$ORIG_RELATIVE" "$USED_IMAGES_FILE"; then
                    echo "$original_path -> $rotated_image" >> "$REPORT_FILE"
                    ORIGINAL_WITH_CLEAN_COUNT=$((ORIGINAL_WITH_CLEAN_COUNT + 1))
                    
                    if [ $REMOVE_FILES -eq 1 ]; then
                        # Create directories in backup
                        BACKUP_PATH="$BACKUP_DIR/images/$dir"
                        mkdir -p "$BACKUP_PATH"
                        
                        # Copy to backup then remove
                        cp "$original_path" "$BACKUP_DIR/images/$dir/$rotated_basename"
                        rm "$original_path"
                        echo -e "${RED}Removed original with rotated version: $original_path${NC}"
                    fi
                fi
            fi
        done
    fi
done

echo "Found $ORIGINAL_WITH_CLEAN_COUNT original images with clean/rotated versions"
echo "" >> "$REPORT_FILE"

echo -e "${GREEN}Step 5: Looking for duplicate WebP versions...${NC}"

# Find duplicate WebP versions (ones in root webp dir and ones in webp/clean or webp/rotated)
echo "Duplicate WebP Versions:" >> "$REPORT_FILE"
echo "----------------------" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

DUPLICATE_WEBP_COUNT=0
for dir in "design" "ondemand" "corporate" "personalized"; do
    # Check for duplicates in clean/webp vs regular webp
    if [ -d "$IMAGES_DIR/$dir/clean/webp" ] && [ -d "$IMAGES_DIR/$dir/webp" ]; then
        find "$IMAGES_DIR/$dir/clean/webp" -type f -name "*.webp" | while read -r clean_webp; do
            clean_basename=$(basename "$clean_webp")
            original_webp="$IMAGES_DIR/$dir/webp/$clean_basename"
            
            # Check if there's a matching original webp
            if [ -f "$original_webp" ]; then
                # Verify that the clean version is used in HTML
                CLEAN_WEBP_RELATIVE=${clean_webp#$PROJECT_ROOT/}
                if grep -q "$CLEAN_WEBP_RELATIVE" "$USED_IMAGES_FILE"; then
                    echo "$original_webp" >> "$REPORT_FILE"
                    DUPLICATE_WEBP_COUNT=$((DUPLICATE_WEBP_COUNT + 1))
                    
                    if [ $REMOVE_FILES -eq 1 ]; then
                        # Create directories in backup
                        ORIG_RELATIVE=${original_webp#$PROJECT_ROOT/}
                        BACKUP_PATH="$BACKUP_DIR/$(dirname "$ORIG_RELATIVE")"
                        mkdir -p "$BACKUP_PATH"
                        
                        # Copy to backup then remove
                        cp "$original_webp" "$BACKUP_DIR/$ORIG_RELATIVE"
                        rm "$original_webp"
                        echo -e "${RED}Removed duplicate WebP: $original_webp${NC}"
                    fi
                fi
            fi
        done
    fi
    
    # Check for duplicates in rotated/webp vs regular webp
    if [ -d "$IMAGES_DIR/$dir/rotated/webp" ] && [ -d "$IMAGES_DIR/$dir/webp" ]; then
        find "$IMAGES_DIR/$dir/rotated/webp" -type f -name "*.webp" | while read -r rotated_webp; do
            rotated_basename=$(basename "$rotated_webp")
            original_webp="$IMAGES_DIR/$dir/webp/$rotated_basename"
            
            # Check if there's a matching original webp
            if [ -f "$original_webp" ]; then
                # Verify that the rotated version is used in HTML
                ROTATED_WEBP_RELATIVE=${rotated_webp#$PROJECT_ROOT/}
                if grep -q "$ROTATED_WEBP_RELATIVE" "$USED_IMAGES_FILE"; then
                    echo "$original_webp" >> "$REPORT_FILE"
                    DUPLICATE_WEBP_COUNT=$((DUPLICATE_WEBP_COUNT + 1))
                    
                    if [ $REMOVE_FILES -eq 1 ]; then
                        # Create directories in backup
                        ORIG_RELATIVE=${original_webp#$PROJECT_ROOT/}
                        BACKUP_PATH="$BACKUP_DIR/$(dirname "$ORIG_RELATIVE")"
                        mkdir -p "$BACKUP_PATH"
                        
                        # Copy to backup then remove
                        cp "$original_webp" "$BACKUP_DIR/$ORIG_RELATIVE"
                        rm "$original_webp"
                        echo -e "${RED}Removed duplicate WebP: $original_webp${NC}"
                    fi
                fi
            fi
        done
    fi
done

echo "Found $DUPLICATE_WEBP_COUNT duplicate WebP versions"
echo "" >> "$REPORT_FILE"

# Generate summary
TOTAL_REMOVABLE=$((UNUSED_COUNT + ORIGINAL_WITH_CLEAN_COUNT + DUPLICATE_WEBP_COUNT))
echo -e "${GREEN}Summary:${NC}"
echo "-------" >> "$REPORT_FILE"
echo "Total image files: $TOTAL_COUNT" >> "$REPORT_FILE"
echo "Used in website: $USED_COUNT" >> "$REPORT_FILE"
echo "Unused images: $UNUSED_COUNT" >> "$REPORT_FILE"
echo "Original images with clean/rotated versions: $ORIGINAL_WITH_CLEAN_COUNT" >> "$REPORT_FILE"
echo "Duplicate WebP versions: $DUPLICATE_WEBP_COUNT" >> "$REPORT_FILE"
echo "Total removable images: $TOTAL_REMOVABLE" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Print report location
echo -e "${YELLOW}Report saved to: $REPORT_FILE${NC}"
echo "Identified $TOTAL_REMOVABLE images that can be removed"

if [ $REMOVE_FILES -eq 1 ]; then
    echo -e "${GREEN}Removed $TOTAL_REMOVABLE images. Backups saved to: $BACKUP_DIR${NC}"
else
    echo -e "${BLUE}To remove these images, run: $0 --remove${NC}"
fi

# Cleanup temporary files
rm -f "$USED_IMAGES_FILE" "$ALL_IMAGES_FILE" "$ABSOLUTE_USED_IMAGES_FILE"