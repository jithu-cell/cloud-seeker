"""
Cloud Seeker — Lambda: Multi-Region Security Analyzer v3
========================================================
TWO triggers:
  1. S3 trigger  → CloudTrail drops .json.gz file → reads ALL regions
  2. EventBridge → fast path for eu-north-1 events (existing, keep it)

CloudTrail log format: { "Records": [ {eventName, awsRegion, ...}, ... ] }
"""
import json, gzip, boto3, os, uuid
from datetime import datetime, timezone

s3_client  = boto3.client("s3")
dynamodb   = boto3.resource("dynamodb")
sns_client = boto3.client("sns")
cloudwatch = boto3.client("cloudwatch")

TABLE_NAME    = os.environ.get("ALERTS_TABLE", "cloud-seeker-alerts-prod")
SNS_TOPIC     = os.environ.get("SNS_TOPIC_ARN", "")
DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://main.d278x1qva13a0f.amplifyapp.com")

# ─── Threat check functions ──────────────────────────────────────────────────

def _root_login(e):
    uid = e.get("userIdentity", {})
    if uid.get("type") == "Root":
        ip = e.get("sourceIPAddress", "unknown")
        return {"threat": True, "reason": f"ROOT account login from {ip}"}
    return {"threat": False}

def _sg_change(e):
    params = e.get("requestParameters") or {}
    sg_id  = params.get("groupId", "unknown-sg")
    p_str  = json.dumps(params)
    if "0.0.0.0/0" in p_str or "::/0" in p_str:
        port = params.get("fromPort", "any")
        return {"threat": True, "reason": f"Security group {sg_id} opened to WORLD on port {port}"}
    return {"threat": True, "reason": f"Security group {sg_id} inbound rule changed"}

def _root_key(e):
    if e.get("userIdentity", {}).get("type") == "Root":
        return {"threat": True, "reason": "Access key created for ROOT account — disable immediately"}
    return {"threat": False}

def _iam_policy(e):
    p = json.dumps(e.get("requestParameters") or {})
    name = e.get("eventName", "IAMChange")
    if '"Action":"*"' in p or '"Action": "*"' in p:
        return {"threat": True, "reason": f"WILDCARD (*) admin IAM policy applied — {name}"}
    return {"threat": True, "reason": f"IAM policy changed: {name}"}

def _admin_attach(e):
    arn = (e.get("requestParameters") or {}).get("policyArn", "")
    name = e.get("eventName", "PolicyAttach")
    if "AdministratorAccess" in arn:
        return {"threat": True, "reason": f"AdministratorAccess policy attached — {name}"}
    return {"threat": True, "reason": f"IAM managed policy attached: {name}"}

def _public_bucket(e):
    p = json.dumps(e.get("requestParameters") or {}).lower()
    bucket = (e.get("requestParameters") or {}).get("bucketName", "unknown")
    if "public-read" in p:
        return {"threat": True, "reason": f"S3 bucket '{bucket}' set to PUBLIC read"}
    return {"threat": False}

def _public_policy(e):
    p = json.dumps(e.get("requestParameters") or {})
    bucket = (e.get("requestParameters") or {}).get("bucketName", "unknown")
    if '"Principal":"*"' in p or '"Principal": "*"' in p:
        return {"threat": True, "reason": f"S3 bucket '{bucket}' policy allows public (*) access"}
    return {"threat": True, "reason": f"S3 bucket '{bucket}' policy changed"}

