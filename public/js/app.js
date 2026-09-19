import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, doc, getDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const slotsContainer = document.getElementById('slots-container');
const confirmBtn = document.getElementById('confirmBookingBtn');
const authSection = document.getElementById('auth-section');

// Global State
let currentUser = null;
let currentUserProfile = null;
let currentPitchData = null;
let selectedSlotData = null;

let currentMonthView = new Date();
let activeSelectedDate = new Date();
activeSelectedDate.setHours(0,0,0,0);
let monthlyBookingsCache = [];

// 1. Auth Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUserProfile = userDoc.data();
            
            authSection.innerHTML = `<button id="logoutBtn" class="btn-secondary" style="width: auto; margin-top: 0; border-color: var(--muni-green); color: var(--muni-green);">Sign Out</button>`;
            document.getElementById('logoutBtn').addEventListener('click', () => {
                signOut(auth).then(() => window.location.href = 'login.html');
            });

            // Initialize UI
            loadMonthData();
            loadTimeSlots();
            loadMyBookings();
        }
    } else {
        window.location.href = 'login.html';
    }
});

// 2. Calendar Logic
async function loadMonthData() {
    const startOfMonth = new Date(currentMonthView.getFullYear(), currentMonthView.getMonth(), 1);
    const endOfMonth = new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 0, 23, 59, 59);

    try {
        const q = query(
            collection(db, "bookings"),
            where("startTime", ">=", startOfMonth),
            where("startTime", "<=", endOfMonth)
        );
        const snapshot = await getDocs(q);
        
        monthlyBookingsCache = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.status !== 'cancelled') {
                monthlyBookingsCache.push(data.startTime.toDate());
            }
        });
        renderCalendar();
    } catch (error) {
        console.error("Error loading month data:", error);
    }
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthYearDisplay = document.getElementById('monthYearDisplay');
    grid.innerHTML = '';

    const year = currentMonthView.getFullYear();
    const month = currentMonthView.getMonth();
    
    monthYearDisplay.textContent = currentMonthView.toLocaleDateString('en-LB', { month: 'long', year: 'numeric' });

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const today = new Date();
    today.setHours(0,0,0,0);

    // Blanks
    for (let i = 0; i < firstDayOfMonth; i++) {
        grid.appendChild(document.createElement('div'));
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateCell = document.createElement('div');
        dateCell.className = 'calendar-day';
        dateCell.textContent = day;

        const thisCellDate = new Date(year, month, day);
        thisCellDate.setHours(0,0,0,0);

        if (thisCellDate < today) {
            dateCell.classList.add('disabled');
        } else {
            const hasBookings = monthlyBookingsCache.some(b => 
                b.getDate() === day && b.getMonth() === month && b.getFullYear() === year
            );
            
            if (hasBookings) {
                const dot = document.createElement('div');
                dot.className = 'indicator';
                dateCell.appendChild(dot);
            }

            if (thisCellDate.getTime() === activeSelectedDate.getTime()) {
                dateCell.classList.add('selected');
            }

            dateCell.addEventListener('click', () => {
                activeSelectedDate = new Date(thisCellDate);
                renderCalendar(); 
                loadTimeSlots();  
            });
        }
        grid.appendChild(dateCell);
    }
}

document.getElementById('prevMonthBtn').addEventListener('click', () => {
    currentMonthView.setMonth(currentMonthView.getMonth() - 1);
    loadMonthData();
});

document.getElementById('nextMonthBtn').addEventListener('click', () => {
    currentMonthView.setMonth(currentMonthView.getMonth() + 1);
    loadMonthData();
});


