#!/bin/bash

# This script updates the HTML code for the gallery section to use WebP images with fallbacks

# Navigate to the project directory
cd /Users/rahul/StudioProjects/layerweaver

# Create a temporary file
TMP_FILE=$(mktemp)

# Process the HTML file
cat index.html | awk '
BEGIN { in_gallery = 0; }

# Check if we are in the gallery section
/<div class="gallery-grid">/ { in_gallery = 1; print; next; }
/<\/div>\s*<\/div>\s*<\/section>/ && in_gallery == 1 { in_gallery = 0; print; next; }

# Replace simple img tags with picture elements
in_gallery == 1 && /<div class="gallery-item">/ {
  in_item = 1;
  print;
  next;
}

in_gallery == 1 && in_item == 1 && /<img src="images\/gallery\/([^"]+)" alt="([^"]*)" loading="lazy">/ {
  filename = gensub(/<img src="images\/gallery\/([^"]+)" alt="([^"]*)" loading="lazy">/, "\\1", "g");
  alt_text = gensub(/<img src="images\/gallery\/([^"]+)" alt="([^"]*)" loading="lazy">/, "\\2", "g");
  
  if (filename ~ /\.gif$/) {
    print "                    <picture>";
    print "                        <source srcset=\"images/gallery/" filename "\" type=\"image/gif\">";
    print "                        <img src=\"images/gallery/" filename "\" alt=\"" alt_text "\" loading=\"lazy\">";
    print "                    </picture>";
  } else {
    base_filename = gensub(/\.jpg$|\.jpeg$|\.png$/, "", "g", filename);
    print "                    <picture>";
    print "                        <source srcset=\"images/gallery/webp/" base_filename ".webp\" type=\"image/webp\">";
    print "                        <source srcset=\"images/gallery/" filename "\" type=\"image/" (filename ~ /\.png$/ ? "png" : "jpeg") "\">";
    print "                        <img src=\"images/gallery/" filename "\" alt=\"" alt_text "\" loading=\"lazy\">";
    print "                    </picture>";
  }
  
  in_item = 0;
  next;
}

# Print all other lines as they are
{ print; }
' > "$TMP_FILE"

# Replace the original file with the processed one
cp "$TMP_FILE" index.html

# Remove the temporary file
rm "$TMP_FILE"

echo "Gallery HTML updated to use WebP images with fallbacks"