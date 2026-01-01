#!/bin/bash

# Script to update all image tags in the gallery to use WebP with picture elements
# This processes the index.html file and replaces regular img tags with picture elements

# Make a backup of the original file
cp /Users/rahul/StudioProjects/layerweaver/index.html /Users/rahul/StudioProjects/layerweaver/index.html.bak

# Use sed to replace all remaining img tags in the gallery section
# This matches img tags that point to gallery images and transforms them to picture elements with WebP support
sed -i.tmp '/gallery-item/,/<\/div>/s|<img src="images/gallery/\([^"]*\).jpg" alt="\([^"]*\)" loading="lazy">|<picture>\n                        <source srcset="images/gallery/webp/\1.webp" type="image/webp">\n                        <source srcset="images/gallery/\1.jpg" type="image/jpeg">\n                        <img src="images/gallery/\1.jpg" alt="\2" loading="lazy">\n                    </picture>|g' /Users/rahul/StudioProjects/layerweaver/index.html

# Handle GIF files separately (they don't get WebP conversion)
sed -i.tmp2 '/gallery-item/,/<\/div>/s|<img src="images/gallery/\([^"]*\).gif" alt="\([^"]*\)" loading="lazy">|<picture>\n                        <source srcset="images/gallery/\1.gif" type="image/gif">\n                        <img src="images/gallery/\1.gif" alt="\2" loading="lazy">\n                    </picture>|g' /Users/rahul/StudioProjects/layerweaver/index.html

# Clean up temporary files
rm /Users/rahul/StudioProjects/layerweaver/index.html.tmp*

echo "Gallery image tags updated to use WebP with picture elements"