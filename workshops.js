document.addEventListener('DOMContentLoaded', function() {
    // Accordion functionality
    const accordionItems = document.querySelectorAll('.accordion-item');

    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const content = item.querySelector('.accordion-content');
        const icon = item.querySelector('.accordion-icon i');

        header.addEventListener('click', () => {
            item.classList.toggle('active');

            if (item.classList.contains('active')) {
                icon.classList.remove('fa-plus');
                icon.classList.add('fa-minus');
                content.style.maxHeight = content.scrollHeight + 'px';
                // Grow parent card body to fit newly expanded accordion
                expandParentCardBody(content);
            } else {
                icon.classList.remove('fa-minus');
                icon.classList.add('fa-plus');
                content.style.maxHeight = null;
                // Shrink parent card body
                expandParentCardBody(content);
            }
        });
    });

    function expandParentCardBody(el) {
        const body = el.closest('.course-card-body');
        if (body && body.style.maxHeight && body.style.maxHeight !== '') {
            // Recalculate after a tick so accordion content has updated
            setTimeout(() => {
                body.style.maxHeight = body.scrollHeight + 'px';
            }, 0);
        }
    }

    // Collapsible course card sections
    const courseCardHeaders = document.querySelectorAll('.course-card-header');

    courseCardHeaders.forEach(header => {
        const card = header.closest('.course-card');
        const body = card.querySelector('.course-card-body');

        // Set initial max-height based on default state
        body.style.maxHeight = card.classList.contains('collapsed') ? '0px' : body.scrollHeight + 'px';

        header.addEventListener('click', () => {
            if (card.classList.contains('collapsed')) {
                // Expand
                card.classList.remove('collapsed');
                body.style.maxHeight = body.scrollHeight + 'px';
                // After transition, clear inline style so accordion expansion isn't capped
                body.addEventListener('transitionend', function onEnd() {
                    if (!card.classList.contains('collapsed')) {
                        body.style.maxHeight = '';
                    }
                    body.removeEventListener('transitionend', onEnd);
                }, { once: true });
            } else {
                // Collapse: pin the current height first so transition has a start value
                body.style.maxHeight = body.scrollHeight + 'px';
                body.getBoundingClientRect(); // force reflow
                card.classList.add('collapsed');
                body.style.maxHeight = '0px';
            }
        });
    });

    // Share buttons
    document.querySelectorAll('.course-share-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const card = btn.closest('.course-card');
            const id = card.id;
            const url = `https://www.layerweaver.com/workshop/${id ? '#' + id : ''}`;
            const title = card.querySelector('h3').textContent.trim();

            if (navigator.share) {
                navigator.share({ title, url }).catch(() => {});
            } else {
                navigator.clipboard.writeText(url).then(() => {
                    btn.classList.add('copied');
                    btn.textContent = 'Copied!';
                    setTimeout(() => {
                        btn.classList.remove('copied');
                        btn.textContent = 'Share';
                    }, 2000);
                });
            }
        });
    });

    // Hash-based deep link: expand the target card, collapse others
    const hash = window.location.hash.slice(1);
    if (hash) {
        const target = document.getElementById(hash);
        if (target && target.classList.contains('course-card')) {
            document.querySelectorAll('.course-card').forEach(card => {
                const body = card.querySelector('.course-card-body');
                if (card === target) {
                    card.classList.remove('collapsed');
                    body.style.maxHeight = '';
                } else {
                    card.classList.add('collapsed');
                    body.style.maxHeight = '0px';
                }
            });
            setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }
});
