# SnapSend: Production Architecture, Build & CI/CD Workflow Guide

This document describes the complete production-ready setup, build commands, AWS deployment architecture, and automated GitHub Actions CI/CD pipeline for **SnapSend**.

---

## 1. Complete Project Structure

```text
automate/
├── .github/
│   └── workflows/
│       ├── backend-ci-cd.yml         # GitHub Actions: test, Docker build & AWS App Runner deploy
│       └── mobile-ci-cd.yml          # GitHub Actions: typecheck & EAS production APK build
├── aws/
│   ├── apprunner.json                # AWS App Runner service definition & healthcheck spec
│   └── setup-aws.sh                  # Automated script to provision ECR, IAM, and App Runner
├── backend/
│   ├── app/
│   │   ├── models/                   # SQLAlchemy async models (Destination, SendLog)
│   │   ├── providers/                # Telegram & extensible message providers
│   │   ├── routers/
│   │   │   ├── health.py             # Production healthcheck with DB ping & uptime
│   │   │   ├── destinations.py       # Destination CRUD & connection testing
│   │   │   └── media.py              # Photo & video ingest / dispatch
│   │   ├── schemas/                  # Pydantic v2 validation models
│   │   ├── config.py                 # Pydantic BaseSettings environment config
│   │   ├── database.py               # Async SQLAlchemy engine & session maker
│   │   └── main.py                   # FastAPI entrypoint with structured logging & CORS
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_api.py               # Automated pytest suite (health & CRUD)
│   ├── Dockerfile                    # Production multi-stage Dockerfile with non-root user & HEALTHCHECK
│   ├── pytest.ini                    # Pytest configuration
│   └── requirements.txt              # Production & test dependencies
├── mobile/
│   ├── app/                          # Expo Router screens (tabs, layout)
│   ├── src/
│   │   ├── hooks/                    # useCamera, useMediaSend (volume shutter listener)
│   │   ├── providers/                # Telegram direct API provider with Blob fallback
│   │   ├── screens/                  # CameraScreen, SettingsScreen
│   │   ├── services/                 # MediaService
│   │   └── store/                    # Zustand persistent settings store
│   ├── app.json                      # Expo application manifest
│   ├── eas.json                      # EAS configuration with standalone APK production profile
│   └── package.json                  # Scripts & dependencies
├── docker-compose.yml                # Local development stack
├── docker-compose.prod.yml           # Production Docker Compose with healthcheck & volume persistence
└── README.md
```

---

## 2. Production Android `.apk` Build & Installation

### A. Why this produces an installable `.apk`
Default Expo EAS `production` profiles output an `.aab` (Android App Bundle), which requires Google Play Console or `bundletool` to install. In `mobile/eas.json`, the `production` profile has been configured with:

```json
"production": {
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  }
}
```

This ensures that the build produces a **standalone `.apk` file** that bundles the entire JavaScript engine, assets, and native modules (`react-native-volume-manager`, `expo-camera`). **It runs completely independently without requiring a Mac development server or Expo Go.**

### B. Exact Commands to Build the APK

#### Option 1: Cloud Build via EAS (Recommended)
From your terminal on your Mac:

```bash
cd mobile
npm run build:apk
# or explicitly:
npx eas-cli build --platform android --profile production --non-interactive
```

*When the build finishes, EAS prints the direct download link and QR code in the terminal.*

#### Option 2: Automated via GitHub Actions
Every push to `main` (or manual trigger from GitHub Actions tab) automatically builds the standalone `.apk`.

### C. Exact Steps to Install the APK on Your Phone

1. **Download the `.apk`**:
   - Open the EAS build URL on your Android phone's browser, OR
   - Download the `.apk` on your Mac and transfer via USB/AirDrop/Drive.
2. **Install via Phone**:
   - Tap the downloaded `.apk` file.
   - If prompted: *“For your security, your phone is not allowed to install unknown apps from this source”*, tap **Settings** → toggle **Allow from this source** → tap **Install**.
3. **Alternative: Install via USB (ADB)**:
   ```bash
   adb install -r path/to/snapsend.apk
   ```
4. **Open SnapSend**:
   - The app opens with full native camera access and volume button shutter remote support.

---

## 3. Production AWS Architecture (Live in ap-south-1)

### Architecture: AWS ECS Fargate + Amazon ECR
- **Region**: `ap-south-1` (Mumbai)
- **Cluster**: `snapsend-cluster`
- **Service**: `snapsend-service` (Fargate launch type, ARM64)
- **Task Definition**: `snapsend-api:2`
- **ECR Repository**: `376159573859.dkr.ecr.ap-south-1.amazonaws.com/snapsend-api`
- **Live Health Endpoint**: `http://43.205.142.26:8000/health`
- **CloudWatch Log Group**: `/ecs/snapsend-api`

---

## 4. GitHub Actions CI/CD Pipeline

Two workflows run automatically on every `git push` to `main`:

### 1. Backend Pipeline (`.github/workflows/backend-ci-cd.yml`)
1. **Automated Testing**:
   - Checks out code and provisions Python 3.12.
   - Installs dependencies from `backend/requirements.txt`.
   - Runs `pytest backend/tests/ -v` to verify API endpoints, database initialization, and configuration.
2. **Docker Build & Push**:
   - Authenticates to Amazon ECR.
   - Builds production Docker image for `linux/arm64`.
   - Tags with both `latest` and git commit SHA (`${{ github.sha }}`).
   - Pushes to Amazon ECR (`376159573859.dkr.ecr.ap-south-1.amazonaws.com/snapsend-api`).
3. **AWS Zero-Downtime Deployment & Rollback**:
   - Triggers `aws ecs update-service --cluster snapsend-cluster --service snapsend-service --force-new-deployment`.
   - Waits for the ECS service to reach steady state (`aws ecs wait services-stable`).

### 2. Mobile App Pipeline (`.github/workflows/mobile-ci-cd.yml`)
1. **Static Analysis & Typecheck**:
   - Runs `npm run typecheck` (`tsc --noEmit`).
2. **Cloud EAS Build**:
   - Uses `expo/expo-github-action` with your `EXPO_TOKEN`.
   - Triggers production Android `.apk` build in the cloud.

---

## 5. Storing Secrets Securely

Configure these in **GitHub Repository Settings → Secrets and variables → Actions**:

| Secret Name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | `AKIAVPFG3S5RXRVIDSML` |
| `AWS_SECRET_ACCESS_KEY` | *(your secret access key from aws configure)* |
| `AWS_REGION` | `ap-south-1` |
| `ECR_REPOSITORY` | `snapsend-api` |
| `ECS_CLUSTER_NAME` | `snapsend-cluster` |
| `ECS_SERVICE_NAME` | `snapsend-service` |
| `EXPO_TOKEN` | Expo Personal Access Token ([expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)) |


---

## 6. Local Production Docker Verification

To run the production backend container locally with Docker Compose:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Verify health:
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "SnapSend API",
  "environment": "production",
  "database": "ok",
  "uptime_seconds": 12,
  "timestamp": "2026-10-03T09:35:00.000000"
}
```
