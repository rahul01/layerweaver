# LayerWeaver - 3D Printing Studio Website

This is a modern, responsive website for LayerWeaver, a professional 3D printing studio. The website showcases the studio's services, portfolio, and expertise in 3D printing technology.

## Features

- **Responsive Design**: Fully responsive layout that works on all devices
- **Modern UI**: Clean, modern design based on the LayerWeaver brand colors
- **Optimized Images**: WebP support with fallbacks, 80% smaller than originals
- **Interactive Elements**: JavaScript-powered interactive components
- **Service Showcasing**: Dedicated sections for various 3D printing services
- **Staggered Gallery**: Masonry-style gallery with original image aspect ratios
- **Testimonials**: Carousel display of client testimonials
- **About Section**: Story behind LayerWeaver and Raghav's inspiration

## Technologies Used

- HTML5 (with modern picture elements for optimized images)
- CSS3 (with Flexbox, Grid layouts, and CSS column layout for gallery)
- JavaScript (Vanilla JS for interactivity and animations)
- WebP (next-gen image format with fallbacks for older browsers)
- SVG (for logo and graphics)
- Science Gothic (for brand typography)

## Color Scheme

The color scheme is derived from the LayerWeaver logo:

- Primary Color (Purple): #A083D5
- Secondary Color (Yellow): #EFCF20
- Dark: #000000
- Light: #FFFFFF

## File Structure

```
layerweaver/
│
├── index.html                # Main HTML file
├── styles.css                # CSS styles
├── script.js                 # JavaScript functionality
├── layerweaver.svg           # Original logo file
│
├── images/                   # Image directory
│   ├── gallery/              # Gallery images (optimized)
│   │   └── webp/             # WebP versions of gallery images
│   ├── feedback/             # Feedback/testimonial images
│   │   └── webp/             # WebP versions of feedback images
│   ├── layerweaver-logo.svg  # Standard logo
│   ├── layerweaver-logo-white.svg # White version for dark backgrounds
│   └── spider-fevicon.svg    # Favicon
│
├── scripts/                  # Utility scripts
│   ├── compress_images.sh    # Script for image compression
│   ├── install_tools.sh      # Script for installing optimization tools
│   └── update_remaining_gallery.sh # Helper for WebP conversion
│
├── IMAGE_OPTIMIZATION.md     # Documentation for image optimization
└── README.md                 # This file
```

## Browser Compatibility

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Opera (latest)

## Setup and Usage

1. Clone or download the repository
2. Open `index.html` in your browser to view the site

## Performance Optimizations

- **Image Compression**: All images compressed to reduce file sizes by 80%
- **WebP Support**: Modern WebP format with fallbacks for older browsers
- **Lazy Loading**: All images use lazy loading for better performance
- **Responsive Images**: Different image sizes for different screen sizes
- **Efficient CSS**: Clean, modular CSS with minimal redundancy

## Future Enhancements

- Add a blog section for 3D printing tips and news
- Implement an e-commerce solution for online ordering
- Add a gallery lightbox functionality for detailed views
- Integrate a proper backend for form submissions
- Add a booking system for consultations

## License

This project is proprietary and belongs to LayerWeaver.

## Credits

- Fonts: Google Fonts (Montserrat, Open Sans, Science Gothic)
- Icons: Font Awesome 6
- Image Optimization: ImageMagick, OptiPNG, GIFsicle, WebP