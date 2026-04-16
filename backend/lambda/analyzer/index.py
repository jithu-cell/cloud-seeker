"""
Cloud Seeker — Lambda: Security Event Analyzer
Triggered by Step Functions. Analyzes CloudTrail events for threats.
"""

import json
import boto3
import os
import uuid
from datetime import datetime, timezone
from typing import Any

dynamodb = boto3.resource("dynamodb")
sns = boto3.client("sns")
cloudwatch = boto3.client("cloudwatch")

TABLE_NAME = os.environ.get("ALERTS_TABLE", "cloud-seeker-alerts")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")

# ─── Threat Detection Rules ───────────────────────────────────────────────────

CRITICAL_EVENTS = {
    "ConsoleLogin": lambda e: _check_root_login(e),
    "AuthorizeSecurityGroupIngress": lambda e: _check_open_security_group(e),
    "DeleteTrail": lambda e: {"threat": True, "reason": "CloudTrail disabled"},
    "StopLogging": lambda e: {"threat": True, "reason": "CloudTrail logging stopped"},
    "CreateAccessKey": lambda e: _check_root_key_creation(e),
    "PutUserPolicy": lambda e: _check_admin_policy(e),
    "PutRolePolicy": lambda e: _check_admin_policy(e),
}

HIGH_EVENTS = {
    "PutBucketAcl": lambda e: _check_public_bucket(e),
    "PutBucketPolicy": lambda e: _check_public_bucket_policy(e),
    "DisableKey": lambda e: {"threat": True, "reason": "KMS key disabled"},
    "ScheduleKeyDeletion": lambda e: {"threat": True, "reason": "KMS key scheduled for deletion"},
}


def _check_root_login(event: dict) -> dict:
    username = event.get("userIdentity", {}).get("type", "")
    if username == "Root":
        return {"threat": True, "reason": "Root account console login detected"}
    return {"threat": False}


def _check_open_security_group(event: dict) -> dict:
    params = event.get("requestParameters", {})
    ip_ranges = str(params)
    if "0.0.0.0/0" in ip_ranges or "::/0" in ip_ranges:
        port = params.get("fromPort", "unknown")
        return {"threat": True, "reason": f"Security group opened to world on port {port}"}
    return {"threat": False}


def _check_root_key_creation(event: dict) -> dict:
    identity = event.get("userIdentity", {})
    if identity.get("type") == "Root":
        return {"threat": True, "reason": "Access key created for root account"}
    return {"threat": False}


def _check_admin_policy(event: dict) -> dict:
    params = str(event.get("requestParameters", {}))
    if '"Action": "*"' in params or '"Action":"*"' in params:
        return {"threat": True, "reason": "Wildcard (*) admin policy attached"}
    return {"threat": False}


def _check_public_bucket(event: dict) -> dict:
    params = str(event.get("requestParameters", {}))
    if "public-read" in params.lower() or "public-read-write" in params.lower():
        bucket = event.get("requestParameters", {}).get("bucketName", "unknown")
        return {"threat": True, "reason": f"S3 bucket {bucket} made public"}
    return {"threat": False}


def _check_public_bucket_policy(event: dict) -> dict:
    params = str(event.get("requestParameters", {}))
    if '"Principal": "*"' in params or '"Principal":"*"' in params:
        return {"threat": True, "reason": "S3 bucket policy grants public access"}
    return {"threat": False}


# ─── Severity Classifier ─────────────────────────────────────────────────────

def classify_severity(event_name: str, threat_result: dict) -> str:
    if event_name in CRITICAL_EVENTS:
        return "CRITICAL"
    if event_name in HIGH_EVENTS:
        return "HIGH"
    return "MEDIUM"


# ─── Main Handler ─────────────────────────────────────────────────────────────

def lambda_handler(event: dict, context: Any) -> dict:
    """
    Input: CloudTrail event record (from Step Functions)
    Output: Analysis result with alert_id, severity, threat_detected
    """
    print(f"Analyzing event: {json.dumps(event)}")

    event_name = event.get("eventName", "Unknown")
    event_source = event.get("eventSource", "unknown")
    source_ip = event.get("sourceIPAddress", "unknown")
    user_identity = event.get("userIdentity", {})
    aws_region = event.get("awsRegion", "unknown")
    event_time = event.get("eventTime", datetime.now(timezone.utc).isoformat())

    # ── Run threat detection ──
    threat_result = {"threat": False}

    if event_name in CRITICAL_EVENTS:
        threat_result = CRITICAL_EVENTS[event_name](event)
    elif event_name in HIGH_EVENTS:
        threat_result = HIGH_EVENTS[event_name](event)

    if not threat_result.get("threat", False):
        return {
            "threat_detected": False,
            "event_name": event_name,
            "message": "Event analyzed — no threat detected",
        }

    # ── Threat detected — create alert ──
    severity = classify_severity(event_name, threat_result)
    alert_id = str(uuid.uuid4())

    alert = {
        "alert_id": alert_id,
        "event_name": event_name,
        "event_source": event_source,
        "severity": severity,
        "reason": threat_result["reason"],
        "source_ip": source_ip,
        "user": user_identity.get("arn", user_identity.get("userName", "unknown")),
        "region": aws_region,
        "event_time": event_time,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "OPEN",
        "ttl": int(datetime.now(timezone.utc).timestamp()) + (90 * 24 * 3600),
    }

    # ── Store in DynamoDB ──
    table = dynamodb.Table(TABLE_NAME)
    table.put_item(Item=alert)
    print(f"Alert stored: {alert_id}")

    # ── Publish CloudWatch Metric ──
    cloudwatch.put_metric_data(
        Namespace="CloudSeeker/Security",
        MetricData=[
            {
                "MetricName": "ThreatDetected",
                "Dimensions": [
                    {"Name": "Severity", "Value": severity},
                    {"Name": "EventName", "Value": event_name},
                ],
                "Value": 1,
                "Unit": "Count",
            }
        ],
    )

    return {
        "threat_detected": True,
        "alert_id": alert_id,
        "severity": severity,
        "reason": threat_result["reason"],
        "event_name": event_name,
    }
