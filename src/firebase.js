import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
//import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBn5YX8AcVy5fVI_Esmn_Z4Oh9oidaoLX4",
  authDomain: "bookmarkja-f1a8e.firebaseapp.com",
  projectId: "bookmarkja-f1a8e",
  storageBucket: "bookmarkja-f1a8e.firebasestorage.app",
  messagingSenderId: "291196970158",
  appId: "1:291196970158:web:90fcd479afb10e7547b93f",
  measurementId: "G-KG63Z3EHTC"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app); // ✅ THIS WAS MISSING

//const analytics = getAnalytics(app);