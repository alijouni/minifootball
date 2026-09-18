import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// REPLACE THESE WITH YOUR FIREBASE PROJECT SETTINGS
const firebaseConfig = {
  apiKey: "AIzaSyDAk11vcbkfi6R0KQwbG5GOiiZfUNMy9n0",
  authDomain: "roumine-minifootball.firebaseapp.com",
  projectId: "roumine-minifootball",
  storageBucket: "roumine-minifootball.appspot.com",
  messagingSenderId: "34374414405",
  appId: "1:34374414405:web:327831866fb33c564ab32c",
  measurementId: "G-038V38PP7V"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Example export of database methods for app.js
export { collection, addDoc, onSnapshot, signInWithPopup, GoogleAuthProvider };