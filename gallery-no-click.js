// Script to disable clicking on gallery items
document.addEventListener('DOMContentLoaded', function() {
    // Remove pointer cursor from gallery items
    const galleryItems = document.querySelectorAll('.gallery-item');
    galleryItems.forEach(item => {
        item.style.cursor = 'default';
    });
    
    // Remove click event listeners from gallery images
    const galleryImages = document.querySelectorAll('.gallery-item img');
    galleryImages.forEach(img => {
        // Clone and replace the image element to remove all event listeners
        const newImg = img.cloneNode(true);
        img.parentNode.replaceChild(newImg, img);
    });
    
    // Hide the lightbox
    const lightbox = document.querySelector('.lightbox');
    if (lightbox) {
        lightbox.style.display = 'none';
        // Remove it from DOM to ensure it can't be triggered
        lightbox.remove();
    }
    
    // Prevent default click behavior
    document.addEventListener('click', function(e) {
        if (e.target.closest('.gallery-item')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);
    
    console.log('Gallery click functionality disabled');
});