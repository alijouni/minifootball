import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, orderBy, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tableBody = document.getElementById('bookingsTableBody');
const dateDisplay = document.getElementById('currentDate');

// Display today's date
const today = new Date();
const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
dateDisplay.textContent = today.toLocaleDateString('en-LB', options);

// Verify Manager Access
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || (userDoc.data().role !== 'manager' && userDoc.data().role !== 'admin')) {
        alert("Unauthorized access. Redirecting to citizen portal.");
        window.location.href = 'index.html';
        return;
    }

    loadTodaysBookings();
});

async function loadTodaysBookings() {
    // Set time boundaries for "today"
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    try {
        const q = query(
            collection(db, "bookings"),
            where("startTime", ">=", startOfDay),
            where("startTime", "<=", endOfDay),
            orderBy("startTime", "asc")
        );

        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No bookings scheduled for today.</td></tr>';
            return;
        }

        tableBody.innerHTML = ''; // Clear loading text

        querySnapshot.forEach((docSnap) => {
            const booking = docSnap.data();
            const start = booking.startTime.toDate().toLocaleTimeString('en-LB', { hour: '2-digit', minute: '2-digit' });
            const end = booking.endTime.toDate().toLocaleTimeString('en-LB', { hour: '2-digit', minute: '2-digit' });
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${start} - ${end}</strong></td>
                <td>${booking.userName || 'N/A'}</td>
                <td><a href="tel:${booking.userPhone}" style="color: var(--text-main); text-decoration: none;">${booking.userPhone || 'N/A'}</a></td>
                <td><span class="status-badge status-${booking.status}">${booking.status.toUpperCase()}</span></td>
                <td><button class="btn-action" onclick="cancelBooking('${docSnap.id}')">Cancel</button></td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading bookings:", error);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: red;">Failed to load data. Please refresh.</td></tr>';
    }
}

// Handle Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'login.html';
    });
});

// Make cancel function available globally for inline onclick handlers
window.cancelBooking = function(bookingId) {
    if(confirm("Are you sure you want to cancel this booking?")) {
        alert(`Cancel logic for ${bookingId} will trigger a Firestore update here.`);
        // You will implement the updateDoc logic here later
    }
}