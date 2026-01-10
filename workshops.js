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
    
    // Enrollment modal functionality removed as it's now a separate page
});