// Gallery page specific JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Gallery items
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    // Add lightbox functionality for gallery items
    const galleryImages = document.querySelectorAll('.gallery-item img');
    
    // Create lightbox elements
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <span class="close-lightbox">&times;</span>
            <img class="lightbox-image">
            <div class="lightbox-caption"></div>
            <div class="lightbox-controls">
                <button class="lightbox-prev"><i class="fa-solid fa-chevron-left"></i></button>
                <button class="lightbox-next"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
        </div>
    `;
    document.body.appendChild(lightbox);
    
    // Get lightbox elements
    const lightboxContent = document.querySelector('.lightbox-content');
    const lightboxImage = document.querySelector('.lightbox-image');
    const lightboxCaption = document.querySelector('.lightbox-caption');
    const closeLightbox = document.querySelector('.close-lightbox');
    const lightboxPrev = document.querySelector('.lightbox-prev');
    const lightboxNext = document.querySelector('.lightbox-next');
    
    // Current image index
    let currentImageIndex = 0;
    
    // Open lightbox on image click
    galleryImages.forEach((image, index) => {
        image.addEventListener('click', () => {
            currentImageIndex = index;
            openLightbox(image);
        });
    });
    
    // Close lightbox on close button click
    closeLightbox.addEventListener('click', () => {
        lightbox.style.display = 'none';
    });
    
    // Close lightbox on outside click
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            lightbox.style.display = 'none';
        }
    });
    
    // Navigate to previous image
    lightboxPrev.addEventListener('click', () => {
        if (currentImageIndex > 0) {
            currentImageIndex--;
        } else {
            currentImageIndex = galleryImages.length - 1;
        }
        updateLightbox();
    });
    
    // Navigate to next image
    lightboxNext.addEventListener('click', () => {
        if (currentImageIndex < galleryImages.length - 1) {
            currentImageIndex++;
        } else {
            currentImageIndex = 0;
        }
        updateLightbox();
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (lightbox.style.display === 'flex') {
            if (e.key === 'ArrowLeft') {
                lightboxPrev.click();
            } else if (e.key === 'ArrowRight') {
                lightboxNext.click();
            } else if (e.key === 'Escape') {
                lightbox.style.display = 'none';
            }
        }
    });
    
    // Open lightbox with image
    function openLightbox(image) {
        const src = image.src;
        const altText = image.alt;
        
        lightboxImage.src = src;
        lightboxCaption.textContent = altText;
        lightbox.style.display = 'flex';
    }
    
    // Update lightbox content
    function updateLightbox() {
        const currentImage = galleryImages[currentImageIndex];
        lightboxImage.src = currentImage.src;
        lightboxCaption.textContent = currentImage.alt;
    }
});