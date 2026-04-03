# TripSplit — Shared Trip Expense Tracker

A lightweight, mobile-friendly web app for tracking shared trip expenses between two people. Works beautifully on iPhones — just open the URL in Safari and add to your Home Screen for a native app-like experience.

## Features

- **Two-person tracking** — Both you and your partner add expenses from your own phones
- **Real-time sync** — Expenses appear instantly on both devices via Firebase
- **Categories** — Transport, Food, Hotel, Sightseeing, Shopping, Other
- **Charts & Analytics** — Category breakdown (doughnut), daily spending (bar), per-person comparison
- **Budget tracking** — Optional budget with progress bar
- **PWA** — Add to Home Screen on iPhone for full-screen, app-like experience
- **Dark mode** — Automatically follows your phone's theme
- **Export** — Download all expenses as JSON
- **Zero cost** — Free hosting + free Firebase tier

---

## Setup Guide (10 minutes)

### Step 1: Create a Firebase Project (Free)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** (or "Add project")
3. Enter a project name (e.g., `trip-expenses`) → Click Continue
4. Disable Google Analytics (not needed) → Click **Create Project**
5. Wait for it to finish, then click **Continue**

### Step 2: Add a Web App to Firebase

1. On the project dashboard, click the **web icon** `</>` (Add app)
2. Enter a nickname: `TripSplit` → Click **Register app**
3. You'll see a code block with `firebaseConfig`. Copy these values:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "trip-expenses-xxxxx.firebaseapp.com",
     projectId: "trip-expenses-xxxxx",
     storageBucket: "trip-expenses-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
4. Click **Continue to console**

### Step 3: Enable Firestore Database

1. In Firebase Console, go to **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (allows read/write for 30 days)
   - For longer use, update the rules later (see Security section below)
4. Select the closest region (e.g., `asia-south1` for India)
5. Click **Enable**

### Step 4: Add Your Firebase Config

Open `firebase-config.js` and replace the placeholder values with your actual config:

```js
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### Step 5: Deploy to GitHub Pages (Free Hosting)

1. Create a GitHub account if you don't have one: [github.com](https://github.com)
2. Create a new repository named `expense-tracker`
3. Upload all the files:

```bash
# Initialize git and push
cd expense-tracker
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/expense-tracker.git
git push -u origin main
```

4. Go to your repo on GitHub → **Settings → Pages**
5. Under "Source", select **Deploy from a branch**
6. Choose `main` branch, `/ (root)` folder → Click **Save**
7. Wait 1-2 minutes, your app will be live at:
   ```
   https://YOUR_USERNAME.github.io/expense-tracker/
   ```

### Step 6: Add to iPhone Home Screen

1. Open the URL in **Safari** on your iPhone
2. Tap the **Share button** (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **Add**
5. The app icon appears on your Home Screen — it opens in full-screen mode!

**Do this on both phones.**

---

## How to Use

### Starting a Trip
1. **Person 1** opens the app → "New Trip" tab
2. Enter trip name, your name, partner's name, optional budget
3. Tap **Create Trip** → You'll get a **6-character trip code**

### Joining the Trip
4. **Person 2** opens the app → "Join Trip" tab
5. Enter the trip code and their name
6. Tap **Join Trip** — both phones now show the same trip!

### Adding Expenses
- Tap the **+** button
- Enter amount, pick category, add description
- Select who paid
- Tap **Save** — it syncs instantly to both phones

### Viewing Analytics
- Tap **📊 Charts** to see:
  - Category breakdown (doughnut chart)
  - Daily spending trend (bar chart)
  - Who spent more (doughnut chart)
  - Category × Person breakdown (grouped bar chart)

### Editing/Deleting
- Tap any expense to edit or delete it

---

## Alternative Free Hosting Options

| Platform | URL Format | Setup Difficulty |
|----------|-----------|-----------------|
| **GitHub Pages** | `username.github.io/repo` | Easy |
| **Netlify** | `appname.netlify.app` | Very Easy (drag & drop) |
| **Cloudflare Pages** | `appname.pages.dev` | Easy |
| **Vercel** | `appname.vercel.app` | Easy |

### Netlify (Easiest — No Git Required)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag your entire `expense-tracker` folder onto the page
3. Done! You get a URL instantly.

---

## Firestore Security Rules (For Production)

After your 30-day test mode expires, update your Firestore rules to:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripCode} {
      allow read, write: if true;
      match /expenses/{expenseId} {
        allow read, write: if true;
      }
    }
  }
}
```

> **Note:** Since there's no authentication, anyone with your trip code can access the data. For a personal trip tracker, this is fine. The 6-character code acts as a simple "password".

---

## Firebase Free Tier Limits (Spark Plan)

| Resource | Free Limit | Your Usage |
|----------|-----------|------------|
| Firestore storage | 1 GiB | ~0.001 GiB for trip data |
| Document reads | 50,000/day | ~100/day typical |
| Document writes | 20,000/day | ~20/day typical |
| Hosting bandwidth | N/A (using GitHub Pages) | — |

You'll never come close to these limits for personal use.

---

## Tech Stack

- **HTML5 + CSS3 + Vanilla JavaScript** — no frameworks, no build tools
- **Firebase Firestore** — real-time NoSQL database (free tier)
- **Chart.js** — beautiful, responsive charts
- **PWA** — service worker + manifest for offline support & Home Screen install
- **GitHub Pages** — free static hosting

---

## File Structure

```
expense-tracker/
├── index.html          # Main app (single page)
├── style.css           # Mobile-first responsive styles
├── app.js              # Application logic
├── firebase-config.js  # Firebase configuration (edit this!)
├── manifest.json       # PWA manifest
├── sw.js               # Service worker for offline caching
└── README.md           # This file
```

## License

MIT — use it however you like!
