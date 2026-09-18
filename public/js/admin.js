import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const pitchSettingsForm = document.getElementById('pitchSettingsForm');
const usersTableBody = document.getElementById('usersTableBody');
const PITCH_ID = "pitch_001"; // Default pitch ID from our migration structure

// 1. Verify Admin Access
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
        alert("Administrator access required. Redirecting.");
        window.location.href = 'index.html';
        return;
    }

    loadPitchSettings();
    loadUsers();
});

// 2. Manage Pitch Settings
async function loadPitchSettings() {
    try {
        const pitchDoc = await getDoc(doc(db, 'pitches', PITCH_ID));
        if (pitchDoc.exists()) {
            const data = pitchDoc.data();
            document.getElementById('hourlyRate').value = data.hourlyRate || 500000;
            document.getElementById('pitchStatus').value = data.isAvailable !== false ? "true" : "false";
            document.getElementById('openTime').value = data.operatingHours?.open || "08:00";
            document.getElementById('closeTime').value = data.operatingHours?.close || "23:00";
        }
    } catch (error) {
        console.error("Error loading pitch settings:", error);
    }
}

pitchSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button');
    submitBtn.textContent = "Saving...";

    try {
        await updateDoc(doc(db, 'pitches', PITCH_ID), {
            hourlyRate: Number(document.getElementById('hourlyRate').value),
            isAvailable: document.getElementById('pitchStatus').value === "true",
            operatingHours: {
                open: document.getElementById('openTime').value,
                close: document.getElementById('closeTime').value
            }
        });
        alert("Pitch settings updated successfully.");
    } catch (error) {
        console.error("Error updating pitch:", error);
        alert("Failed to update settings.");
    } finally {
        submitBtn.textContent = "Save Settings";
    }
});

// 3. Manage Users
async function loadUsers() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        usersTableBody.innerHTML = '';

        querySnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const tr = document.createElement('tr');
            
            // Determine which button to show based on current role
            let actionButton = '';
            if (user.role === 'citizen') {
                actionButton = `<button class="btn-action" style="color: var(--muni-green); border-color: var(--muni-green);" onclick="updateUserRole('${docSnap.id}', 'manager')">Promote to Manager</button>`;
            } else if (user.role === 'manager') {
                actionButton = `<button class="btn-action" onclick="updateUserRole('${docSnap.id}', 'citizen')">Revoke Manager</button>`;
            } else {
                actionButton = `<span style="color: #9CA3AF; font-size: 0.875rem;">Admin (Immutable)</span>`;
            }

            tr.innerHTML = `
                <td><strong>${user.displayName || 'N/A'}</strong><br><span style="font-size: 0.8rem; color: #6B7280;">${user.email}</span></td>
                <td>${user.phoneNumber || 'N/A'}</td>
                <td><span class="status-badge" style="background: ${user.role === 'admin' ? '#FEE2E2' : '#F3F4F6'}; color: ${user.role === 'admin' ? '#991B1B' : '#374151'};">${user.role.toUpperCase()}</span></td>
                <td>${actionButton}</td>
            `;
            usersTableBody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading users:", error);
        usersTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Failed to load users.</td></tr>';
    }
}

window.updateUserRole = async function(userId, newRole) {
    if(confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
        try {
            await updateDoc(doc(db, 'users', userId), {
                role: newRole
            });
            loadUsers(); // Refresh the table
        } catch (error) {
            console.error("Error updating role:", error);
            alert("Failed to update user role.");
        }
    }
}

// 4. Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'login.html');
});