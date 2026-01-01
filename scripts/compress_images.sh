#!/bin/bash

# Script to compress images for LayerWeaver website
# This script requires the following tools to be installed:
# - ImageMagick (for JPG compression)
# - OptiPNG (for PNG compression)
# - GIFsicle (for GIF compression)
# - Webp (for WebP conversion)

# Create directories for compressed images
mkdir -p compressed/gallery
mkdir -p compressed/feedback
mkdir -p compressed/webp/gallery
mkdir -p compressed/webp/feedback

echo "===== Compressing JPG images in gallery folder ====="
for img in images/gallery/*.jpg; do
  filename=$(basename "$img")
  echo "Compressing $filename..."
  # Resize to max width of 1200px and quality of 80%
  convert "$img" -resize "1200x>" -quality 80 -strip "compressed/gallery/$filename"
  
  # Also create WebP version (typically 25-35% smaller than JPG)
  webpname="${filename%.jpg}.webp"
  cwebp -q 80 "$img" -o "compressed/webp/gallery/$webpname"
done

echo "===== Compressing PNG images in feedback folder ====="
for img in images/feedback/*.png; do
  filename=$(basename "$img")
  echo "Compressing $filename..."
  # Use OptiPNG for lossless PNG compression
  optipng -o5 "$img" -out "compressed/feedback/$filename"
  
  # Create WebP version
  webpname="${filename%.png}.webp"
  cwebp -q 80 "$img" -o "compressed/webp/feedback/$webpname"
done

echo "===== Compressing GIF images ====="
for img in images/gallery/*.gif; do
  filename=$(basename "$img")
  echo "Compressing $filename..."
  # Optimize GIF with gifsicle
  gifsicle -O3 "$img" -o "compressed/gallery/$filename"
done

echo "===== Creating responsive image sizes ====="
# Create smaller versions for responsive loading
for img in compressed/gallery/*.jpg; do
  filename=$(basename "$img")
  basename="${filename%.jpg}"
  
  echo "Creating responsive sizes for $filename..."
  # Medium size (800px width)
  convert "$img" -resize 800x -quality 75 -strip "compressed/gallery/${basename}-medium.jpg"
  
  # Small size (400px width)
  convert "$img" -resize 400x -quality 70 -strip "compressed/gallery/${basename}-small.jpg"
done

echo "===== Compression Complete ====="
echo "Original images size:"
du -sh images/gallery images/feedback
echo "Compressed images size:"
du -sh compressed/gallery compressed/feedback compressed/webp

echo "Next steps:"
echo "1. Review the compressed images for quality"
echo "2. If satisfied, replace the originals with compressed versions"
echo "3. Update HTML to use WebP format with fallbacks"
echo "   Example: 
<picture>
  <source srcset=\"images/gallery/image.webp\" type=\"image/webp\">
  <source srcset=\"images/gallery/image.jpg\" type=\"image/jpeg\"> 
  <img src=\"images/gallery/image.jpg\" alt=\"Description\" loading=\"lazy\">
</picture>"
echo "4. Update HTML with srcset for responsive images"
echo "   Example: 
<img src=\"images/gallery/image.jpg\" 
     srcset=\"images/gallery/image-small.jpg 400w,
             images/gallery/image-medium.jpg 800w,
             images/gallery/image.jpg 1200w\"
     sizes=\"(max-width: 400px) 100vw, (max-width: 768px) 50vw, 25vw\"
     alt=\"Description\" 
     loading=\"lazy\">"