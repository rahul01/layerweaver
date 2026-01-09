document.addEventListener('DOMContentLoaded', function() {
    // Accordion functionality
    const accordionItems = document.querySelectorAll('.accordion-item');
    
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const content = item.querySelector('.accordion-content');
        const icon = item.querySelector('.accordion-icon i');
        
        header.addEventListener('click', () => {
            // Toggle the current item
            item.classList.toggle('active');
            
            // Change icon
            if (item.classList.contains('active')) {
                icon.classList.remove('fa-plus');
                icon.classList.add('fa-minus');
                content.style.maxHeight = content.scrollHeight + 'px';
            } else {
                icon.classList.remove('fa-minus');
                icon.classList.add('fa-plus');
                content.style.maxHeight = null;
            }
        });
    });

    // Syllabus download functionality was removed
    
    // Enrollment form modal functionality
    const enrollmentButtons = document.querySelectorAll('.open-enrollment-form');
    const enrollmentModal = document.getElementById('enrollment-modal');
    const closeModalButton = document.querySelector('.close-modal');
    
    // Open modal
    enrollmentButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            enrollmentModal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scrolling behind modal
        });
    });
    
    // Close modal
    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
            enrollmentModal.classList.remove('active');
            document.body.style.overflow = 'auto'; // Restore scrolling
        });
    }
    
    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === enrollmentModal) {
            enrollmentModal.classList.remove('active');
            document.body.style.overflow = 'auto'; // Restore scrolling
        }
    });
    
    // Close modal with ESC key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && enrollmentModal.classList.contains('active')) {
            enrollmentModal.classList.remove('active');
            document.body.style.overflow = 'auto'; // Restore scrolling
        }
    });
});