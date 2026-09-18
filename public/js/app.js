import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const slotsContainer = document.getElementById('slots-container');
const confirmBtn = document.getElementById('confirmBookingBtn');
const authSection = document.getElementById('auth-section');

let currentUser = null;
let currentUserProfile = null;
let selectedSlotData = null;

// 1. Authentication Check & Profile Fetch
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Fetch the user's name and phone number from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUserProfile = userDoc.data();
            
            // Update UI to show Sign Out button
            authSection.innerHTML = `<button id="logoutBtn" class="btn-secondary" style="width: auto; margin-top: 0;">Sign Out</button>`;
            document.getElementById('logoutBtn').addEventListener('click', () => {
                signOut(auth).then(() => window.location.href = 'login.html');
            });

            // Load available time slots for today
            loadTimeSlots();
        }
    } else {
        // Redirect to login if not authenticated
        window.location.href = 'login.html';
    }
});

// 2. Generate and Render Time Slots
async function loadTimeSlots() {
    slotsContainer.innerHTML = '<p>Loading availability...</p>';
    selectedSlotData = null; // Reset selection

    // Define standard 1.5-hour pitch booking blocks
    const schedule = [
        { startH: 17, startM: 0, endH: 18, endM: 30 },
        { startH: 18, startM: 30, endH: 20, endM: 0 },
        { startH: 20, startM: 0, endH: 21, endM: 30 },
        { startH: 21, startM: 30, endH: 23, endM: 0 }
    ];

    // Get boundaries for today to query existing bookings
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    try {
        // Query Firestore for today's confirmed bookings
        const q = query(
            collection(db, "bookings"),
            where("startTime", ">=", todayStart),
            where("startTime", "<=", todayEnd)
        );
        const querySnapshot = await getDocs(q);
        
        // Extract the start hours of existing bookings to easily compare
        const bookedStartHours = querySnapshot.docs.map(doc => {
            const data = doc.data();
            if (data.status !== 'cancelled') {
                return data.startTime.toDate().getHours();
            }
            return null;
        });

        slotsContainer.innerHTML = ''; // Clear loading text

        // Render each slot
        schedule.forEach(slot => {
            const slotStart = new Date();
            slotStart.setHours(slot.startH, slot.startM, 0, 0);
            
            const slotEnd = new Date();
            slotEnd.setHours(slot.endH, slot.endM, 0, 0);

            const slotDiv = document.createElement('div');
            slotDiv.className = 'slot';
            
            // Format time for display (e.g., "17:00 - 18:30")
            const timeString = `${slot.startH}:${slot.startM === 0 ? '00' : slot.startM} - ${slot.endH}:${slot.endM === 0 ? '00' : slot.endM}`;
            slotDiv.textContent = timeString;

            // Check if this time slot is already booked
            if (bookedStartHours.includes(slot.startH)) {
                slotDiv.classList.add('booked');
                slotDiv.textContent += " (Booked)";
            } else {
                slotDiv.classList.add('available');
                // Add click listener for available slots
                slotDiv.addEventListener('click', () => {
                    // Remove selected class from all slots
                    document.querySelectorAll('.slot').forEach(el => el.classList.remove('selected'));
                    // Add selected class to clicked slot
                    slotDiv.classList.add('selected');
                    // Store the selected time data for the confirmation button
                    selectedSlotData = { start: slotStart, end: slotEnd };
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
            totalPrice: 500000, // Standard rate, e.g., 500,000 LBP
            createdAt: serverTimestamp()
        });

        alert("Your booking has been successfully confirmed!");
        loadTimeSlots(); // Refresh the grid so the slot becomes 'booked'
        
    } catch (error) {
        console.error("Error creating booking:", error);
        alert("An error occurred while booking. Please try again.");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm Booking";
    }
});