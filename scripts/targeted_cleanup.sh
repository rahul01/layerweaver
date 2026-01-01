#!/bin/bash

# Targeted cleanup script for LayerWeaver images
# This script removes specific unused directories and known duplicates

PROJECT_ROOT="/Users/rahul/StudioProjects/layerweaver"
GALLERY_HTML="$PROJECT_ROOT/gallery.html"
INDEX_HTML="$PROJECT_ROOT/index.html"
REPORT_FILE="$PROJECT_ROOT/targeted_cleanup_report.txt"
BACKUP_DIR="$PROJECT_ROOT/image_backup_targeted_$(date +%Y%m%d_%H%M%S)"

# Parse command line options
REMOVE=0
if [ "$1" == "--remove" ]; then
    REMOVE=1
fi

echo "LayerWeaver Targeted Image Cleanup" > "$REPORT_FILE"
echo "==================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Create list of directories to clean up
echo "Identifying unnecessary image directories..." >> "$REPORT_FILE"
declare -a cleanup_dirs=(
    "$PROJECT_ROOT/images/design/fixed"
    "$PROJECT_ROOT/image_backup_20260101_200614"
)

# Create list of specific paths to clean up
echo "Identifying test and temporary images..." >> "$REPORT_FILE"
declare -a cleanup_files=(
    "$PROJECT_ROOT/images/design/testimage.jpg"
    # Original screenshot files with problematic names
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 5.29.28 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.06.32 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.07.07 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.07.23 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.07.51 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.08.39 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.11.47 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.12.41 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.13.08 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.14.00 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.14.55 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.16.26 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.16.45 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.17.55 PM.png"
    "$PROJECT_ROOT/images/design/Screenshot 2026-01-01 at 7.18.31 PM.png"
)

# Print what will be removed
echo "The following directories will be removed:" >> "$REPORT_FILE"
for dir in "${cleanup_dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "  $dir" >> "$REPORT_FILE"
        # Count files
        file_count=$(find "$dir" -type f | wc -l)
        echo "    Contains $file_count files" >> "$REPORT_FILE"
    else
        echo "  $dir (not found)" >> "$REPORT_FILE"
    fi
done
echo "" >> "$REPORT_FILE"

echo "The following specific files will be removed:" >> "$REPORT_FILE"
for file in "${cleanup_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  $file" >> "$REPORT_FILE"
    else
        echo "  $file (not found)" >> "$REPORT_FILE"
    fi
done
echo "" >> "$REPORT_FILE"

# Remove the directories and files if --remove option specified
if [ $REMOVE -eq 1 ]; then
    echo "REMOVING DIRECTORIES AND FILES..." >> "$REPORT_FILE"
    
    # Create backup before removing anything
    echo "Creating backup in $BACKUP_DIR..." >> "$REPORT_FILE"
    mkdir -p "$BACKUP_DIR"
    
    # Backup and remove directories
    for dir in "${cleanup_dirs[@]}"; do
        if [ -d "$dir" ]; then
            # Get the directory name without path
            dirname=$(basename "$dir")
            
            # Create backup
            cp -r "$dir" "$BACKUP_DIR/$dirname"
            echo "Backed up: $dir to $BACKUP_DIR/$dirname" >> "$REPORT_FILE"
            
            # Remove directory
            rm -rf "$dir"
            echo "Removed directory: $dir" >> "$REPORT_FILE"
        fi
    done
    
    # Backup and remove specific files
    for file in "${cleanup_files[@]}"; do
        if [ -f "$file" ]; then
            # Get the file's directory path relative to project root
            rel_path=$(dirname "${file#$PROJECT_ROOT/}")
            mkdir -p "$BACKUP_DIR/$rel_path"
            
            # Copy file to backup
            cp "$file" "$BACKUP_DIR/$rel_path/"
            echo "Backed up: $file to $BACKUP_DIR/$rel_path/" >> "$REPORT_FILE"
            
            # Remove file
            rm "$file"
            echo "Removed file: $file" >> "$REPORT_FILE"
        fi
    done
    
    # Remove empty directories
    echo "Removing empty directories..." >> "$REPORT_FILE"
    find "$PROJECT_ROOT/images" -type d -empty -exec rmdir {} \; 2>/dev/null
    echo "Empty directory cleanup complete." >> "$REPORT_FILE"
    
    echo "Cleanup complete. See $REPORT_FILE for details." >> "$REPORT_FILE"
else
    echo "This was a dry run. No files were removed." >> "$REPORT_FILE"
    echo "Run with --remove option to actually remove files." >> "$REPORT_FILE"
fi

echo ""
echo "Targeted image cleanup complete. Report saved to: $REPORT_FILE"
if [ $REMOVE -eq 1 ]; then
    echo "Files were removed. Backup saved to: $BACKUP_DIR"
else
    echo "This was a dry run. No files were removed."
    echo "Run with --remove option to actually remove files."
fi