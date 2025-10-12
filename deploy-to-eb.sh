#!/bin/bash

# Deploy Sparrow Backend to AWS Elastic Beanstalk
# This script uses AWS CLI to deploy without needing EB CLI

echo "🚀 Deploying Sparrow Backend to AWS Elastic Beanstalk..."

# Configuration
APPLICATION_NAME="Sparrow-backend"
ENVIRONMENT_NAME="Sparrow-backend-env"
VERSION_LABEL="v$(date +%Y%m%d%H%M%S)"
S3_BUCKET="sparrow-deployments"  # You may need to create this bucket
REGION="eu-west-1"  # Change to your region

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Creating deployment package...${NC}"

# Create deployment zip (excluding node_modules and .env)
cd sparrow-backend
zip -r ../sparrow-backend-deploy.zip . -x "node_modules/*" ".env" "*.log"
cd ..

echo -e "${YELLOW}📤 Uploading to S3...${NC}"

# Upload to S3
aws s3 cp sparrow-backend-deploy.zip s3://${S3_BUCKET}/sparrow-backend-deploy.zip

echo -e "${YELLOW}🏗️ Creating application version...${NC}"

# Create application version
aws elasticbeanstalk create-application-version \
    --application-name "${APPLICATION_NAME}" \
    --version-label "${VERSION_LABEL}" \
    --source-bundle S3Bucket=${S3_BUCKET},S3Key=sparrow-backend-deploy.zip \
    --description "Deployment ${VERSION_LABEL} with debug logging and cookie fixes"

echo -e "${YELLOW}🚀 Deploying to environment...${NC}"

# Deploy to environment
aws elasticbeanstalk update-environment \
    --environment-name "${ENVIRONMENT_NAME}" \
    --version-label "${VERSION_LABEL}"

echo -e "${GREEN}✅ Deployment initiated!${NC}"
echo -e "${YELLOW}📊 Check deployment status with:${NC}"
echo "aws elasticbeanstalk describe-environments --environment-names ${ENVIRONMENT_NAME}"

echo -e "${YELLOW}📝 Monitor logs with:${NC}"
echo "aws logs describe-log-groups --log-group-name-prefix /aws/elasticbeanstalk/${ENVIRONMENT_NAME}"
