import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, doc, getDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const slotsContainer = document.getElementById('slots-container');
const confirmBtn = document.getElementById('confirmBookingBtn');
const authSection = document.getElementById('auth-section');

let currentUser = null;
let currentUserProfile = null;
let selectedSlotData = null;
let currentPitchData = null;

// 1. Authentication Check & Profile Fetch
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUserProfile = userDoc.data();
            authSection.innerHTML = `<button id="logoutBtn" class="btn-secondary" style="width: auto; margin-top: 0;">Sign Out</button>`;
            document.getElementById('logoutBtn').addEventListener('click', () => {
                signOut(auth).then(() => window.location.href = 'login.html');
            });

            loadTimeSlots();
            loadMyBookings(); // Add this line
        }
    } else {
        window.location.href = 'login.html';
    }
});

// 2. Generate and Render Time Slots
async function loadTimeSlots() {
    slotsContainer.innerHTML = '<p>Loading availability...</p>';
    selectedSlotData = null;

    try {
        // 1. Fetch live pitch configuration from Admin panel
        const pitchDoc = await getDoc(doc(db, 'pitches', 'pitch_001'));
        if (pitchDoc.exists()) {
            currentPitchData = pitchDoc.data();
        } else {
            // Safe fallback if admin hasn't saved settings yet
            currentPitchData = { isAvailable: true, hourlyRate: 500000, operatingHours: { open: "17:00", close: "23:00" } };
        }

        // 2. Check Pitch Status
        if (currentPitchData.isAvailable === false) {
            slotsContainer.innerHTML = '<div style="grid-column: 1 / -1; padding: 2rem; text-align: center; background: #FEE2E2; border-radius: 8px; color: #991B1B;"><strong>The pitch is currently closed for maintenance.</strong><br>Please check back later.</div>';
            return;
        }

        // 3. Dynamically generate 1.5-hour (90 min) slots based on operating hours
        const schedule = [];
        const [openH, openM] = currentPitchData.operatingHours.open.split(':').map(Number);
        const [closeH, closeM] = currentPitchData.operatingHours.close.split(':').map(Number);
        
        let curH = openH;
        let curM = openM;

        while (curH < closeH || (curH === closeH && curM < closeM)) {
            let endH = curH + 1;
            let endM = curM + 30;
            
            if (endM >= 60) {
                endH += 1;
                endM -= 60;
            }

            // Stop generating if the next slot goes past closing time
            if (endH > closeH || (endH === closeH && endM > closeM)) break;

            schedule.push({ startH: curH, startM: curM, endH: endH, endM: endM });
            
            curH = endH;
            curM = endM;
        }

        // 4. Query today's existing bookings to disable taken slots
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const q = query(
            collection(db, "bookings"),
            where("startTime", ">=", todayStart),
            where("startTime", "<=", todayEnd)
        );
        const querySnapshot = await getDocs(q);
        
        const bookedStartHours = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return data.status !== 'cancelled' ? data.startTime.toDate().getHours() : null;
        });

        // 5. Render the Grid
        slotsContainer.innerHTML = ''; 

        if (schedule.length === 0) {
            slotsContainer.innerHTML = '<p>No valid time slots available for today.</p>';
            return;
        }

        // Calculate the total price for a 1.5-hour slot
        const slotPrice = currentPitchData.hourlyRate * 1.5;

        schedule.forEach(slot => {
            const slotStart = new Date();
            slotStart.setHours(slot.startH, slot.startM, 0, 0);
            
            const slotEnd = new Date();
            slotEnd.setHours(slot.endH, slot.endM, 0, 0);

            const slotDiv = document.createElement('div');
            slotDiv.className = 'slot';
            
            const timeString = `${slot.startH.toString().padStart(2, '0')}:${slot.startM.toString().padStart(2, '0')} - ${slot.endH.toString().padStart(2, '0')}:${slot.endM.toString().padStart(2, '0')}`;
            
            if (bookedStartHours.includes(slot.startH)) {
                slotDiv.classList.add('booked');
                slotDiv.innerHTML = `${timeString}<br><small>Booked</small>`;
            } else {
                slotDiv.classList.add('available');
                slotDiv.innerHTML = `${timeString}<br><small>${slotPrice.toLocaleString()} LBP</small>`;
                
                slotDiv.addEventListener('click', () => {
                    document.querySelectorAll('.slot').forEach(el => el.classList.remove('selected'));
                    slotDiv.classList.add('selected');
                    selectedSlotData = { start: slotStart, end: slotEnd, price: slotPrice };
                    
                    // Enable button and show dynamic price
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = `Confirm Booking (${slotPrice.toLocaleString()} LBP)`;
                });
            }
            slotsContainer.appendChild(slotDiv);
        });

    } catch (error) {
        console.error("Error loading slots:", error);
        slotsContainer.innerHTML = '<p style="color: var(--muni-red);">Failed to load schedule. Please try again.</p>';
    }
}

