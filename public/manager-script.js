document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const managerDashboard = document.getElementById('manager-dashboard');
    const logoutBtn = document.getElementById('logout-btn');
    const managerNameSpan = document.getElementById('manager-name');
    
    // Tab elements
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Stats elements
    const todayMatchesSpan = document.getElementById('today-matches');
    const unpaidMatchesSpan = document.getElementById('unpaid-matches');
    const totalHandledSpan = document.getElementById('total-handled');
    const totalFeesSpan = document.getElementById('total-fees');
    
    // Schedule elements
    const scheduleDate = document.getElementById('schedule-date');
    const loadScheduleBtn = document.getElementById('load-schedule');
    const scheduleGrid = document.getElementById('schedule-grid');
    
    // Report elements
    const reportPeriod = document.getElementById('report-period');
    const reportDate = document.getElementById('report-date');
    const generateReportBtn = document.getElementById('generate-report');
    const reportResults = document.getElementById('report-results');
    
    // Current manager info
    let currentManager = null;
    
    // Initialize
    init();
    
    function init() {
        // Check if manager is already logged in
        checkAuthStatus();
        
        // Event listeners
        loginForm.addEventListener('submit', handleLogin);
        logoutBtn.addEventListener('click', handleLogout);
        
        // Tab navigation
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('href').substring(1);
                switchTab(target);
            });
        });
        
        // Schedule controls
        loadScheduleBtn.addEventListener('click', loadSchedule);
        scheduleDate.addEventListener('change', loadSchedule);
        
        // Report controls
        generateReportBtn.addEventListener('click', generateReport);
        
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        scheduleDate.value = today;
        reportDate.value = today;
    }
    
// --- Custom Alert/Confirm Functions (Add these to manager-script.js) ---
function showCustomModal(title, message, isConfirm, callback) {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('custom-modal-title');
    const modalMessage = document.getElementById('custom-modal-message');
    const okButton = document.getElementById('custom-modal-ok');
    const cancelButton = document.getElementById('custom-modal-cancel');

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    if (isConfirm) {
        okButton.textContent = 'نعم'; // Yes
        cancelButton.textContent = 'إلغاء'; // Cancel
        cancelButton.style.display = 'inline-block';
    } else {
        okButton.textContent = 'موافق'; // OK
        cancelButton.style.display = 'none';
    }

    modal.style.display = 'flex'; // Show the modal

    return new Promise(resolve => {
        okButton.onclick = () => {
            modal.style.display = 'none';
            if (isConfirm) {
                resolve(true);
            } else {
                resolve();
            }
            if (callback) callback(true); // For confirm, pass true
        };

        cancelButton.onclick = () => {
            modal.style.display = 'none';
            resolve(false);
            if (callback) callback(false); // For confirm, pass false
        };

        // Close modal if clicked outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                if (isConfirm) {
                    resolve(false);
                } else {
                    resolve();
                }
                if (callback) callback(false); // For confirm, pass false
            }
        };
    });
}

function showAlert(message, title = 'تنبيه') {
    return showCustomModal(title, message, false);
}

