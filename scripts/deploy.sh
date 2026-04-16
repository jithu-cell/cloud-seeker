#!/bin/bash
# ╔══════════════════════════════════════════════╗
# ║  Cloud Seeker — One-Command Deploy Script    ║
# ║  Usage: chmod +x scripts/deploy.sh           ║
# ║         ./scripts/deploy.sh [dev|prod]       ║
# ╚══════════════════════════════════════════════╝

set -e

ENV=${1:-prod}
REGION=${AWS_DEFAULT_REGION:-us-east-1}
STACK_NAME="cloud-seeker-$ENV"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${CYAN}[CS]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        ☁  CLOUD SEEKER DEPLOY        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Pre-flight checks ──────────────────────────
log "Checking prerequisites..."

command -v aws     &>/dev/null || err "AWS CLI not found. Install: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
command -v sam     &>/dev/null || err "SAM CLI not found. Install: pip install aws-sam-cli"
command -v node    &>/dev/null || err "Node.js not found. Install: https://nodejs.org"
command -v python3 &>/dev/null || err "Python 3 not found."

ok "All prerequisites found"

# ── AWS credentials check ──────────────────────
log "Checking AWS credentials..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) || \
  err "AWS credentials not configured. Run: aws configure"
ok "AWS Account: $ACCOUNT_ID | Region: $REGION"

# ── Get alert email ────────────────────────────
if [ -z "$ALERT_EMAIL" ]; then
  read -p "📧 Enter alert email address: " ALERT_EMAIL
  [ -z "$ALERT_EMAIL" ] && err "Email address required"
fi

echo ""

# ── Step 1: Build backend ──────────────────────
log "Step 1/4: Building backend (SAM)..."
cd backend/cloudformation
sam build --use-container 2>/dev/null || sam build
ok "SAM build complete"

# ── Step 2: Deploy backend ─────────────────────
log "Step 2/4: Deploying backend to AWS ($STACK_NAME)..."
sam deploy \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    AlertEmailAddress="$ALERT_EMAIL" \
    EnvironmentName="$ENV" \
  --no-fail-on-empty-changeset \
  --no-confirm-changeset
ok "Backend deployed"

# ── Get outputs ────────────────────────────────
log "Getting stack outputs..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)
ok "API URL: $API_URL"

# ── Step 3: Set frontend env ───────────────────
log "Step 3/4: Configuring frontend..."
cd ../../frontend
echo "REACT_APP_API_URL=$API_URL" > .env
ok "Frontend .env configured"

# ── Step 4: Build frontend ─────────────────────
log "Step 4/4: Building frontend..."
npm ci --silent
npm run build --silent
ok "Frontend build complete (frontend/build/)"

# ── Done ───────────────────────────────────────
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     🎉  CLOUD SEEKER DEPLOYED!            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}API Gateway:${NC}  $API_URL"
echo -e "  ${CYAN}Frontend:${NC}     Connect repo to AWS Amplify"
echo -e "  ${CYAN}Stack:${NC}        $STACK_NAME ($REGION)"
echo ""
warn "Check your email ($ALERT_EMAIL) to confirm SNS subscription!"
echo ""
