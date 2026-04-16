# ☁️ Cloud Seeker

**Real-time AWS Security Monitoring + Compliance + Analytics**

![CI/CD](https://github.com/YOUR_USERNAME/cloud-seeker/actions/workflows/deploy.yml/badge.svg)
![AWS SAM](https://img.shields.io/badge/AWS-SAM-orange?logo=amazon-aws)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![Python](https://img.shields.io/badge/Python-3.12-green?logo=python)

---

## 🏗 Architecture

```
CloudTrail → S3 → EventBridge → Step Functions
                                      ↓
                                   Lambda (Analyzer)
                                   ├── DynamoDB (store alerts)
                                   ├── SNS (email/SMS alerts)
                                   ├── CloudWatch (metrics)
                                   └── Config (compliance)
                                      ↓
                             API Gateway → Amplify + CloudFront
                                              ↓
                                         QuickSight (analytics)
```

### Services Used (13)

| # | Service | Purpose |
|---|---------|---------|
| 1 | **CloudTrail** | Records all AWS API activity |
| 2 | **S3** | Stores CloudTrail log files |
| 3 | **EventBridge** | Detects suspicious events in real-time |
| 4 | **Step Functions** | Orchestrates the analysis workflow |
| 5 | **Lambda** | Core analysis, API, compliance logic |
| 6 | **DynamoDB** | Stores alerts and results |
| 7 | **SNS** | Sends email/SMS notifications |
| 8 | **CloudWatch** | Logs, metrics, and alarms |
| 9 | **AWS Config** | Security compliance rules |
| 10 | **API Gateway** | REST API for the frontend |
| 11 | **Amplify** | Hosts the React frontend |
| 12 | **CloudFront** | CDN for fast global delivery |
| 13 | **QuickSight** | Analytics dashboards |

---

## 🚀 Quick Start

### Prerequisites
- AWS CLI configured (`aws configure`)
- AWS SAM CLI (`pip install aws-sam-cli`)
- Node.js 20+
- Python 3.12+
- Git

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/cloud-seeker.git
cd cloud-seeker
cd frontend && npm install && cd ..
```

### 2. Deploy Backend (one command)

```bash
cd backend/cloudformation
sam build
sam deploy --guided
# Follow prompts:
#   Stack name: cloud-seeker-prod
#   Region: us-east-1
#   AlertEmailAddress: your@email.com
#   Confirm email subscription when you receive it
```

> ⚠️ **Check your email** and click the SNS subscription confirmation link.

### 3. Set API URL for Frontend

After SAM deploy finishes, copy the `ApiEndpoint` output:

```bash
echo "REACT_APP_API_URL=https://XXXXX.execute-api.us-east-1.amazonaws.com/prod" \
  > frontend/.env
```

### 4. Run Frontend Locally

```bash
cd frontend
npm start
# Opens at http://localhost:3000
```

### 5. Deploy Frontend to Amplify

```bash
# In AWS Console:
# 1. Go to AWS Amplify
# 2. Click "New App" → "Host Web App"
# 3. Connect GitHub → select cloud-seeker repo
# 4. Branch: main
# 5. Build settings auto-detected from amplify.yml
# 6. Click Deploy
# Done! Amplify gives you a live HTTPS URL.
```

---

## 🔄 Real-Time Flow (What Happens End to End)

```
1. User logs into AWS Console
        ↓
2. CloudTrail records the API call
        ↓
3. EventBridge detects it matches a rule (ConsoleLogin, etc.)
        ↓
4. EventBridge triggers Step Functions workflow
        ↓
5. Step Functions calls Lambda (Analyzer)
   ├── Is it a root login?       → CRITICAL alert
   ├── Is it a public S3 bucket? → HIGH alert
   ├── Is it port 22 open to world? → CRITICAL
   └── No threat?                → End workflow cleanly
        ↓
6. If threat detected:
   ├── Store alert in DynamoDB (with 90-day TTL)
   ├── Send email via SNS
   ├── Publish metric to CloudWatch
   └── Run compliance check (AWS Config)
        ↓
7. Dashboard (API Gateway → Lambda → DynamoDB)
   displays the alert in real-time
```

---

## 📁 Project Structure

```
cloud-seeker/
├── .github/workflows/deploy.yml    ← CI/CD pipeline
├── amplify.yml                      ← Amplify build settings
├── frontend/
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── styles/global.css        ← Dark cyberpunk theme
│       └── components/
│           ├── Dashboard.jsx
│           ├── AlertFeed.jsx        ← Live streaming alerts
│           ├── RadarScanner.jsx     ← Animated canvas radar
│           ├── ComplianceGauge.jsx  ← Compliance score bars
│           ├── ServiceHealth.jsx    ← 13 service health status
│           └── MetricCard.jsx       ← KPI cards
└── backend/
    ├── lambda/
    │   ├── analyzer/
    │   │   ├── index.py             ← Threat detection engine
    │   │   └── notifier.py          ← SNS notifications
    │   ├── api-handler/index.py     ← REST API
    │   └── compliance-checker/
    │       └── index.py             ← Config + custom rules
    ├── step-functions/workflow.json ← State machine
    ├── cloudformation/template.yaml ← All 13 AWS services
    └── tests/test_analyzer.py       ← Unit tests
```

---

## 🧪 Running Tests

```bash
# Backend
cd backend
pip install pytest moto boto3
pytest tests/ -v

# Frontend
cd frontend
npm test
```

---

## 🔐 Security Notes

- All S3 buckets have public access blocked
- DynamoDB tables use encryption at rest
- SNS uses AWS-managed KMS key
- CloudTrail logs are validated (tamper detection)
- DynamoDB TTL auto-expires alerts after 90 days
- IAM roles follow least-privilege principle

---

## 📊 Threat Detection Rules

| Event | Severity | Trigger |
|-------|----------|---------|
| Root ConsoleLogin | CRITICAL | Root account signs in |
| AuthorizeSecurityGroupIngress (0.0.0.0/0) | CRITICAL | SSH/any port opened to world |
| DeleteTrail / StopLogging | CRITICAL | CloudTrail disabled |
| CreateAccessKey (root) | CRITICAL | Root key created |
| PutBucketAcl (public-read) | HIGH | S3 bucket made public |
| DisableKey | HIGH | KMS encryption key disabled |
| PutUserPolicy (* action) | CRITICAL | Wildcard admin policy added |

---

## 🛠 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REACT_APP_API_URL` | API Gateway endpoint URL | ✅ |
| `AWS_ACCESS_KEY_ID` | AWS credentials (GitHub Secret) | ✅ |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials (GitHub Secret) | ✅ |
| `ALERT_EMAIL` | Email for SNS alerts (GitHub Secret) | ✅ |

---

## 📜 License

MIT — Cloud Seeker is open source. Built as an AWS portfolio project.
