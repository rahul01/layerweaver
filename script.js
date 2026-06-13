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
        
        // Create and append navigation arrows
        const testimonialSlider = document.querySelector('.testimonial-slider');
        if (testimonialSlider) {
            // Create previous arrow
            const prevArrow = document.createElement('div');
            prevArrow.className = 'testimonial-arrow testimonial-prev';
            prevArrow.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            testimonialSlider.appendChild(prevArrow);
            
            // Create next arrow
            const nextArrow = document.createElement('div');
            nextArrow.className = 'testimonial-arrow testimonial-next';
            nextArrow.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            testimonialSlider.appendChild(nextArrow);
            
            // Add click events to arrows
            prevArrow.addEventListener('click', prevSlide);
            nextArrow.addEventListener('click', nextSlide);
            
            // Add keyboard navigation
            document.addEventListener('keydown', function(e) {
                if (e.key === 'ArrowLeft') {
                    prevSlide();
                } else if (e.key === 'ArrowRight') {
                    nextSlide();
                }
            });
        }
        
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
        
        function prevSlide() {
            let prevIndex = currentSlide - 1;
            if (prevIndex < 0) {
                prevIndex = slides.length - 1;
            }
            showSlide(prevIndex);
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
    
    // Contact form and newsletter code removed (no forms in current design)
    
    // Header scroll effect
    const header = document.querySelector('header');
    if (header) {
        const collectionTopbar = document.querySelector('.collection-topbar');
        window.addEventListener('scroll', function() {
            if (window.scrollY > 100) {
                header.style.padding = '10px 0';
                header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
                if (collectionTopbar) collectionTopbar.style.top = '70px';
            } else {
                header.style.padding = '15px 0';
                header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
                if (collectionTopbar) collectionTopbar.style.top = '80px';
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

    // Hero carousel
    const heroTrack = document.querySelector('.hero-carousel-track');
    const heroSlides = document.querySelectorAll('.hero-carousel-slide');
    const heroDots = document.querySelectorAll('.hero-dot');
    if (heroTrack && heroSlides.length > 0) {
        let current = 0;
        let timer;

        function goTo(n) {
            heroSlides[current].classList.remove('active');
            heroDots[current].classList.remove('active');
            current = (n + heroSlides.length) % heroSlides.length;
            heroSlides[current].classList.add('active');
            heroDots[current].classList.add('active');
            heroTrack.style.transform = `translateX(-${current * 100}%)`;
        }

        function startTimer() {
            clearInterval(timer);
            timer = setInterval(() => goTo(current + 1), 4000);
        }

        heroDots.forEach((dot, i) => dot.addEventListener('click', () => { goTo(i); startTimer(); }));

        const heroCarousel = document.querySelector('.hero-carousel');
        heroCarousel.addEventListener('mouseenter', () => clearInterval(timer));
        heroCarousel.addEventListener('mouseleave', startTimer);

        startTimer();
    }

    // Universal click tracking via event delegation
    document.addEventListener('click', function(e) {
        if (typeof gtag !== 'function') return;
        const el = e.target.closest('a, button');
        if (!el) return;

        const href = el.href || '';
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
        const page = location.pathname;

        let type = null;

        if (href.includes('wa.me'))                                                   type = 'whatsapp';
        else if (href.includes('instagram.com'))                                      type = 'instagram';
        else if (el.closest('.shop-trust-strip'))                                     type = 'trust_strip';
        else if (el.closest('.footer-nav'))                                           type = 'footer_nav';
        else if (el.closest('.nav-links, .shop-nav'))                                 type = 'nav';
        else if (el.closest('.workshop-cta, .enroll-cta') || /enroll|register|book/i.test(label)) type = 'enroll';
        else if (el.classList.contains('btn-primary') || el.classList.contains('btn-secondary'))   type = 'cta';

        if (type) gtag('event', 'click', { type, label, page });
    });
});