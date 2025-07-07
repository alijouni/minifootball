document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const dateInput = document.getElementById('booking-date');
    const timeSlotsContainer = document.getElementById('time-slots');
    const bookingForm = document.getElementById('booking-form');
    const bookingFormElement = document.getElementById('booking-form-element');
    const successMessage = document.getElementById('success-message');
    const whatsappButton = document.getElementById('whatsapp-button');
    
    // Set today as default date
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.min = today;
    
    let selectedSlot = null;
    let currentDate = today;
    
    // Load settings and time slots
    loadSettings();
    loadTimeSlots(today);
    
    // Event listeners
    dateInput.addEventListener('change', function() {
        currentDate = this.value;
        loadTimeSlots(currentDate);
    });
    
    bookingFormElement.addEventListener('submit', handleBookingSubmission);
    whatsappButton.addEventListener('click', openWhatsApp);
    
    // Login functionality
    const loginBtn = document.getElementById('login-btn');
    const loginModal = document.getElementById('login-modal');
    const closeModal = document.getElementById('close-modal');
    const loginForm = document.getElementById('login-form');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', showLoginModal);
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', hideLoginModal);
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (loginModal) {
        loginModal.addEventListener('click', function(e) {
            if (e.target === loginModal) {
                hideLoginModal();
            }
        });
    }
    
    // Load settings from server
    function loadSettings() {
        fetch('/api/settings')
            .then(response => response.json())
            .then(settings => {
                // Update rental price display
                const priceElement = document.getElementById('rental-price');
                if (priceElement && settings.rental_price) {
                    // Format price with thousands separator
                    const formattedPrice = parseInt(settings.rental_price).toLocaleString('en-US');
                    priceElement.textContent = formattedPrice;
                }
                
                // Set WhatsApp number
                if (settings.whatsapp_number) {
                    whatsappButton.setAttribute('data-phone', settings.whatsapp_number);
                }
            })
            .catch(error => {
                console.error('Error loading settings:', error);
            });
    }
    
    // Load available time slots
    function loadTimeSlots(date) {
        timeSlotsContainer.innerHTML = '<div class="loading">جاري تحميل الأوقات المتاحة...</div>';
        
        fetch(`/api/bookings/slots/${date}`)
            .then(response => response.json())
            .then(slots => {
                displayTimeSlots(slots);
            })
            .catch(error => {
                console.error('Error loading time slots:', error);
                timeSlotsContainer.innerHTML = '<div class="loading">خطأ في تحميل الأوقات المتاحة</div>';
            });
    }
    
    // Convert 24-hour time to 12-hour AM/PM format
    function formatTime12Hour(time24) {
        const [hours, minutes] = time24.split(':');
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        return `${hour12}:${minutes} ${ampm}`;
    }

    // Display time slots
    function displayTimeSlots(slots) {
        if (slots.length === 0) {
            timeSlotsContainer.innerHTML = '<div class="loading">لا توجد أوقات في هذا التاريخ</div>';
            return;
        }
        
        timeSlotsContainer.innerHTML = '';
        
        slots.forEach(slot => {
            const slotElement = document.createElement('div');
            
            if (slot.available) {
                slotElement.className = 'time-slot available';
                slotElement.innerHTML = `
                    <h3>${formatTime12Hour(slot.start)} - ${formatTime12Hour(slot.end)}</h3>
                    <p>متاح للحجز</p>
                `;
                slotElement.addEventListener('click', () => selectTimeSlot(slot, slotElement));
            } else {
                slotElement.className = 'time-slot booked';
                slotElement.innerHTML = `
                    <h3>${formatTime12Hour(slot.start)} - ${formatTime12Hour(slot.end)}</h3>
                    <p>محجوز</p>
                `;
            }
            
            timeSlotsContainer.appendChild(slotElement);
        });
    }
    
    // Select time slot
    function selectTimeSlot(slot, element) {
        // Only allow selection of available slots
        if (!slot.available) {
            return;
        }
        
        // Remove previous selection
        const previousSelected = document.querySelector('.time-slot.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }
        
        // Select new slot
        element.classList.add('selected');
        selectedSlot = slot;
        
        // Show booking form
        showBookingForm();
    }
    
    // Show booking form
    function showBookingForm() {
        if (!selectedSlot) return;
        
        // Update selected slot display
        document.getElementById('selected-date').textContent = `التاريخ: ${formatDate(currentDate)}`;
        document.getElementById('selected-time').textContent = `الوقت: ${formatTime12Hour(selectedSlot.start)} - ${formatTime12Hour(selectedSlot.end)}`;
        
        // Show form
        bookingForm.style.display = 'block';
        bookingForm.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Handle booking form submission
    function handleBookingSubmission(e) {
        e.preventDefault();
        
        if (!selectedSlot) {
            alert('يرجى اختيار وقت أولاً');
            return;
        }
        
        const formData = new FormData(bookingFormElement);
        const bookingData = {
            name: document.getElementById('customer-name').value,
            phone: document.getElementById('customer-phone').value,
            date: currentDate,
            start_time: selectedSlot.start,
            end_time: selectedSlot.end
        };
        
        // Validate form
        if (!bookingData.name || !bookingData.phone) {
            alert('يرجى ملء جميع الحقول');
            return;
        }
        
        // Validate phone number (must be exactly 8 digits)
        const phoneRegex = /^[0-9]{8}$/;
        if (!phoneRegex.test(bookingData.phone)) {
            alert('رقم الهاتف يجب أن يكون 8 أرقام بالضبط');
            return;
        }
        
        // Submit booking
        const submitButton = bookingFormElement.querySelector('.submit-btn');
        submitButton.disabled = true;
        submitButton.textContent = 'جاري الإرسال...';
        
        fetch('/api/bookings/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookingData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                showSuccessMessage();
            } else {
                throw new Error(data.error || 'حدث خطأ غير متوقع');
            }
        })
        .catch(error => {
            console.error('Error submitting booking:', error);
            alert('حدث خطأ في الإرسال: ' + error.message);
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'إرسال الطلب';
        });
    }
    
    // Show success message
    function showSuccessMessage() {
        bookingForm.style.display = 'none';
        successMessage.style.display = 'block';
        successMessage.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Reset booking form
    window.resetBooking = function() {
        bookingForm.style.display = 'none';
        successMessage.style.display = 'none';
        bookingFormElement.reset();
        selectedSlot = null;
        
        // Remove selection
        const selectedElement = document.querySelector('.time-slot.selected');
        if (selectedElement) {
            selectedElement.classList.remove('selected');
        }
        
        // Reload time slots
        loadTimeSlots(currentDate);
        
        // Scroll to booking section
        document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
    };
    
    // Cancel booking
    window.cancelBooking = function() {
        bookingForm.style.display = 'none';
        bookingFormElement.reset();
        selectedSlot = null;
        
        // Remove selection
        const selectedElement = document.querySelector('.time-slot.selected');
        if (selectedElement) {
            selectedElement.classList.remove('selected');
        }
    };
    
    // Open WhatsApp
    function openWhatsApp() {
        const phoneNumber = whatsappButton.getAttribute('data-phone') || '1234567890';
        const message = 'مرحباً، لدي استفسار حول حجز الملعب.';
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    }
    
    // Format date to Gregorian
    function formatDate(dateString) {
        const date = new Date(dateString);
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        };
        return date.toLocaleDateString('en-GB', options);
    }
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Add fade-in animation on scroll
    function addFadeInAnimation() {
        const elements = document.querySelectorAll('.time-slot, .contact-item');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in', 'visible');
                }
            });
        });
        
        elements.forEach(element => {
            element.classList.add('fade-in');
            observer.observe(element);
        });
    }
    
    // Initialize animations
    addFadeInAnimation();
    
    // Add bounce animation to CTA button
    setTimeout(() => {
        const ctaButton = document.querySelector('.cta-button');
        if (ctaButton) {
            ctaButton.classList.add('bounce');
        }
    }, 1000);
    
    // Login functions
    function showLoginModal() {
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.style.display = 'block';
        }
    }
    
    function hideLoginModal() {
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.style.display = 'none';
        }
    }
    
    function handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        if (!username || !password) {
            alert('يرجى ملء جميع الحقول');
            return;
        }
        
        const button = e.target.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = 'جاري تسجيل الدخول...';
        
        // Try admin login first
        fetch('/api/auth/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                // Admin login successful
                window.location.href = '/admin';
            } else {
                // Try manager login
                return fetch('/api/auth/manager/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
            }
        })
        .then(response => {
            if (response) {
                return response.json();
            }
            return null;
        })
        .then(data => {
            if (data && data.message) {
                // Manager login successful
                window.location.href = '/manager';
            } else if (data) {
                // Neither admin nor manager
                alert('بيانات تسجيل الدخول غير صحيحة');
            }
        })
        .catch(error => {
            console.error('Login error:', error);
            alert('حدث خطأ في تسجيل الدخول');
        })
        .finally(() => {
            button.disabled = false;
            button.textContent = 'تسجيل الدخول';
        });
    }
    
    // Mobile Navigation
    function initializeMobileNav() {
        const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
        
        // Add click event listeners
        mobileNavItems.forEach(item => {
            item.addEventListener('click', function() {
                const sectionId = this.getAttribute('data-section');
                
                // Remove active class from all items
                mobileNavItems.forEach(navItem => {
                    navItem.classList.remove('active');
                });
                
                // Add active class to clicked item
                this.classList.add('active');
                
                // Scroll to section
                const targetSection = document.getElementById(sectionId);
                if (targetSection) {
                    targetSection.scrollIntoView({ 
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
        
        // Update active state on scroll
        function updateActiveNavItem() {
            const sections = document.querySelectorAll('section[id]');
            let currentSection = '';
            
            sections.forEach(section => {
                const rect = section.getBoundingClientRect();
                if (rect.top <= 100 && rect.bottom >= 100) {
                    currentSection = section.id;
                }
            });
            
            if (currentSection) {
                mobileNavItems.forEach(item => {
                    item.classList.remove('active');
                    if (item.getAttribute('data-section') === currentSection) {
                        item.classList.add('active');
                    }
                });
            }
        }
        
        // Listen for scroll events
        window.addEventListener('scroll', updateActiveNavItem);
        
        // Set initial active state
        updateActiveNavItem();
    }
    
    // Initialize mobile navigation
    initializeMobileNav();
}); 