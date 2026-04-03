// =====================================================
// TripSplit — Firebase Configuration
// =====================================================
// INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (free tier / Spark plan)
// 3. Go to Project Settings > General > Your apps > Add web app
// 4. Copy the config values below
// 5. Enable Firestore: Build > Firestore Database > Create Database > Start in test mode
//
// See README.md for detailed step-by-step instructions.
// =====================================================

const firebaseConfig = {
  apiKey: "AIzaSyCq-5dfpYEF5YWmyXxXqoa5MQZRieNdQlk",
  authDomain: "trip-expenses-6b5cc.firebaseapp.com",
  projectId: "trip-expenses-6b5cc",
  storageBucket: "trip-expenses-6b5cc.firebasestorage.app",
  messagingSenderId: "1079792398978",
  appId: "1:1079792398978:web:b9a8f7d2a2c4d128e63a9b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
