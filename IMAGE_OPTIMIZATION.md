# Image Optimization Guide for LayerWeaver

This guide provides instructions for optimizing images on the LayerWeaver website to improve loading times and performance.

## Why Optimize Images?

The current website has several large images:
- Many gallery images exceed 1MB (some up to 3.8MB)
- Feedback PNG files range from 230KB to 556KB
- Total image size is approximately 30MB

Optimizing these images will:
- Reduce page load time by 70-80%
- Improve mobile performance
- Reduce bandwidth usage
- Improve search engine rankings (Google PageSpeed)

## Optimization Methods

### 1. Compression

Compress images to reduce file size while maintaining acceptable quality:

| Image Type | Current Size | Target Size | Tools            |
|------------|--------------|-------------|------------------|
| JPG Photos | 1-4MB        | 100-300KB   | ImageMagick      |
| PNG Images | 200-550KB    | 50-150KB    | OptiPNG, TinyPNG |
| GIF        | 1.3MB        | 300-500KB   | GIFsicle         |

### 2. Modern Formats

Convert images to modern formats with fallbacks:

```html
<picture>
    <source srcset="image.webp" type="image/webp">
    <source srcset="image.jpg" type="image/jpeg">
    <img src="image.jpg" alt="Description" loading="lazy">
</picture>
```

WebP typically provides 25-35% smaller files than JPG/PNG with the same visual quality.

### 3. Responsive Images

Serve appropriately sized images based on screen size:

```html
<img src="image.jpg" 
     srcset="image-small.jpg 400w,
             image-medium.jpg 800w,
             image.jpg 1200w"
     sizes="(max-width: 400px) 100vw, (max-width: 768px) 50vw, 25vw"
     alt="Description" 
     loading="lazy">
```

### 4. Lazy Loading

All images should use lazy loading:

```html
<img src="image.jpg" alt="Description" loading="lazy">
```

## Using the Compression Script

1. Install required tools:
   ```bash
   # On macOS with Homebrew
   brew install imagemagick optipng gifsicle webp
   
   # On Ubuntu/Debian
   sudo apt-get install imagemagick optipng gifsicle webp
   ```

2. Run the compression script:
   ```bash
   chmod +x compress_images.sh
   ./compress_images.sh
   ```

3. Review the compressed images in the `compressed` directory

4. If satisfied, replace the original images with the compressed versions

5. Update HTML to use WebP with fallbacks and responsive images

## Additional Resources

- [Squoosh](https://squoosh.app/) - Browser-based image compression tool
- [TinyPNG](https://tinypng.com/) - Online PNG and JPEG compression
- [WebP Info](https://developers.google.com/speed/webp) - Google's WebP format
- [Responsive Images Guide](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images) - MDN Web Docs