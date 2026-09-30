# SnapSend

> Open app → Camera → Capture → **Automatically sent to Telegram**

## Quick Start

### 1. Mobile App

```bash
cd mobile
npm install          # or: yarn install
npx expo start
```

Scan the QR code with **Expo Go** (iOS/Android).

### 2. Settings (first run)

1. Tap the **Settings** tab.
2. Enter your **Bot Token** (from @BotFather).
3. Enter your **Chat ID** (use @userinfobot to find yours).
4. Tap **Test Connection** → you should see "✓ Connection successful".
5. Tap **Save Destination**.

### 3. Capture & Send

Switch to the **Camera** tab.
- **PHOTO mode**: tap the shutter button → photo is instantly sent to Telegram.
- **VIDEO mode**: tap the red button to start recording, tap again to stop → video is sent automatically.

---

## Architecture

```
Camera Screen
    │
    ▼
MediaService          ← orchestrator (no provider-specific code here)
    │
    ▼
MessageProvider       ← abstract interface
    │
    ▼
TelegramProvider      ← calls Telegram Bot API directly from device
    │
    ▼
Telegram Bot API ─────► Your Telegram chat
```

The **bot token never leaves your device** — it is stored in the platform keychain
(`expo-secure-store`) and sent directly to `api.telegram.org`.

---

## Backend (optional, production)

The FastAPI backend adds: persistent logs, multi-destination management, and a
REST API for managing destinations.

```bash
cd backend
cp .env.example .env   # fill in values
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Or with Docker:

```bash
docker compose up --build
```

API docs available at: http://localhost:8000/docs

---

## Adding a New Provider

1. Create `mobile/src/providers/<name>/<Name>Provider.ts` implementing `MessageProvider`.
2. Register it in `mobile/src/providers/index.ts`.
3. Create `backend/app/providers/<name>.py` implementing `BaseProvider`.
4. Register it in `backend/app/providers/registry.py`.

That's it — no changes to `CameraScreen`, `MediaService`, or any other file.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native, Expo SDK 51, TypeScript |
| State | Zustand + expo-secure-store |
| Camera | expo-camera (CameraView) |
| File upload | expo-file-system (multipart) |
| Navigation | expo-router |
| Backend | FastAPI, SQLAlchemy async, SQLite / PostgreSQL |
| Telegram | Bot API (sendPhoto / sendVideo) |