# ─── Threat rule tables ───────────────────────────────────────────────────────
CRITICAL = {
    "ConsoleLogin":                  _root_login,
    "DeleteTrail":                   lambda e: {"threat": True,  "reason": "CloudTrail DELETED — attacker hiding tracks"},
    "StopLogging":                   lambda e: {"threat": True,  "reason": "CloudTrail logging STOPPED"},
    "CreateAccessKey":               _root_key,
    "PutUserPolicy":                 _iam_policy,
    "PutRolePolicy":                 _iam_policy,
    "AuthorizeSecurityGroupIngress": _sg_change,
    "AuthorizeSecurityGroupEgress":  _sg_change,
}
HIGH = {
    "RevokeSecurityGroupIngress": _sg_change,
    "RevokeSecurityGroupEgress":  _sg_change,
    "CreateSecurityGroup":        lambda e: {"threat": True, "reason": f"New security group created: {(e.get('requestParameters') or {}).get('groupName','unknown')}"},
    "DeleteSecurityGroup":        lambda e: {"threat": True, "reason": f"Security group deleted: {(e.get('requestParameters') or {}).get('groupId','unknown')}"},
    "PutBucketAcl":               _public_bucket,
    "PutBucketPolicy":            _public_policy,
    "DeleteBucketPolicy":         lambda e: {"threat": True, "reason": f"S3 bucket '{(e.get('requestParameters') or {}).get('bucketName','unknown')}' policy deleted"},
    "DisableKey":                 lambda e: {"threat": True, "reason": "KMS encryption key DISABLED"},
    "ScheduleKeyDeletion":        lambda e: {"threat": True, "reason": "KMS key scheduled for DELETION"},
    "AttachUserPolicy":           _admin_attach,
    "AttachRolePolicy":           _admin_attach,
    "AttachGroupPolicy":          _admin_attach,
    "DeleteGroupPolicy":          lambda e: {"threat": True, "reason": "IAM group policy deleted"},
    "DeleteRolePolicy":           lambda e: {"threat": True, "reason": "IAM role policy deleted"},
    "DeleteUserPolicy":           lambda e: {"threat": True, "reason": "IAM user policy deleted"},
    "CreateVpc":                  lambda e: {"threat": True, "reason": "New VPC created"},
    "CreateInternetGateway":      lambda e: {"threat": True, "reason": "Internet gateway created — VPC now internet-accessible"},
    "ModifyInstanceAttribute":    lambda e: {"threat": True, "reason": "EC2 instance attribute modified"},
}
MEDIUM = {
    "UpdateTrail":    lambda e: {"threat": True, "reason": "CloudTrail configuration changed"},
    "CreateTrail":    lambda e: {"threat": True, "reason": "New CloudTrail created"},
    "PutBucketCors":  lambda e: {"threat": True, "reason": f"S3 CORS policy changed on '{(e.get('requestParameters') or {}).get('bucketName','unknown')}'"},
    "CreateUser":     lambda e: {"threat": True, "reason": f"New IAM user created: {(e.get('requestParameters') or {}).get('userName','unknown')}"},
    "CreateRole":     lambda e: {"threat": True, "reason": f"New IAM role created: {(e.get('requestParameters') or {}).get('roleName','unknown')}"},
    "AddUserToGroup": lambda e: {"threat": True, "reason": f"User '{(e.get('requestParameters') or {}).get('userName','unknown')}' added to IAM group"},
    "CreateAccessKey":lambda e: {"threat": True, "reason": f"New access key created for '{(e.get('requestParameters') or {}).get('userName','unknown')}'"},
}

ALL_RULES = {**CRITICAL, **HIGH, **MEDIUM}

def _severity(name):
    if name in CRITICAL: return "CRITICAL"
    if name in HIGH:     return "HIGH"
    return "MEDIUM"

# ─── Analyze a single CloudTrail event ───────────────────────────────────────
def analyze_event(event):
    name = event.get("eventName", "Unknown")
    if name not in ALL_RULES:
        return None

    result = ALL_RULES[name](event)
    if not result.get("threat"):
        return None

    uid    = event.get("userIdentity") or {}
    user   = uid.get("arn") or uid.get("userName") or uid.get("type", "unknown")
    region = event.get("awsRegion", "unknown")
    ip     = event.get("sourceIPAddress", "unknown")
    etime  = event.get("eventTime", datetime.now(timezone.utc).isoformat())
    sev    = _severity(name)
    aid    = str(uuid.uuid4())

    return {
        "alert_id":     aid,
        "event_name":   name,
        "event_source": event.get("eventSource", "unknown"),
        "severity":     sev,
        "reason":       result["reason"],
        "source_ip":    ip,
        "user":         user,
        "region":       region,
        "event_time":   etime,
        "created_at":   datetime.now(timezone.utc).isoformat(),
        "status":       "OPEN",
        "ttl":          int(datetime.now(timezone.utc).timestamp()) + (90 * 86400),
    }