// 3. Time Slot Logic
async function loadTimeSlots() {
    slotsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Loading availability...</p>';
    selectedSlotData = null;
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Confirm Booking";

    try {
        // Fetch Pitch Config
        if (!currentPitchData) {
            const pitchDoc = await getDoc(doc(db, 'pitches', 'pitch_001'));
            if (pitchDoc.exists()) {
                currentPitchData = pitchDoc.data();
            } else {
                currentPitchData = { isAvailable: true, hourlyRate: 500000, operatingHours: { open: "17:00", close: "23:00" } };
            }
        }

        if (currentPitchData.isAvailable === false) {
            slotsContainer.innerHTML = '<div style="grid-column: 1 / -1; padding: 2rem; text-align: center; background: #FEE2E2; border-radius: var(--border-radius); color: #991B1B;"><strong>The pitch is currently closed for maintenance.</strong></div>';
            return;
        }

        // Generate 90-min schedule blocks
        const schedule = [];
        const [openH, openM] = currentPitchData.operatingHours.open.split(':').map(Number);
        const [closeH, closeM] = currentPitchData.operatingHours.close.split(':').map(Number);
        let curH = openH, curM = openM;

        while (curH < closeH || (curH === closeH && curM < closeM)) {
            let endH = curH + 1, endM = curM + 30;
            if (endM >= 60) { endH += 1; endM -= 60; }
            if (endH > closeH || (endH === closeH && endM > closeM)) break;
            schedule.push({ startH: curH, startM: curM, endH: endH, endM: endM });
            curH = endH; curM = endM;
        }

        // Query existing bookings for selected date
        const dayStart = new Date(activeSelectedDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(activeSelectedDate);
        dayEnd.setHours(23, 59, 59, 999);

        document.getElementById('selectedDateDisplay').textContent = `Available Slots for ${activeSelectedDate.toLocaleDateString('en-LB', { weekday: 'short', month: 'short', day: 'numeric' })}`;

        const q = query(collection(db, "bookings"), where("startTime", ">=", dayStart), where("startTime", "<=", dayEnd));
        const querySnapshot = await getDocs(q);
        
        const bookedStartHours = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return data.status !== 'cancelled' ? data.startTime.toDate().getHours() : null;
        });

        slotsContainer.innerHTML = ''; 
        if (schedule.length === 0) {
            slotsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No valid time slots available.</p>';
            return;
        }

        const slotPrice = currentPitchData.hourlyRate * 1.5;

        schedule.forEach(slot => {
            const slotStart = new Date(activeSelectedDate);
            slotStart.setHours(slot.startH, slot.startM, 0, 0);
            
            const slotEnd = new Date(activeSelectedDate);
            slotEnd.setHours(slot.endH, slot.endM, 0, 0);

            const slotDiv = document.createElement('div');
            slotDiv.className = 'slot';
            
            const timeString = `${slot.startH.toString().padStart(2, '0')}:${slot.startM.toString().padStart(2, '0')} - ${slot.endH.toString().padStart(2, '0')}:${slot.endM.toString().padStart(2, '0')}`;
            
            // If the selected day is today, disable slots that have already passed in time
            const now = new Date();
            const isPastTimeToday = (activeSelectedDate.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) && (slotStart < now);

            if (bookedStartHours.includes(slot.startH) || isPastTimeToday) {
                slotDiv.classList.add('booked');
                slotDiv.innerHTML = `${timeString}<br><small>${isPastTimeToday ? 'Passed' : 'Booked'}</small>`;
            } else {
                slotDiv.classList.add('available');
                slotDiv.innerHTML = `${timeString}<br><small>${slotPrice.toLocaleString()} LBP</small>`;
                
                slotDiv.addEventListener('click', () => {
                    document.querySelectorAll('.slot').forEach(el => el.classList.remove('selected'));
                    slotDiv.classList.add('selected');
                    selectedSlotData = { start: slotStart, end: slotEnd, price: slotPrice };
                    
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = `Confirm Booking (${slotPrice.toLocaleString()} LBP)`;
                });
            }
            slotsContainer.appendChild(slotDiv);
        });

    } catch (error) {
        console.error("Error loading slots:", error);
        slotsContainer.innerHTML = '<p style="color: var(--muni-red); grid-column: 1/-1; text-align: center;">Failed to load schedule.</p>';
    }
}

// 4. Create Booking
confirmBtn.addEventListener('click', async () => {
    if (!selectedSlotData) return;
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
            totalPrice: selectedSlotData.price,
            createdAt: serverTimestamp()
        });

        // Refresh UI
        loadMonthData();
        loadTimeSlots();
        loadMyBookings();
        
    } catch (error) {
        console.error("Error creating booking:", error);
        alert("An error occurred. Please try again.");
        confirmBtn.disabled = false;
        confirmBtn.textContent = `Confirm Booking (${selectedSlotData.price.toLocaleString()} LBP)`;
    }
});

// 5. My Bookings Section
async function loadMyBookings() {
    const container = document.getElementById('my-bookings-container');
    container.innerHTML = '<p style="color: var(--text-muted);">Loading your schedule...</p>';

    try {
        const q = query(collection(db, "bookings"), where("userId", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        
        const now = new Date();
        let upcomingBookings = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const startTime = data.startTime.toDate();
            if (data.status !== 'cancelled' && startTime >= now) {
                upcomingBookings.push({ id: docSnap.id, ...data, startTime });
            }
        });

        upcomingBookings.sort((a, b) => a.startTime - b.startTime);

        if (upcomingBookings.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">You have no upcoming bookings.</p>';
            return;
        }

        container.innerHTML = '';
        
        upcomingBookings.forEach(booking => {
            const dateStr = booking.startTime.toLocaleDateString('en-LB', { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = booking.startTime.toLocaleTimeString('en-LB', { hour: '2-digit', minute: '2-digit' });
            
            const card = document.createElement('div');
            card.className = 'booking-card';
            card.innerHTML = `
                <div class="booking-info">
                    <h4>${dateStr}</h4>
                    <p>${timeStr} | ${booking.totalPrice.toLocaleString()} LBP</p>
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

window.cancelMyBooking = async function(bookingId) {
    if(confirm("Are you sure you want to cancel this booking?")) {
        try {
            await updateDoc(doc(db, 'bookings', bookingId), { status: 'cancelled' });
            loadMonthData();
            loadTimeSlots();
            loadMyBookings();
        } catch (error) {
            console.error("Error cancelling booking:", error);
            alert("Failed to cancel the booking. Please try again.");
        }
    }
}