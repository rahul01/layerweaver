// Gallery page specific JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Gallery filtering functionality
    const filterButtons = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    // Check for filter parameter in URL hash
    function applyFilterFromHash() {
        if (window.location.hash) {
            const hashParams = window.location.hash.substring(1).split('=');
            if (hashParams.length === 2 && hashParams[0] === 'filter') {
                const filterValue = hashParams[1];
                const targetButton = document.querySelector(`.filter-btn[data-filter="${filterValue}"]`);
                
                if (targetButton) {
                    // Remove active class from all buttons
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    
                    // Add active class to target button
                    targetButton.classList.add('active');
                    
                    // Filter gallery items
                    galleryItems.forEach(item => {
                        if (filterValue === 'all' || item.getAttribute('data-category') === filterValue) {
                            item.style.display = 'block';
                        } else {
                            item.style.display = 'none';
                        }
                    });
                    
                    // Re-initialize layout
                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                    }, 100);
                }
            }
        }
    }
    
    // Apply filter from URL hash when page loads
    applyFilterFromHash();
    
    // Listen for hash changes
    window.addEventListener('hashchange', applyFilterFromHash);

    // Add click event to filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Get filter value
            const filterValue = button.getAttribute('data-filter');
            
            // Update URL hash to store the filter selection
            // This prevents losing the filter on page refresh
            window.location.hash = `filter=${filterValue}`;
            
            // Filter gallery items
            galleryItems.forEach(item => {
                if (filterValue === 'all' || item.getAttribute('data-category') === filterValue) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
            
            // Re-initialize masonry layout after filtering
            // This timeout allows the items to be hidden/shown before recalculating layout
            setTimeout(() => {
                // Force browser to recalculate layout
                window.dispatchEvent(new Event('resize'));
            }, 100);
        });
    });
    
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