// 3. Save the Booking to Firestore
confirmBtn.addEventListener('click', async () => {
    if (!selectedSlotData) {
        alert("Please select an available time slot first.");
        return;
    }

    // Disable button to prevent double-booking
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Processing...";

    try {
        await addDoc(collection(db, "bookings"), {
            pitchId: "pitch_001",
            userId: currentUser.uid,
            userName: currentUserProfile.displayName,
            userPhone: currentUserProfile.phoneNumber,
            startTime: selectedSlotData.start,
            endTime: selectedSlotData.end,
            status: "confirmed",
            paymentStatus: "unpaid",
            totalPrice: selectedSlotData.price, // Uses the dynamic price (hourlyRate * 1.5)
            createdAt: serverTimestamp()
        });

        alert("Your booking has been successfully confirmed!");
        loadTimeSlots(); // Refresh the grid so the slot becomes 'booked'
        loadMyBookings();
    } catch (error) {
        console.error("Error creating booking:", error);
        alert("An error occurred while booking. Please try again.");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm Booking";
    }
});

// Fetch and display user's personal bookings
async function loadMyBookings() {
    const container = document.getElementById('my-bookings-container');
    container.innerHTML = '<p>Loading your schedule...</p>';

    try {
        const q = query(
            collection(db, "bookings"),
            where("userId", "==", currentUser.uid)
        );
        const snapshot = await getDocs(q);
        
        const now = new Date();
        let upcomingBookings = [];

        // Filter out cancelled and past bookings
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const startTime = data.startTime.toDate();
            if (data.status !== 'cancelled' && startTime >= now) {
                upcomingBookings.push({ id: docSnap.id, ...data, startTime });
            }
        });

        // Sort chronologically
        upcomingBookings.sort((a, b) => a.startTime - b.startTime);

        if (upcomingBookings.length === 0) {
            container.innerHTML = '<p>You have no upcoming bookings.</p>';
            return;
        }

        container.innerHTML = ''; // Clear loading text
        
        upcomingBookings.forEach(booking => {
            const dateStr = booking.startTime.toLocaleDateString('en-LB', { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = booking.startTime.toLocaleTimeString('en-LB', { hour: '2-digit', minute: '2-digit' });
            
            const card = document.createElement('div');
            card.className = 'booking-card';
            card.innerHTML = `
                <div class="booking-info">
                    <h4>${dateStr}</h4>
                    <p>${timeStr} | ${booking.totalPrice} LBP</p>
                </div>
                <button class="btn-cancel" onclick="cancelMyBooking('${booking.id}')">Cancel</button>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading personal bookings:", error);
        container.innerHTML = '<p style="color: var(--muni-red);">Failed to load bookings.</p>';
    }
}

// Handle cancellation from the citizen's side
window.cancelMyBooking = async function(bookingId) {
    if(confirm("Are you sure you want to cancel this booking?")) {
        try {
            await updateDoc(doc(db, 'bookings', bookingId), {
                status: 'cancelled'
            });
            
            alert("Booking cancelled successfully.");
            loadTimeSlots(); // Refresh the main grid to free up the slot
            loadMyBookings(); // Refresh the personal list
            
        } catch (error) {
            console.error("Error cancelling booking:", error);
            alert("Failed to cancel the booking. Please try again.");
        }
    }
}