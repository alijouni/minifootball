import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const loginForm = document.getElementById('loginForm');
const googleBtn = document.getElementById('googleLoginBtn');
const errorText = document.getElementById('errorMessage');

// Centralized function to route users based on their role
async function routeUser(user) {
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && (userDoc.data().role === 'manager' || userDoc.data().role === 'admin')) {
            window.location.href = 'manager.html';
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error("Error fetching user role:", error);
        window.location.href = 'index.html'; // Fallback to citizen view
    }
}

// Handle Email/Password Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await routeUser(userCredential.user);
    } catch (error) {
        errorText.style.display = 'block';
        errorText.textContent = "Invalid email or password. Please try again.";
    }
});

// Handle Google Sign-In
googleBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await routeUser(result.user);
    } catch (error) {
        errorText.style.display = 'block';
        errorText.textContent = "Google Sign-In failed.";
    }
});