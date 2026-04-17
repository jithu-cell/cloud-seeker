"""
Cloud Seeker — Lambda: Security Event Analyzer
Triggered by EventBridge when CloudTrail/GuardDuty events occur.
"""
import json, boto3, os, uuid
from datetime import datetime, timezone

dynamodb = boto3.resource("dynamodb")
sns      = boto3.client("sns")
cw       = boto3.client("cloudwatch")

TABLE_NAME    = os.environ.get("ALERTS_TABLE", "cloud-seeker-alerts")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")

# ─── Threat rules ──────────────────────────────────────────────────────────────
CRITICAL = {
    "ConsoleLogin": lambda e: {"threat": e.get("userIdentity",{}).get("type")=="Root", "reason":"Root account login detected"},
    "DeleteTrail":  lambda e: {"threat": True, "reason": "CloudTrail disabled — attacker hiding tracks"},
    "StopLogging":  lambda e: {"threat": True, "reason": "CloudTrail logging stopped"},
    "CreateAccessKey": lambda e: {"threat": e.get("userIdentity",{}).get("type")=="Root", "reason":"Access key created for ROOT account"},
    "AuthorizeSecurityGroupIngress": lambda e: _open_sg(e),
}
HIGH = {
    "PutBucketAcl":        lambda e: _public_bucket(e, "S3 bucket ACL made public"),
    "PutBucketPolicy":     lambda e: _public_policy(e),
    "DisableKey":          lambda e: {"threat": True, "reason": "KMS encryption key disabled"},
    "ScheduleKeyDeletion": lambda e: {"threat": True, "reason": "KMS key scheduled for deletion"},
    "PutUserPolicy":       lambda e: _wildcard_policy(e),
    "PutRolePolicy":       lambda e: _wildcard_policy(e),
    "AttachUserPolicy":    lambda e: _admin_attach(e),
    "AttachRolePolicy":    lambda e: _admin_attach(e),
}

def _open_sg(e):
    ip = str(e.get("requestParameters", {}))
    port = e.get("requestParameters", {}).get("fromPort", "?")
    return {"threat": "0.0.0.0/0" in ip or "::/0" in ip, "reason": f"Security group opened to world (port {port})"}

def _public_bucket(e, msg):
    p = str(e.get("requestParameters", {})).lower()
    return {"threat": "public-read" in p, "reason": msg}

def _public_policy(e):
    p = str(e.get("requestParameters", {}))
    return {"threat": '"Principal":"*"' in p or '"Principal": "*"' in p, "reason": "S3 bucket policy allows public access"}

def _wildcard_policy(e):
    p = str(e.get("requestParameters", {}))
    return {"threat": '"Action":"*"' in p or '"Action": "*"' in p, "reason": "Wildcard (*) admin policy attached"}

def _admin_attach(e):
    arn = str(e.get("requestParameters", {}).get("policyArn",""))
    return {"threat": "AdministratorAccess" in arn, "reason": "AdministratorAccess policy attached to user/role"}

# ─── GuardDuty handler ─────────────────────────────────────────────────────────
def handle_guardduty(event):
    detail = event.get("detail", {})
    finding_type = detail.get("type", "Unknown")
    sev = detail.get("severity", 0)
    severity = "CRITICAL" if sev >= 7 else "HIGH" if sev >= 4 else "MEDIUM"
    return {
        "event_name": finding_type,
        "event_source": "guardduty.amazonaws.com",
        "severity": severity,
        "reason": detail.get("description", finding_type),
        "region": detail.get("region", event.get("region", "unknown")),
        "source_ip": detail.get("service", {}).get("action", {}).get("networkConnectionAction", {}).get("remoteIpDetails", {}).get("ipAddressV4", "unknown"),
        "user": detail.get("resource", {}).get("accessKeyDetails", {}).get("userName", "unknown"),
    }

# ─── Main handler ──────────────────────────────────────────────────────────────
def lambda_handler(event, context):
    print(json.dumps(event))

    # EventBridge wraps the CloudTrail event in event["detail"]
    # Direct Step Functions call passes the CloudTrail record directly
    source = event.get("source", "")

    # GuardDuty findings
    if source == "aws.guardduty" or "GuardDuty" in str(event.get("detail-type","")):
        alert_data = handle_guardduty(event)
        return _save_alert(alert_data, context)

    # CloudTrail via EventBridge  
    if source == "aws.cloudtrail" or "detail" in event:
        detail = event.get("detail", event)  # unwrap if EventBridge
    else:
        detail = event  # direct call from Step Functions

    event_name   = detail.get("eventName", "Unknown")
    event_source = detail.get("eventSource", "unknown")
    region       = detail.get("awsRegion", event.get("region", "unknown"))
    event_time   = detail.get("eventTime", datetime.now(timezone.utc).isoformat())
    source_ip    = detail.get("sourceIPAddress", "unknown")
    user_id      = detail.get("userIdentity", {})
    user         = user_id.get("arn", user_id.get("userName", user_id.get("type", "unknown")))

    # Check for threat
    result = {"threat": False}
    severity = "MEDIUM"
    if event_name in CRITICAL:
        result   = CRITICAL[event_name](detail)
        severity = "CRITICAL"
    elif event_name in HIGH:
        result   = HIGH[event_name](detail)
        severity = "HIGH"

    if not result.get("threat"):
        return {"threat_detected": False, "event_name": event_name}

    return _save_alert({
        "event_name":   event_name,
        "event_source": event_source,
        "severity":     severity,
        "reason":       result["reason"],
        "region":       region,
        "source_ip":    source_ip,
        "user":         user,
        "event_time":   event_time,
    }, context)


def _save_alert(data, context):
    alert_id = str(uuid.uuid4())
    alert = {
        "alert_id":    alert_id,
        "status":      "OPEN",
        "created_at":  datetime.now(timezone.utc).isoformat(),
        "ttl":         int(datetime.now(timezone.utc).timestamp()) + (90 * 86400),
        **data,
    }

    # Save to DynamoDB
    dynamodb.Table(TABLE_NAME).put_item(Item=alert)

    # Send email via SNS
    if SNS_TOPIC_ARN:
        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=f"🚨 [{alert['severity']}] Cloud Seeker Alert: {alert['event_name']}",
            Message=(
                f"ALERT DETECTED\n\n"
                f"Type:     {alert['event_name']}\n"
                f"Severity: {alert['severity']}\n"
                f"Reason:   {alert['reason']}\n"
                f"Region:   {alert.get('region','unknown')}\n"
                f"User:     {alert.get('user','unknown')}\n"
                f"IP:       {alert.get('source_ip','unknown')}\n"
                f"Time:     {alert.get('event_time','unknown')}\n\n"
                f"Alert ID: {alert_id}\n"
                f"View dashboard for details."
            ),
        )

    # CloudWatch metric
    cw.put_metric_data(
        Namespace="CloudSeeker/Security",
        MetricData=[{
            "MetricName": "ThreatDetected",
            "Dimensions": [{"Name": "Severity", "Value": alert["severity"]}],
            "Value": 1, "Unit": "Count",
        }],
    )

    print(f"Alert saved: {alert_id} — {alert['severity']} — {alert['event_name']}")
    return {"threat_detected": True, "alert_id": alert_id, "severity": alert["severity"]}
