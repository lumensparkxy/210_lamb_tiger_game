import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyArUcrjhXysW8NpscIo-HqPrSsbZGeqdK0",
  authDomain: "learnerx-771c9.firebaseapp.com",
  projectId: "learnerx-771c9",
  storageBucket: "learnerx-771c9.firebasestorage.app",
  messagingSenderId: "536429281104",
  appId: "1:536429281104:web:a5b4a0df242ca4b1763655"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
