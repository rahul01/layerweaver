#!/bin/bash

# This script updates all remaining gallery images to use the WebP format with fallbacks

echo "Updating remaining gallery images..."

# Get the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Find all img tags for gallery images that don't use picture element
grep -n '<div class="gallery-item">' index.html | while read -r line; do
    line_num=$(echo "$line" | cut -d':' -f1)
    next_line=$((line_num + 1))
    
    # Check if the next line is an img tag (not already a picture element)
    is_img=$(sed -n "${next_line}p" index.html | grep -c '<img src="images/gallery/')
    
    if [ $is_img -eq 1 ]; then
        img_line=$(sed -n "${next_line}p" index.html)
        img_src=$(echo "$img_line" | grep -o 'src="[^"]*"' | sed 's/src="\([^"]*\)"/\1/')
        img_alt=$(echo "$img_line" | grep -o 'alt="[^"]*"' | sed 's/alt="\([^"]*\)"/\1/')
        
        # Extract filename
        filename=$(basename "$img_src")
        extension="${filename##*.}"
        basename="${filename%.*}"
        
        # Create picture element replacement
        if [ "$extension" == "jpg" ] || [ "$extension" == "jpeg" ]; then
            mime_type="image/jpeg"
        elif [ "$extension" == "png" ]; then
            mime_type="image/png"
        elif [ "$extension" == "gif" ]; then
            mime_type="image/gif"
        else
            mime_type="image/$extension"
        fi
        
        webp_src="images/gallery/webp/${basename}.webp"
        
        new_html="                    <picture>\n                        <source srcset=\"$webp_src\" type=\"image/webp\">\n                        <source srcset=\"$img_src\" type=\"$mime_type\">\n                        <img src=\"$img_src\" alt=\"$img_alt\" loading=\"lazy\">\n                    </picture>"
        
        # Replace the img tag with picture element
        sed -i '' "${next_line}s|.*|$new_html|" index.html
        
        echo "Updated image: $img_src"
    fi
done

echo "All gallery images have been updated!"