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

## 3. Production AWS Architecture

### Recommended Approach: AWS App Runner + Amazon ECR
For a personal production API, **AWS App Runner** is the optimal choice:
- **Serverless & Fully Managed**: No EC2 OS patching, SSH keys, or load balancer maintenance.
- **Free Automatic HTTPS**: Provisioned automatically with a secure `https://<id>.awsapprunner.com` domain.
- **Production Health Checks & Automatic Rollback**: App Runner continuously monitors `GET /health`. If a new deployment fails the health check (e.g. crash loop or fatal exception), **AWS immediately aborts and rolls back to the previous healthy container**, ensuring zero downtime.
- **Cost Effective**: Scales down when idle.
- **CloudWatch Logging**: All structured application logs stream into AWS CloudWatch automatically.

### Automated Setup Script
Run the automated bootstrap script to provision ECR, IAM, and App Runner in one command:

```bash
# Ensure AWS CLI is configured with your credentials:
aws configure

# Run the setup script:
./aws/setup-aws.sh
```

The script will:
1. Create the Amazon ECR repository (`snapsend-api`).
2. Create the IAM role `AppRunnerECRAccessRole`.
3. Build and push the initial container image to ECR.
4. Create the AWS App Runner service with health checks configured on `/health`.
5. Output the exact secrets to add to GitHub.

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
   - Builds production Docker image using `backend/Dockerfile`.
   - Tags with both `latest` and git commit SHA (`${{ github.sha }}`).
   - Pushes to Amazon ECR.
3. **AWS Zero-Downtime Deployment & Rollback**:
   - Triggers `aws apprunner start-deployment`.
   - Monitors deployment health. If the container fails health check, App Runner automatically keeps the old version live.

### 2. Mobile App Pipeline (`.github/workflows/mobile-ci-cd.yml`)
1. **Static Analysis & Typecheck**:
   - Runs `npm run typecheck` (`tsc --noEmit`).
2. **Cloud EAS Build**:
   - Uses `expo/expo-github-action` with your `EXPO_TOKEN`.
   - Triggers production Android `.apk` build in the cloud.

---

## 5. Storing Secrets Securely

No credentials or tokens are committed to source control. Configure these in **GitHub Repository Settings → Secrets and variables → Actions**:

| Secret Name | Description | Where to get it |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | IAM User Access Key with ECR & App Runner permissions | AWS IAM Console |
| `AWS_SECRET_ACCESS_KEY` | IAM User Secret Key | AWS IAM Console |
| `AWS_REGION` | AWS Region (e.g. `us-east-1` or `ap-south-1`) | AWS Console |
| `ECR_REPOSITORY` | `snapsend-api` | Created by `aws/setup-aws.sh` |
| `APP_RUNNER_SERVICE_ARN` | Full ARN of the App Runner service | Output by `aws/setup-aws.sh` |
| `EXPO_TOKEN` | Expo Personal Access Token | [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens) |

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