function showConfirm(message, title = 'تأكيد') {
    return showCustomModal(title, message, true);
}
// --- End Custom Alert/Confirm Functions ---

    // Check authentication status
    function checkAuthStatus() {
        fetch('/api/auth/manager/check')
            .then(response => response.json())
            .then(data => {
                if (data.authenticated && data.user) {
                    currentManager = data.user;
                    showDashboard();
                } else {
                    showLoginModal();
                }
            })
            .catch(error => {
                console.error('Auth check error:', error);
                showLoginModal();
            });
    }
    
    // Handle login
    function handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        fetch('/api/auth/manager/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                currentManager = data.user;
                showDashboard();
            } else {
                showAlert('خطأ في تسجيل الدخول: ' + (data.error || 'بيانات خاطئة'), 'خطأ في تسجيل الدخول');
            }
        })
        .catch(error => {
            console.error('Login error:', error);
            showAlert('حدث خطأ في تسجيل الدخول', 'خطأ');
        });
    }
    
    // Handle logout
    function handleLogout() {
        fetch('/api/auth/manager/logout', { method: 'POST' })
            .then(() => {
                currentManager = null;
                window.location.href = '/';
            })
            .catch(error => {
                console.error('Logout error:', error);
                window.location.href = '/';
            });
    }
    
    // Show login modal
    function showLoginModal() {
        loginModal.style.display = 'block';
        managerDashboard.style.display = 'none';
        loginForm.reset();
    }
    
    // Show dashboard
    function showDashboard() {
        loginModal.style.display = 'none';
        managerDashboard.style.display = 'block';
        
        if (currentManager) {
            managerNameSpan.textContent = currentManager.name || 'مدير الملعب';
        }
        
        // Load dashboard data
        loadDashboardStats();
        loadSchedule();
    }
    
    // Switch tabs
    window.switchTab = function(tabName) {
        // Update nav links
        navLinks.forEach(link => link.classList.remove('active'));
        document.querySelector(`[href="#${tabName}"]`).classList.add('active');
        
        // Update tab contents
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(tabName).classList.add('active');
        
        // Load tab-specific data
        if (tabName === 'schedule') {
            loadSchedule();
        } else if (tabName === 'reports') {
            generateReport();
        }
    };
    
    // Load dashboard statistics
    function loadDashboardStats() {
        const today = new Date().toISOString().split('T')[0];
        
        // Today's matches
        fetch(`/api/manager/matches?date=${today}`)
            .then(response => response.json())
            .then(data => {
                todayMatchesSpan.textContent = data.matches ? data.matches.length : 0;
                
                // Count unpaid matches
                const unpaidCount = data.matches ? data.matches.filter(m => !m.paid).length : 0;
                unpaidMatchesSpan.textContent = unpaidCount;
            })
            .catch(error => {
                console.error('Error loading today matches:', error);
            });
        
        // Total handled matches and fees
        fetch('/api/manager/stats')
            .then(response => response.json())
            .then(data => {
                totalHandledSpan.textContent = data.totalHandled || 0;
                totalFeesSpan.textContent = data.totalFees || 0;
            })
            .catch(error => {
                console.error('Error loading stats:', error);
            });
    }
    
    // Load schedule
    function loadSchedule() {
        const date = scheduleDate.value;
        if (!date) return;
        
        scheduleGrid.innerHTML = '<div class="loading">جاري تحميل الجدول...</div>';
        
        fetch(`/api/manager/matches?date=${date}`)
            .then(response => response.json())
            .then(data => {
                displaySchedule(data.matches || []);
            })
            .catch(error => {
                console.error('Error loading schedule:', error);
                scheduleGrid.innerHTML = '<div class="error">حدث خطأ في تحميل الجدول</div>';
            });
    }
    
    // Display schedule
    function displaySchedule(matches) {
        if (matches.length === 0) {
            scheduleGrid.innerHTML = '<div class="no-data">لا توجد مباريات في هذا التاريخ</div>';
            return;
        }
        
        scheduleGrid.innerHTML = matches.map(match => `
            <div class="schedule-item ${match.status === 'confirmed' ? 'confirmed' : 'pending'}">
                <div class="schedule-header">
                    <h3>${formatTime12Hour(match.start_time)} - ${formatTime12Hour(match.end_time)}</h3>
                    <span class="status-badge ${match.status}">${getStatusText(match.status)}</span>
                </div>
                <div class="schedule-details">
                    <p><strong>الاسم:</strong> ${match.name}</p>
                    <p><strong>الهاتف:</strong> ${match.phone}</p>
                    <p><strong>الحالة:</strong> ${match.paid ? 'مدفوع' : 'غير مدفوع'}</p>
                    ${match.collected_by ? `<p><strong>تم التحصيل بواسطة:</strong> ${match.collected_by}</p>` : ''}
                </div>
                ${match.status === 'confirmed' && !match.paid ? `
                    <div class="schedule-actions">
                        <button class="btn-success" onclick="markAsPaid(${match.id})">
                            <i class="fas fa-check"></i> تأكيد الدفع
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }
    
    // Mark as paid
    window.markAsPaid = function(bookingId) {
        showConfirm('هل أنت متأكد من تأكيد الدفع؟').then(result => {
            if (result) {
                fetch(`/api/manager/mark-paid/${bookingId}`, { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        if (data.message) {
                            showAlert('تم تأكيد الدفع بنجاح', 'نجاح');
                            loadSchedule();
                            loadDashboardStats();
                        } else {
                            showAlert('حدث خطأ: ' + (data.error || 'خطأ غير محدد'), 'خطأ');
                        }
                    })
                    .catch(error => {
                        console.error('Error marking as paid:', error);
                        showAlert('حدث خطأ في تأكيد الدفع', 'خطأ');
                    });
            }
        });
    };
    
    // Mark all as paid
    window.markAllPaid = function() {
        showConfirm('هل أنت متأكد من تأكيد دفع جميع مباريات اليوم؟').then(result => {
            if (result) {
                const today = new Date().toISOString().split('T')[0];
                
                fetch('/api/manager/mark-all-paid', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: today })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.message) {
                        showAlert(`تم تأكيد دفع ${data.count} مباراة بنجاح`, 'نجاح');
                        loadSchedule();
                        loadDashboardStats();
                    } else {
                        showAlert('حدث خطأ: ' + (data.error || 'خطأ غير محدد'), 'خطأ');
                    }
                })
                .catch(error => {
                    console.error('Error marking all as paid:', error);
                    showAlert('حدث خطأ في تأكيد المدفوعات', 'خطأ');
                });
            }
        });
    };
    
    // Generate report
    function generateReport() {
        const period = document.getElementById('report-period').value;
        const date = document.getElementById('report-date').value;
        
        if (!date) {
            showAlert('يرجى اختيار تاريخ', 'خطأ في الإدخال');
            return;
        }
        
        fetch(`/api/manager/report?period=${period}&date=${date}`)
            .then(response => response.json())
            .then(data => {
                displayReport(data);
            })
            .catch(error => {
                console.error('Error generating report:', error);
                showAlert('حدث خطأ في إنشاء التقرير', 'خطأ');
            });
    }
    
    // Display report
    function displayReport(data) {
        document.getElementById('matches-handled').textContent = data.matchesHandled || 0;
        document.getElementById('payments-collected').textContent = data.paymentsCollected || 0;
        document.getElementById('fees-earned').textContent = data.feesEarned || 0;
    }
    
    // Get status text
    function getStatusText(status) {
        const statusMap = {
            'pending': 'في الانتظار',
            'confirmed': 'مؤكد',
            'cancelled': 'ملغي',
            'declined': 'مرفوض'
        };
        return statusMap[status] || status;
    }
    
    // Format date
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    }
    
    // Convert 24-hour time to 12-hour AM/PM format
    function formatTime12Hour(time24) {
        const [hours, minutes] = time24.split(':');
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        return `${hour12}:${minutes} ${ampm}`;
    }
    
    // Auto-refresh dashboard every 5 minutes
    setInterval(() => {
        if (currentManager && document.getElementById('dashboard').classList.contains('active')) {
            loadDashboardStats();
        }
    }, 300000); // 5 minutes
});