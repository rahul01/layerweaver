#!/bin/bash

# Script to update gallery HTML to use WebP versions for all design screenshots
echo "Updating gallery HTML to use WebP versions for all design screenshots..."

# Use sed to replace the simple img tags with picture elements that include WebP sources
sed -i '' '
/<div class="gallery-item" data-category="design">/,/<\/div>/ {
  /<picture>/,/<\/picture>/ {
    /source.*webp/! {
      /<img src="images\/design\/Screenshot/! b
      s|<img src="images/design/\(Screenshot [^"]*\)" \(.*\)>|        <source srcset="images/design/webp/\1.webp" type="image/webp">\n        <source srcset="images/design/\1" type="image/png">\n        <img src="images/design/\1" \2>|
    }
  }
}' /Users/rahul/StudioProjects/layerweaver/gallery.html

echo "Update complete!"