# ─── Save alert to DynamoDB + SNS ────────────────────────────────────────────
def save_alert(alert):
    # DynamoDB
    try:
        dynamodb.Table(TABLE_NAME).put_item(Item=alert)
        print(f"DB OK: {alert['alert_id']} | {alert['severity']} | {alert['event_name']} | {alert['region']}")
    except Exception as ex:
        print(f"DB ERROR: {ex}")
        return

    # SNS email
    if not SNS_TOPIC:
        return
    EMOJI = {"CRITICAL": "🚨", "HIGH": "⚠️", "MEDIUM": "🔶"}
    sev  = alert["severity"]
    subj = f"[Cloud Seeker] {sev}: {alert['event_name']} in {alert['region']}"[:100]
    body = f"""
{EMOJI.get(sev, "⚠️")} CLOUD SEEKER — {sev} ALERT
{'='*50}
Alert ID  : {alert['alert_id']}
Severity  : {sev}
Event     : {alert['event_name']}
Reason    : {alert['reason']}

  Region   : {alert['region']}
  Source IP: {alert['source_ip']}
  User     : {alert['user']}
  Time     : {alert['event_time']}

Status: OPEN — Review immediately.
Dashboard: {DASHBOARD_URL}
---
Cloud Seeker | Alert ID: {alert['alert_id']}
"""
    try:
        sns_client.publish(TopicArn=SNS_TOPIC, Subject=subj, Message=body)
        print(f"SNS OK: {alert['alert_id']}")
    except Exception as ex:
        print(f"SNS ERROR: {ex}")

    # CloudWatch metric
    try:
        cloudwatch.put_metric_data(
            Namespace="CloudSeeker/Security",
            MetricData=[{
                "MetricName": "ThreatDetected",
                "Dimensions": [{"Name": "Severity", "Value": sev}, {"Name": "Region", "Value": alert["region"]}],
                "Value": 1, "Unit": "Count",
            }],
        )
    except Exception as ex:
        print(f"CW ERROR: {ex}")

# ─── S3 path: reads CloudTrail .json.gz from ALL regions ─────────────────────
def handle_s3_trigger(event):
    """Called when CloudTrail drops a new log file in S3."""
    alerts_created = 0
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key    = record["s3"]["object"]["key"]
        print(f"S3 trigger: s3://{bucket}/{key}")

        # Skip digest files
        if "CloudTrail-Digest" in key:
            print("Digest file — skipping")
            continue

        try:
            obj  = s3_client.get_object(Bucket=bucket, Key=key)
            body = obj["Body"].read()
            if key.endswith(".gz"):
                body = gzip.decompress(body)
            log_data   = json.loads(body)
            ct_records = log_data.get("Records", [])
        except Exception as ex:
            print(f"Failed to read {key}: {ex}")
            continue

        print(f"Processing {len(ct_records)} events from {key}")
        for ct_event in ct_records:
            alert = analyze_event(ct_event)
            if alert:
                save_alert(alert)
                alerts_created += 1

    return {"trigger": "s3", "alerts_created": alerts_created}

# ─── EventBridge path: fast path for eu-north-1 ──────────────────────────────
def handle_eventbridge_trigger(raw_event):
    """Called by EventBridge rule — handles single event, fast (under 1 min)."""
    # Unwrap EventBridge envelope: { source, detail-type, detail: {cloudtrail event} }
    if "detail" in raw_event and "eventName" not in raw_event:
        ct_event = raw_event["detail"]
        print(f"EventBridge envelope → eventName={ct_event.get('eventName')} region={ct_event.get('awsRegion')}")
    else:
        ct_event = raw_event  # direct test invoke
        print(f"Direct invoke → eventName={ct_event.get('eventName')}")

    alert = analyze_event(ct_event)
    if not alert:
        print(f"No threat: {ct_event.get('eventName')}")
        return {"trigger": "eventbridge", "threat_detected": False}

    save_alert(alert)
    return {"trigger": "eventbridge", "threat_detected": True, **alert}

# ─── Main handler ─────────────────────────────────────────────────────────────
def lambda_handler(event, context):
    print(f"Keys: {list(event.keys())}")

    # S3 trigger: { "Records": [{ "eventSource": "aws:s3", ... }] }
    records = event.get("Records", [])
    if records and records[0].get("eventSource") == "aws:s3":
        return handle_s3_trigger(event)

    # EventBridge or direct test invoke
    return handle_eventbridge_trigger(event)
