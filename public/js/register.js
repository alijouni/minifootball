import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const registerForm = document.getElementById('registerForm');
const errorText = document.getElementById('errorMessage');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
        // 1. Create the user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Save additional user details to the Firestore 'users' collection
        // We use the Auth UID as the Firestore Document ID
        await setDoc(doc(db, "users", user.uid), {
            displayName: fullName,
            phoneNumber: phone,
            email: email,
            role: "citizen", // Default role for new sign-ups
            isActive: true,
            createdAt: serverTimestamp()
        });

        // 3. Redirect the user to the main booking portal
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error("Registration error:", error);
        errorText.style.display = 'block';
        
        // Handle common Firebase Auth errors gracefully
        if (error.code === 'auth/email-already-in-use') {
            errorText.textContent = "This email is already registered. Please sign in.";
        } else if (error.code === 'auth/weak-password') {
            errorText.textContent = "Password should be at least 6 characters.";
        } else {
            errorText.textContent = "An error occurred during registration. Please try again.";
        }
    }
});