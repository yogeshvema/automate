#!/usr/bin/env bash
# ==============================================================================
# SnapSend AWS Infrastructure Setup Script
# Creates: ECR Repository, App Runner Service Role, and initial deployment.
# ==============================================================================
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
REPO_NAME="snapsend-api"
SERVICE_NAME="snapsend-api"

echo "=== 1. Checking AWS credentials ==="
aws sts get-caller-identity --output json || {
  echo "Error: AWS CLI is not configured. Please run 'aws configure' first."
  exit 1
}

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account: $ACCOUNT_ID"
echo "AWS Region:  $AWS_REGION"

echo ""
echo "=== 2. Creating / Ensuring Amazon ECR Repository: $REPO_NAME ==="
aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$AWS_REGION" >/dev/null 2>&1 || {
  aws ecr create-repository \
    --repository-name "$REPO_NAME" \
    --image-scanning-configuration scanOnPush=true \
    --region "$AWS_REGION"
  echo "ECR repository created."
}
ECR_URI="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO_NAME"
echo "ECR URI: $ECR_URI"

echo ""
echo "=== 3. Creating App Runner ECR Access IAM Role ==="
ROLE_NAME="AppRunnerECRAccessRole"
TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "build.apprunner.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}'

aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1 || {
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY"
  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
  echo "IAM Role $ROLE_NAME created and policy attached."
  sleep 5
}
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)
echo "Role ARN: $ROLE_ARN"

echo ""
echo "=== 4. Building and Pushing initial bootstrap image ==="
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker build -t "$REPO_NAME:latest" -f backend/Dockerfile backend/
docker tag "$REPO_NAME:latest" "$ECR_URI:latest"
docker push "$ECR_URI:latest"

echo ""
echo "=== 5. Creating / Ensuring App Runner Service ==="
SERVICE_ARN=$(aws apprunner list-services --region "$AWS_REGION" --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text)

if [ -z "$SERVICE_ARN" ]; then
  echo "Creating App Runner service '$SERVICE_NAME'..."
  SERVICE_ARN=$(aws apprunner create-service \
    --service-name "$SERVICE_NAME" \
    --source-configuration "{
      \"AuthenticationConfiguration\": {
        \"AccessRoleArn\": \"$ROLE_ARN\"
      },
      \"ImageRepository\": {
        \"ImageIdentifier\": \"$ECR_URI:latest\",
        \"ImageConfiguration\": {
          \"Port\": \"8000\",
          \"RuntimeEnvironmentVariables\": {
            \"APP_NAME\": \"SnapSend API\",
            \"ENVIRONMENT\": \"production\",
            \"DEBUG\": \"false\",
            \"LOG_LEVEL\": \"INFO\",
            \"DATABASE_URL\": \"sqlite+aiosqlite:///./snapsend.db\"
          }
        },
        \"ImageRepositoryType\": \"ECR\"
      },
      \"AutoDeploymentsEnabled\": false
    }" \
    --health-check-configuration "{
      \"Protocol\": \"HTTP\",
      \"Path\": \"/health\",
      \"Interval\": 10,
      \"Timeout\": 5,
      \"HealthyThreshold\": 1,
      \"UnhealthyThreshold\": 3
    }" \
    --instance-configuration "{
      \"Cpu\": \"1 vCPU\",
      \"Memory\": \"2 GB\"
    }" \
    --region "$AWS_REGION" \
    --query "Service.ServiceArn" \
    --output text)
  echo "Service created: $SERVICE_ARN"
else
  echo "App Runner service already exists: $SERVICE_ARN"
fi

echo ""
echo "=============================================================================="
echo " AWS SETUP COMPLETE! Configure these GitHub Secrets in your GitHub Repo:"
echo "=============================================================================="
echo " AWS_REGION:             $AWS_REGION"
echo " ECR_REPOSITORY:         $REPO_NAME"
echo " APP_RUNNER_SERVICE_ARN: $SERVICE_ARN"
echo " AWS_ACCESS_KEY_ID:      <your-aws-access-key-id>"
echo " AWS_SECRET_ACCESS_KEY:  <your-aws-secret-access-key>"
echo "=============================================================================="
