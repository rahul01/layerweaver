// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Mobile navigation toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    if (hamburger) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking a nav link
    const navItems = document.querySelectorAll('.nav-links a');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            if (hamburger.classList.contains('active')) {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
            }
        });
    });
    
    // Testimonial slider functionality
    let currentSlide = 0;
    const slides = document.querySelectorAll('.testimonial-slide');
    const dots = document.querySelectorAll('.dot');
    
    // Only initialize if elements exist
    if (slides.length > 0 && dots.length > 0) {
        // Hide all slides except the first one
        for (let i = 1; i < slides.length; i++) {
            slides[i].style.display = 'none';
        }
        
        // Add click event to dots
        dots.forEach((dot, index) => {
            dot.addEventListener('click', function() {
                showSlide(index);
            });
        });
        
        // Auto slide change
        setInterval(function() {
            nextSlide();
        }, 5000);
        
        function showSlide(index) {
            // Hide current slide
            slides[currentSlide].style.display = 'none';
            dots[currentSlide].classList.remove('active');
            
            // Show selected slide
            currentSlide = index;
            slides[currentSlide].style.display = 'block';
            dots[currentSlide].classList.add('active');
        }
        
        function nextSlide() {
            let nextIndex = currentSlide + 1;
            if (nextIndex >= slides.length) {
                nextIndex = 0;
            }
            showSlide(nextIndex);
        }
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 80, // Offset for fixed header
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Form submission with validation
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Basic validation
            let valid = true;
            const name = document.getElementById('name');
            const email = document.getElementById('email');
            const message = document.getElementById('message');
            
            // Reset error states
            [name, email, message].forEach(field => {
                field.style.borderColor = '';
            });
            
            // Validate required fields
            if (!name.value.trim()) {
                name.style.borderColor = 'red';
                valid = false;
            }
            
            if (!email.value.trim()) {
                email.style.borderColor = 'red';
                valid = false;
            } else {
                // Simple email validation
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailPattern.test(email.value)) {
                    email.style.borderColor = 'red';
                    valid = false;
                }
            }
            
            if (!message.value.trim()) {
                message.style.borderColor = 'red';
                valid = false;
            }
            
            if (valid) {
                // In a real application, you would send the form data to a server here
                
                // For demo purposes, show a success message
                const formButton = document.querySelector('.form-button');
                const successMessage = document.createElement('div');
                successMessage.className = 'form-success';
                successMessage.textContent = 'Thank you for your message! We will get back to you soon.';
                successMessage.style.color = 'green';
                successMessage.style.marginTop = '10px';
                
                // Check if success message already exists
                if (!document.querySelector('.form-success')) {
                    formButton.after(successMessage);
                }
                
                // Reset the form
                contactForm.reset();
            }
        });
    }
    
    // Newsletter form submission
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const emailInput = this.querySelector('input[type="email"]');
            if (emailInput && emailInput.value.trim()) {
                // In a real application, you would send the email to a server here
                
                // For demo purposes, show a success message
                const successMessage = document.createElement('div');
                successMessage.className = 'newsletter-success';
                successMessage.textContent = 'Thank you for subscribing!';
                successMessage.style.color = 'var(--secondary)';
                successMessage.style.marginTop = '10px';
                
                // Check if success message already exists
                if (!document.querySelector('.newsletter-success')) {
                    this.after(successMessage);
                }
                
                // Reset the form
                this.reset();
            }
        });
    }
    
    // Header scroll effect
    const header = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 100) {
                header.style.padding = '10px 0';
                header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
            } else {
                header.style.padding = '15px 0';
                header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
            }
        });
    }
    
    // Gallery items (simplified version without filtering)
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    // Reveal animations on scroll
    const revealElements = document.querySelectorAll('.service-card, .gallery-item, .process-step');
    
    // Check if IntersectionObserver is supported
    if ('IntersectionObserver' in window && revealElements.length > 0) {
        const revealOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const revealObserver = new IntersectionObserver(function(entries, observer) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, revealOptions);
        
        revealElements.forEach(element => {
            // Set initial styles
            element.style.opacity = '0';
            element.style.transform = 'translateY(30px)';
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            
            revealObserver.observe(element);
        });
    } else {
        // Fallback for browsers that don't support IntersectionObserver
        revealElements.forEach(element => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        });
    }
});