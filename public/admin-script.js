console.log("Admin script loaded");

// Global variables
let currentTab = 'dashboard';
let currentUser = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing admin panel");
    initializeEventListeners();
    checkAuth();
});

// --- Custom Alert/Confirm Functions (Add these to admin-script.js) ---
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

// Check if admin is authenticated
function checkAuth() {
        fetch('/api/auth/admin/check')
            .then(response => response.json())
            .then(data => {
                if (data.authenticated) {
                    currentUser = data.user;
                    showDashboard();
                    loadDashboardData();
                } else {
                    showLoginModal();
                }
            })
            .catch(error => {
                console.error('Error checking auth:', error);
                showLoginModal();
            });
    }

    // Initialize event listeners
    function initializeEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', handleLogin);
        
        // Logout button
        document.getElementById('logout-btn').addEventListener('click', handleLogout);
        
        // Navigation tabs
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                switchTab(this.getAttribute('href').substring(1));
            });
        });
        
        // Booking filters
        document.getElementById('filter-bookings').addEventListener('click', loadBookings);
        
        // Blacklist modal
        document.getElementById('add-blacklist-btn').addEventListener('click', showBlacklistModal);
        document.getElementById('blacklist-form').addEventListener('submit', handleBlacklistSubmit);
        
        // Settings form
        document.getElementById('settings-form').addEventListener('submit', handleSettingsSubmit);
        
        // Reports
        document.getElementById('generate-report').addEventListener('click', generateReport);
        

        // Users management forms
        const adminPasswordForm = document.getElementById('admin-password-form');
        const managerPasswordForm = document.getElementById('manager-password-form');
        if (adminPasswordForm) {
            adminPasswordForm.addEventListener('submit', handleAdminPasswordChange);
        }
        if (managerPasswordForm) {
            managerPasswordForm.addEventListener('submit', handleManagerPasswordChange);
        }
        
        // Modal close buttons
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', function() {
                this.closest('.modal').style.display = 'none';
            });
        });
    }

    // Show login modal
    function showLoginModal() {
        document.getElementById('login-modal').style.display = 'flex';
        document.getElementById('admin-dashboard').style.display = 'none';
    }

    // Show dashboard
    function showDashboard() {
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';
        
        if (currentUser) {
            document.getElementById('admin-username').textContent = currentUser.username;
        }
    }

    // Handle login
    function handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        fetch('/api/auth/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'فشل تسجيل الدخول');
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.message && data.user) {
                currentUser = data.user;
                showDashboard();
                loadDashboardData();
                document.getElementById('login-form').reset();
            } else {
                showAlert('خطأ في تسجيل الدخول: بيانات غير صحيحة', 'خطأ في تسجيل الدخول');
            }
        })
        .catch(error => {
            console.error('Login error:', error);
            showAlert('خطأ في تسجيل الدخول: ' + error.message, 'خطأ في تسجيل الدخول');
        });
    }

    // Handle logout
    function handleLogout() {
        fetch('/api/auth/admin/logout', {
            method: 'POST'
        })
        .then(() => {
            currentUser = null;
            window.location.href = '/';
        })
        .catch(error => {
            console.error('Error:', error);
            window.location.href = '/';
        });
    }

    // Switch tabs
    function switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[href="#${tabName}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
        
        currentTab = tabName;
        
        // Load tab-specific data
        switch(tabName) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'bookings':
                loadBookings();
                break;
            case 'blacklist':
                loadBlacklist();
                break;
            case 'users':
                loadUsersData();
                break;
            case 'settings':
                loadSettings();
                break;
            case 'reports':
                loadReports();
                break;
        }
    }

    // Load dashboard data
    function loadDashboardData() {
        fetch('/api/admin/dashboard')
            .then(response => response.json())
            .then(data => {
                document.getElementById('today-bookings').textContent = data.today_bookings || 0;
                document.getElementById('pending-bookings').textContent = data.pending_bookings || 0;
                document.getElementById('month-bookings').textContent = data.this_month_bookings || 0;
                document.getElementById('blacklist-count').textContent = data.blacklist_count || 0;
            })
            .catch(error => {
                console.error('Error loading dashboard data:', error);
            });
    }

    // Load bookings
    function loadBookings() {
        const date = document.getElementById('booking-filter-date').value;
        const status = document.getElementById('booking-filter-status').value;
        
        let url = '/api/admin/bookings';
        const params = new URLSearchParams();
        
        if (date) params.append('date', date);
        if (status) params.append('status', status);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        fetch(url)
            .then(response => response.json())
            .then(bookings => {
                displayBookings(bookings);
            })
            .catch(error => {
                console.error('Error loading bookings:', error);
            });
    }

    // Display bookings
    function displayBookings(bookings) {
        const tbody = document.getElementById('bookings-tbody');
        
        if (bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">لا توجد حجوزات</td></tr>';
            return;
        }
        
        tbody.innerHTML = bookings.map(booking => `
            <tr>
                <td>${formatDate(booking.date)}</td>
                <td>${formatTime12Hour(booking.start_time)} - ${formatTime12Hour(booking.end_time)}</td>
                <td>${booking.name}</td>
                <td>${booking.phone}</td>
                <td><span class="status-badge status-${booking.status}">${getStatusText(booking.status)}</span></td>
                <td><span class="status-badge ${booking.paid ? 'payment-paid' : 'payment-unpaid'}">${booking.paid ? 'مدفوع' : 'غير مدفوع'}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-success" onclick="updateBookingStatus(${booking.id}, 'confirmed')">قبول</button>
                        <button class="btn-danger" onclick="updateBookingStatus(${booking.id}, 'cancelled')">رفض</button>
                        <button class="btn-primary" onclick="togglePayment(${booking.id}, ${booking.paid ? 0 : 1})">${booking.paid ? 'إلغاء الدفع' : 'تأكيد الدفع'}</button>
                        <button class="btn-danger" onclick="deleteBooking(${booking.id})">حذف</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Update booking status
    window.updateBookingStatus = function(id, status) {
        fetch(`/api/admin/bookings/${id}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                loadBookings();
                loadDashboardData();
            } else {
                showAlert('خطأ: ' + (data.error || 'حدث خطأ غير متوقع'), 'خطأ في التحديث');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('حدث خطأ في التحديث', 'خطأ');
        });
    };

    // Toggle payment status
    window.togglePayment = function(id, paid) {
        fetch(`/api/admin/bookings/${id}/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paid })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                loadBookings();
            } else {
                showAlert('خطأ: ' + (data.error || 'حدث خطأ غير متوقع'), 'خطأ في التحديث');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('حدث خطأ في التحديث', 'خطأ');
        });
    };

    // Delete booking
    window.deleteBooking = function(id) {
        showConfirm('هل أنت متأكد من حذف هذا الحجز؟').then(result => {
            if (result) {
                fetch(`/api/admin/bookings/${id}`, {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.message) {
                        loadBookings();
                        loadDashboardData();
                    } else {
                        showAlert('خطأ: ' + (data.error || 'حدث خطأ غير متوقع'), 'خطأ في الحذف');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showAlert('حدث خطأ في الحذف', 'خطأ');
                });
            }
        });
    };

    // Load blacklist
    function loadBlacklist() {
        fetch('/api/admin/blacklist')
            .then(response => response.json())
            .then(blacklist => {
                displayBlacklist(blacklist);
            })
            .catch(error => {
                console.error('Error loading blacklist:', error);
            });
    }

    // Display blacklist
    function displayBlacklist(blacklist) {
        const tbody = document.getElementById('blacklist-tbody');
        
        if (blacklist.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading">لا توجد عناصر في القائمة السوداء</td></tr>';
            return;
        }
        
        tbody.innerHTML = blacklist.map(item => `
            <tr>
                <td>${item.name || '-'}</td>
                <td>${item.phone || '-'}</td>
                <td>${item.reason || '-'}</td>
                <td>${formatDate(item.created_at)}</td>
                <td>
                    <button class="btn-danger" onclick="removeFromBlacklist(${item.id})">إزالة</button>
                </td>
            </tr>
        `).join('');
    }

    // Show blacklist modal
    function showBlacklistModal() {
        document.getElementById('blacklist-modal').style.display = 'flex';
    }

    // Handle blacklist submit
    function handleBlacklistSubmit(e) {
        e.preventDefault();
        
        const name = document.getElementById('blacklist-name').value;
        const phone = document.getElementById('blacklist-phone').value;
        const reason = document.getElementById('blacklist-reason').value;
        
        // Validate phone number if provided (must be exactly 8 digits)
        if (phone && !/^[0-9]{8}$/.test(phone)) {
            showAlert('رقم الهاتف يجب أن يكون 8 أرقام بالضبط', 'خطأ في الإدخال');
            return;
        }
        
        fetch('/api/admin/blacklist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, phone, reason })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                document.getElementById('blacklist-modal').style.display = 'none';
                document.getElementById('blacklist-form').reset();
                loadBlacklist();
                loadDashboardData();
            } else {
                showAlert('خطأ: ' + (data.error || 'حدث خطأ غير متوقع'), 'خطأ في الإضافة');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('حدث خطأ في الإضافة', 'خطأ');
        });
    }

    // Remove from blacklist
    window.removeFromBlacklist = function(id) {
        showConfirm('هل أنت متأكد من إزالة هذا العنصر من القائمة السوداء؟').then(result => {
            if (result) {
                fetch(`/api/admin/blacklist/${id}`, {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.message) {
                        loadBlacklist();
                        loadDashboardData();
                    } else {
                        showAlert('خطأ: ' + (data.error || 'حدث خطأ غير متوقع'), 'خطأ في الحذف');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showAlert('حدث خطأ في الحذف', 'خطأ');
                });
            }
        });
    };

    // Load settings
    function loadSettings() {
        fetch('/api/settings')
            .then(response => response.json())
            .then(settings => {
                // Fill form with current settings
                Object.keys(settings).forEach(key => {
                    const input = document.querySelector(`[name="${key}"]`);
                    if (input) {
                        input.value = settings[key];
                    }
                });
            })
            .catch(error => {
                console.error('Error loading settings:', error);
            });
    }

    // Handle settings submit
    function handleSettingsSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const settings = {};
        
        formData.forEach((value, key) => {
            settings[key] = value;
        });
        
        fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings)
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                showAlert('تم حفظ الإعدادات بنجاح', 'نجاح');
            } else {
                showAlert('خطأ: ' + (data.error || 'حدث خطأ غير متوقع'), 'خطأ في الحفظ');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('حدث خطأ في حفظ الإعدادات', 'خطأ');
        });
    }

    // Load reports
    function loadReports() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('report-date').value = today;
        generateReport();
    }

    // Generate report
    function generateReport() {
        const period = document.getElementById('report-period').value;
        const date = document.getElementById('report-date').value;
        
        if (!date) {
            showAlert('يرجى اختيار تاريخ', 'خطأ في الإدخال');
            return;
        }
        
        fetch(`/api/admin/reports?period=${period}&date=${date}`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('total-bookings').textContent = data.total_bookings || 0;
                document.getElementById('confirmed-bookings').textContent = data.confirmed_bookings || 0;
                document.getElementById('paid-bookings').textContent = data.paid_bookings || 0;
                document.getElementById('total-revenue').textContent = data.total_revenue || 0;
            })
            .catch(error => {
                console.error('Error generating report:', error);
                showAlert('حدث خطأ في إنشاء التقرير', 'خطأ');
            });
        }


    // Utility functions
    function getStatusText(status) {
        const statusMap = {
            pending: 'معلق',
            confirmed: 'مؤكد',
            cancelled: 'ملغى'
        };
        return statusMap[status] || status;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB');
    }
    
    // Convert 24-hour time to 12-hour AM/PM format
    function formatTime12Hour(time24) {
        const [hours, minutes] = time24.split(':');
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        return `${hour12}:${minutes} ${ampm}`;
    }

    // Load users data
    function loadUsersData() {
        // Load current admin username
        if (currentUser) {
            document.getElementById('admin-new-username').value = currentUser.username;
        }
        
        // Load manager info
        fetch('/api/admin/manager-info')
            .then(response => response.json())
            .then(data => {
                if (data.username) {
                    document.getElementById('manager-current-username').value = data.username;
                    document.getElementById('manager-new-username').value = data.username;
                    document.getElementById('manager-name').value = data.name || '';
                }
            })
            .catch(error => {
                console.error('Error loading manager info:', error);
            });
    }

    // Handle admin password change
    function handleAdminPasswordChange(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('admin-current-password').value;
        const newUsername = document.getElementById('admin-new-username').value;
        const newPassword = document.getElementById('admin-new-password').value;
        const confirmPassword = document.getElementById('admin-confirm-password').value;
        
        if (newPassword !== confirmPassword) {
            showAlert('كلمة المرور الجديدة غير متطابقة', 'خطأ في الإدخال');
            return;
        }
        
        if (newPassword.length < 6) {
            showAlert('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'خطأ في الإدخال');
            return;
        }
        
        fetch('/api/admin/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_username: newUsername,
                new_password: newPassword
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                showAlert('تم تحديث بيانات الإدارة بنجاح', 'نجاح');
                // Update current user info
                currentUser.username = newUsername;
                document.getElementById('admin-username').textContent = newUsername;
                // Reset form
                document.getElementById('admin-password-form').reset();
                document.getElementById('admin-new-username').value = newUsername;
            } else {
                showAlert('خطأ: ' + (data.error || 'حدث خطأ غير متوقع'), 'خطأ في التحديث');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('حدث خطأ في تحديث بيانات الإدارة', 'خطأ');
        });
    }

    // Handle manager password change
    function handleManagerPasswordChange(e) {
        e.preventDefault();
        
        const newUsername = document.getElementById('manager-new-username').value;
        const newPassword = document.getElementById('manager-new-password').value;
        const confirmPassword = document.getElementById('manager-confirm-password').value;
        const managerName = document.getElementById('manager-name').value;
        
        if (newPassword !== confirmPassword) {
            showAlert('كلمة المرور الجديدة غير متطابقة', 'خطأ في الإدخال');
            return;
        }
        
        if (newPassword.length < 6) {
            showAlert('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'خطأ في الإدخال');
            return;
        }
        
        fetch('/api/admin/change-manager-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                new_username: newUsername,
                new_password: newPassword,
                manager_name: managerName
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                showAlert('تم تحديث بيانات المدير بنجاح', 'نجاح');
                // Update current username display
                document.getElementById('manager-current-username').value = newUsername;
                // Reset password fields only
                document.getElementById('manager-new-password').value = '';
                document.getElementById('manager-confirm-password').value = '';
            } else {
                showAlert('خطأ: ' + (data.error || 'حدث خطأ غير متوقع'), 'خطأ في التحديث');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('حدث خطأ في تحديث بيانات المدير', 'خطأ');
        });
    }