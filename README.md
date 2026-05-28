# Textile Shift Attendance System

A fully-featured, PWA-ready attendance management web application designed for a textile factory environment. It features camera selfie punching, GPS coordinates logging, shift grace-time calculations, automated PWA prompts, and a comprehensive administration dashboard.

## Tech Stack
* **Frontend**: React + Vite + TailwindCSS + Lucide Icons + Canvas Confetti
* **Backend**: Supabase Auth + PostgreSQL + Supabase Storage

---

## Getting Started

### 1. Database Setup (Supabase)
1. Go to your [Supabase Console](https://supabase.com).
2. Open the **SQL Editor** in your project dashboard.
3. Open the file [schema.sql](file:///c:/Users/Admin/Desktop/attendence/schema.sql), copy its contents, paste it into the Supabase SQL editor, and click **Run**.
   * *This will create all the required tables (`shifts`, `profiles`, `attendance`, `settings`), triggers for new user registration, index points, and Row-Level Security (RLS) policies.*

### 2. Storage Setup
1. Go to the **Storage** section in your Supabase Dashboard.
2. Click **New Bucket** and name it `attendance-selfies`.
3. Set the bucket access toggle to **Public** (required to render selfies in logs).

### 3. Create the Administrator Account
Since registration of administrators is protected, create your initial administrator account by following these steps:
1. In your Supabase Dashboard, navigate to **Authentication** -> **Users** and click **Add User** -> **Create User**.
2. Provide an email and password (e.g., `admin@company.com`).
3. Once created, copy the **User ID (UUID)** of the newly created user.
4. Open the Supabase **SQL Editor** and run the following query to elevate their profile to administrator role:
   ```sql
   UPDATE public.profiles
   SET role = 'admin', full_name = 'Factory Manager', department = 'Management'
   WHERE id = 'PASTE_YOUR_COPIED_UUID_HERE';
   ```
5. You can now log into the web application using this email and password as an administrator!

### 4. Local Installation & Launch
1. Ensure you have Node.js and npm installed.
2. In your terminal, navigate to the project workspace directory:
   ```bash
   cd c:\Users\Admin\Desktop\attendence
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server in network-sharing mode:
   ```bash
   npm run dev
   ```
5. Open the network link shown in your terminal (e.g. `http://192.168.x.x:5173`) on your mobile devices to test front camera and Geolocation permissions!

---

## Features Built
1. **Selfie Capture & Automatic Compression**: Resizes snapshots to square format (480x480) and compresses to JPEG (70% quality) yielding files below ~40KB for rapid upload in poor connection conditions.
2. **Double Punch Safeguards**: 
   * Workers cannot punch IN twice in a row.
   * Workers cannot punch OUT without punching IN first.
   * Punches are locked for 5 minutes between logs to prevent duplicate uploads.
3. **GPS Geolocation Validation**: Captures active coordinates; if blocked, continues punch submission but marks location as "Unavailable" in logs.
4. **Offline and PWA Support**: Implements a PWA `manifest.json` and a custom Service Worker cache (`sw.js`) so workers can load the punch screen even under weak network conditions.
