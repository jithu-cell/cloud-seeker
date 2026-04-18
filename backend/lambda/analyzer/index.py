"""
Cloud Seeker — Analyzer v5 (INVOKE SPAM PERMANENTLY FIXED)
============================================================
THE INVOKE FIX:
  "Invoke" is now killed at line 1 of process_cloudtrail_record().
  Before any other logic runs, we check 3 things:
    1. Is the event name in the absolute kill list?  → SKIP
    2. Is the sourceIPAddress an AWS service domain? → SKIP
    3. Is userIdentity.type == "AWSService"?         → SKIP

  These 3 checks together make it impossible for any internal
  AWS service call to create an alert.

EMAIL RULE:
  CRITICAL + HIGH  → stored in DynamoDB + email sent
  MEDIUM + LOW     → stored in DynamoDB only (no email)
"""

import json
import gzip
import boto3
import os
import uuid
from datetime import datetime, timezone
from typing import Any

dynamodb   = boto3.resource("dynamodb")
sns_client = boto3.client("sns")
cloudwatch = boto3.client("cloudwatch")
s3_client  = boto3.client("s3")

TABLE_NAME    = os.environ.get("ALERTS_TABLE",  "cloud-seeker-alerts-prod")
SNS_TOPIC     = os.environ.get("SNS_TOPIC_ARN", "")
DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://main.d278x1qva13a0f.amplifyapp.com")

# ══════════════════════════════════════════════════════════════════════
# ABSOLUTE KILL LIST — these NEVER create alerts, period.
# Add any event name here to permanently silence it.
# ══════════════════════════════════════════════════════════════════════
NEVER_ALERT = {
    # Lambda invocations (the main spam source)
    "Invoke", "InvokeFunction", "InvokeFunction20150331",
    "InvokeApi", "InvokeHTTPS", "InvokeEndpoint",
    "InvokeWithResponseStream", "InvokeAsync",
    # SNS/SQS (internal messaging)
    "Publish", "PublishBatch",
    "SendMessage", "SendMessageBatch",
    "ReceiveMessage", "DeleteMessage", "DeleteMessageBatch",
    "ChangeMessageVisibility",
    # All read-only operations
    "Describe", "List", "Get", "Head", "Batch",  # prefix-matched below
    # Specific reads
    "AssumeRole", "AssumeRoleWithWebIdentity", "AssumeRoleWithSAML",
    "GetCallerIdentity", "GetSessionToken", "GetFederationToken",
    "ValidateTemplate", "EstimateTemplateCost",
    "LookupEvents", "GetTrailStatus", "GetEventSelectors",
    "Decrypt", "GenerateDataKey", "CreateGrant",
    "FilterLogEvents", "GetLogEvents",
}

# Prefixes that are always read-only — skip them
READ_ONLY_PREFIXES = ("Describe", "List", "Get", "Head", "BatchGet", "BatchDescribe")

# AWS service domain suffixes — calls from these are internal, not human
AWS_SERVICE_DOMAINS = (".amazonaws.com", "AWS Internal", "AWSService")


# ══════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════

def _user(event: dict) -> str:
    uid = event.get("userIdentity", {})
    if uid.get("type") == "Root":
        return "ROOT ACCOUNT"
    return (
        uid.get("userName") or
        uid.get("sessionContext", {}).get("sessionIssuer", {}).get("userName") or
        uid.get("arn", "").split("/")[-1] or
        uid.get("principalId", "").split(":")[-1] or
        uid.get("type", "unknown")
    )

def _is_internal(event: dict) -> bool:
    """True if this call was made by AWS internally, not by a human."""
    uid        = event.get("userIdentity", {})
    source_ip  = event.get("sourceIPAddress", "")
    uid_type   = uid.get("type", "")

    # Check 1: userIdentity type is AWSService
    if uid_type == "AWSService":
        return True

    # Check 2: sourceIPAddress is an AWS service endpoint
    if any(source_ip.endswith(d) or source_ip == d for d in AWS_SERVICE_DOMAINS):
        return True

    # Check 3: principal contains service role indicators
    arn = uid.get("arn", "")
    if "AWSServiceRole" in arn or "aws-service-role" in arn:
        return True

    return False

def _req(event, *keys):
    d = event.get("requestParameters") or {}
    for k in keys:
        if not isinstance(d, dict): return None
        d = d.get(k)
    return d

def _sg_reason(event):
    p  = event.get("requestParameters") or {}
    sg = p.get("groupId", "?")
    raw = json.dumps(p)
    if "0.0.0.0/0" in raw or "::/0" in raw:
        port = p.get("fromPort", "any")
        return f"Security group {sg} OPENED TO ENTIRE INTERNET (0.0.0.0/0) — port {port}"
    return f"Security group {sg} inbound rule changed by {_user(event)}"

def _bucket_reason(event):
    b = (_req(event, "bucketName") or "?")
    return f"S3 bucket '{b}' policy/access modified by {_user(event)}"


# ══════════════════════════════════════════════════════════════════════
# THREAT RULES
# ══════════════════════════════════════════════════════════════════════
EVENT_RULES = {
    # Root account
    "ConsoleLogin":                  ("CRITICAL", lambda e: f"ROOT account signed in from IP {e.get('sourceIPAddress','?')}"),

    # CloudTrail tampering
    "DeleteTrail":                   ("CRITICAL", "CloudTrail trail DELETED — monitoring disabled!"),
    "StopLogging":                   ("CRITICAL", "CloudTrail logging STOPPED — audit disabled!"),
    "UpdateTrail":                   ("MEDIUM",   lambda e: f"CloudTrail configuration changed by {_user(e)}"),

    # Security groups
    "AuthorizeSecurityGroupIngress": ("CRITICAL", _sg_reason),
    "AuthorizeSecurityGroupEgress":  ("HIGH",     _sg_reason),
    "RevokeSecurityGroupIngress":    ("MEDIUM",   lambda e: f"Security group inbound rule removed by {_user(e)} in {e.get('awsRegion','?')}"),
    "RevokeSecurityGroupEgress":     ("LOW",      lambda e: f"Security group outbound rule removed by {_user(e)}"),
    "CreateSecurityGroup":           ("LOW",      lambda e: f"New security group created by {_user(e)} in {e.get('awsRegion','?')}"),
    "DeleteSecurityGroup":           ("MEDIUM",   lambda e: f"Security group deleted by {_user(e)} in {e.get('awsRegion','?')}"),
    "ModifySecurityGroupRules":      ("HIGH",     _sg_reason),

    # IAM users
    "CreateUser":                    ("HIGH",     lambda e: f"New IAM user '{_req(e,'userName') or '?'}' created by {_user(e)}"),
    "DeleteUser":                    ("HIGH",     lambda e: f"IAM user '{_req(e,'userName') or '?'}' DELETED by {_user(e)}"),
    "CreateLoginProfile":            ("HIGH",     lambda e: f"Console password created for '{_req(e,'userName') or '?'}'"),
    "UpdateLoginProfile":            ("MEDIUM",   lambda e: f"Console password changed for '{_req(e,'userName') or '?'}' by {_user(e)}"),
    "CreateAccessKey":               ("HIGH",     lambda e: f"New access key created for '{_req(e,'userName') or _user(e)}'"),
    "DeleteAccessKey":               ("LOW",      lambda e: f"Access key deleted for '{_req(e,'userName') or '?'}'"),

    # IAM policies
    "PutUserPolicy":                 ("CRITICAL", lambda e: f"Inline policy PUT on user '{_req(e,'userName') or '?'}' by {_user(e)}"),
    "PutRolePolicy":                 ("CRITICAL", lambda e: f"Inline policy PUT on role '{_req(e,'roleName') or '?'}' by {_user(e)}"),
    "AttachUserPolicy":              ("HIGH",     lambda e: f"Policy attached to user '{_req(e,'userName') or '?'}' by {_user(e)}"),
    "AttachRolePolicy":              ("HIGH",     lambda e: f"Policy attached to role '{_req(e,'roleName') or '?'}' by {_user(e)}"),
    "DetachUserPolicy":              ("MEDIUM",   lambda e: f"Policy detached from user by {_user(e)}"),
    "DetachRolePolicy":              ("MEDIUM",   lambda e: f"Policy detached from role by {_user(e)}"),
    "CreatePolicy":                  ("MEDIUM",   lambda e: f"New IAM policy created by {_user(e)}"),
    "DeletePolicy":                  ("HIGH",     lambda e: f"IAM policy DELETED by {_user(e)}"),
    "CreateRole":                    ("LOW",      lambda e: f"New IAM role '{_req(e,'roleName') or '?'}' created by {_user(e)}"),
    "DeleteRole":                    ("HIGH",     lambda e: f"IAM role '{_req(e,'roleName') or '?'}' DELETED by {_user(e)}"),
    "UpdateAssumeRolePolicy":        ("HIGH",     lambda e: f"Role trust policy changed by {_user(e)}"),

    # MFA
    "DeactivateMFADevice":           ("CRITICAL", lambda e: f"MFA DEACTIVATED for '{_req(e,'userName') or '?'}' by {_user(e)}"),
    "DeleteVirtualMFADevice":        ("HIGH",     lambda e: f"Virtual MFA device deleted by {_user(e)}"),

    # EC2
    "RunInstances":                  ("HIGH",     lambda e: f"EC2 instance launched ({_req(e,'instanceType') or '?'}) by {_user(e)} in {e.get('awsRegion','?')}"),
    "TerminateInstances":            ("HIGH",     lambda e: f"EC2 instance(s) TERMINATED by {_user(e)} in {e.get('awsRegion','?')}"),
    "StopInstances":                 ("MEDIUM",   lambda e: f"EC2 instance(s) stopped by {_user(e)} in {e.get('awsRegion','?')}"),

    # VPC
    "CreateVpc":                     ("LOW",      lambda e: f"New VPC created by {_user(e)} in {e.get('awsRegion','?')}"),
    "DeleteVpc":                     ("HIGH",     lambda e: f"VPC DELETED by {_user(e)} in {e.get('awsRegion','?')}"),
    "AttachInternetGateway":         ("HIGH",     lambda e: f"Internet gateway attached to VPC by {_user(e)}"),
    "CreateNetworkAclEntry":         ("HIGH",     lambda e: f"Network ACL rule added by {_user(e)} in {e.get('awsRegion','?')}"),
    "ReplaceNetworkAclEntry":        ("HIGH",     lambda e: f"Network ACL rule replaced by {_user(e)}"),
    "CreateRoute":                   ("MEDIUM",   lambda e: f"Route added to route table by {_user(e)}"),

    # S3
    "CreateBucket":                  ("LOW",      lambda e: f"New S3 bucket '{_req(e,'bucketName') or '?'}' created by {_user(e)} in {e.get('awsRegion','?')}"),
    "DeleteBucket":                  ("HIGH",     lambda e: f"S3 bucket '{_req(e,'bucketName') or '?'}' DELETED by {_user(e)}"),
    "PutBucketAcl":                  ("CRITICAL", _bucket_reason),
    "PutBucketPolicy":               ("HIGH",     _bucket_reason),
    "DeleteBucketPolicy":            ("HIGH",     _bucket_reason),
    "DeletePublicAccessBlock":       ("CRITICAL", lambda e: f"S3 public access block REMOVED on '{_req(e,'bucketName') or '?'}' — bucket may become public!"),
    "PutPublicAccessBlock":          ("MEDIUM",   _bucket_reason),
    "DeleteBucketEncryption":        ("HIGH",     _bucket_reason),

    # KMS
    "DisableKey":                    ("CRITICAL", lambda e: f"KMS key DISABLED in {e.get('awsRegion','?')} by {_user(e)}"),
    "ScheduleKeyDeletion":           ("CRITICAL", lambda e: f"KMS key scheduled for DELETION by {_user(e)}"),
    "PutKeyPolicy":                  ("HIGH",     lambda e: f"KMS key policy changed by {_user(e)}"),
    "DisableKeyRotation":            ("HIGH",     lambda e: f"KMS key rotation DISABLED by {_user(e)}"),

    # RDS
    "DeleteDBInstance":              ("HIGH",     lambda e: f"RDS database DELETED in {e.get('awsRegion','?')} by {_user(e)}"),
    "DeleteDBCluster":               ("HIGH",     lambda e: f"RDS cluster DELETED in {e.get('awsRegion','?')} by {_user(e)}"),
    "CreateDBInstance":              ("MEDIUM",   lambda e: f"RDS database created in {e.get('awsRegion','?')} by {_user(e)}"),

    # CloudWatch
    "DeleteAlarms":                  ("HIGH",     lambda e: f"CloudWatch alarm(s) DELETED by {_user(e)}"),
    "DisableAlarmActions":           ("HIGH",     lambda e: f"CloudWatch alarm actions DISABLED by {_user(e)}"),

    # Config/GuardDuty
    "StopConfigurationRecorder":     ("CRITICAL", lambda e: f"AWS Config STOPPED by {_user(e)} — compliance gap!"),
    "DeleteConfigurationRecorder":   ("CRITICAL", lambda e: f"AWS Config recorder DELETED by {_user(e)}"),
    "DeleteDetector":                ("CRITICAL", lambda e: f"GuardDuty DISABLED by {_user(e)} in {e.get('awsRegion','?')}"),

    # Secrets
    "DeleteSecret":                  ("HIGH",     lambda e: f"Secret DELETED from Secrets Manager by {_user(e)}"),

    # EC2 key pairs
    "CreateKeyPair":                 ("LOW",      lambda e: f"EC2 key pair created by {_user(e)} in {e.get('awsRegion','?')}"),
    "DeleteKeyPair":                 ("LOW",      lambda e: f"EC2 key pair deleted by {_user(e)} in {e.get('awsRegion','?')}"),
    "ImportKeyPair":                 ("MEDIUM",   lambda e: f"EC2 key pair imported by {_user(e)} in {e.get('awsRegion','?')}"),
}

SEV_EMOJI = {"CRITICAL": "🚨", "HIGH": "⚠️", "MEDIUM": "🔶", "LOW": "ℹ️"}

def _resolve(rule, event):
    sev, reason = rule
    if callable(reason):
        try: return sev, reason(event)
        except: return sev, f"{event.get('eventName','?')} by {_user(event)}"
    return sev, reason


# ══════════════════════════════════════════════════════════════════════
# EMAIL (CRITICAL + HIGH only)
# ══════════════════════════════════════════════════════════════════════
def send_email(alert: dict) -> bool:
    sev = alert.get("severity", "LOW")
    if sev not in ("CRITICAL", "HIGH"):
        print(f"  📭 Email skipped — {sev} alerts don't send emails")
        return True
    if not SNS_TOPIC:
        print("❌ SNS_TOPIC_ARN not set!")
        return False
    try:
        resp = sns_client.publish(
            TopicArn=SNS_TOPIC,
            Subject=f"[Cloud Seeker {sev}] {SEV_EMOJI[sev]} {alert['event_name']}"[:100],
            Message=(
                f"{SEV_EMOJI[sev]} CLOUD SEEKER — {sev} ALERT\n"
                f"{'='*50}\n"
                f"Event   : {alert['event_name']}\n"
                f"Detail  : {alert['reason']}\n"
                f"Region  : {alert['region']}\n"
                f"User    : {alert['user']}\n"
                f"Source  : {alert['source_ip']}\n"
                f"Time    : {alert['event_time']}\n\n"
                f"Dashboard: {DASHBOARD_URL}\n"
                f"Alert ID : {alert['alert_id']}\n"
                f"{'='*50}\n"
                f"Only CRITICAL and HIGH alerts send emails.\n"
            ),
        )
        print(f"✅ Email sent: {resp['MessageId']}")
        return True
    except Exception as e:
        print(f"❌ SNS error: {e}")
        return False


# ══════════════════════════════════════════════════════════════════════
# STORE + METRIC
# ══════════════════════════════════════════════════════════════════════
def store_alert(alert: dict):
    try:
        dynamodb.Table(TABLE_NAME).put_item(Item=alert)
        print(f"✅ Stored [{alert['severity']}] {alert['event_name']} / {alert['region']}")
    except Exception as e:
        print(f"❌ DynamoDB error: {e}")

def push_metric(severity: str, region: str):
    try:
        cloudwatch.put_metric_data(
            Namespace="CloudSeeker/Security",
            MetricData=[{"MetricName": "ThreatDetected",
                         "Dimensions": [{"Name":"Severity","Value":severity},{"Name":"Region","Value":region}],
                         "Value": 1, "Unit": "Count"}]
        )
    except: pass


# ══════════════════════════════════════════════════════════════════════
# CORE: PROCESS ONE CLOUDTRAIL RECORD
# ══════════════════════════════════════════════════════════════════════
def process_record(event: dict):
    name   = event.get("eventName", "Unknown")
    source = event.get("eventSource", "unknown")
    ip     = event.get("sourceIPAddress", "unknown")
    region = event.get("awsRegion", "unknown")
    etime  = event.get("eventTime", datetime.now(timezone.utc).isoformat())
    error  = event.get("errorCode", "")

    # ══ GATE 1: Absolute kill list (Invoke, Publish, etc.) ════════════
    if name in NEVER_ALERT:
        return None

    # ══ GATE 2: Read-only prefix check ════════════════════════════════
    if any(name.startswith(p) for p in READ_ONLY_PREFIXES):
        return None

    # ══ GATE 3: AWS-internal service calls ════════════════════════════
    if _is_internal(event):
        return None

    print(f"  Evaluating: {name} | {region} | user={_user(event)}")

    # ── Access denied ──────────────────────────────────────────────────
    if error in ("UnauthorizedAccess", "AccessDenied", "Client.UnauthorizedOperation"):
        sev    = "HIGH"
        reason = f"Access DENIED for '{name}' from IP {ip}"

    # ── Known threat rules ─────────────────────────────────────────────
    elif name in EVENT_RULES:
        rule = EVENT_RULES[name]
        # ConsoleLogin: only alert for root + successful
        if name == "ConsoleLogin":
            if event.get("userIdentity", {}).get("type") != "Root":
                return None
            if event.get("responseElements", {}).get("ConsoleLogin") != "Success":
                return None
        sev, reason = _resolve(rule, event)

    # ── Generic fallback: unknown mutating events ──────────────────────
    else:
        MUTATING = ("Create","Delete","Modify","Update","Put","Attach","Enable",
                    "Disable","Terminate","Revoke","Remove","Detach","Deregister",
                    "Register","Associate","Disassociate","Reset","Import","Restore",
                    "Rotate","Launch","Stop","Start")
        if any(name.startswith(p) for p in MUTATING):
            svc    = source.replace(".amazonaws.com", "").upper()
            sev    = "LOW"
            reason = f"'{name}' performed on {svc} by {_user(event)}"
        else:
            return None

    return {
        "alert_id":     str(uuid.uuid4()),
        "event_name":   name,
        "event_source": source,
        "severity":     sev,
        "reason":       reason,
        "source_ip":    ip,
        "user":         _user(event),
        "region":       region,
        "event_time":   etime,
        "created_at":   datetime.now(timezone.utc).isoformat(),
        "status":       "OPEN",
        "ttl":          int(datetime.now(timezone.utc).timestamp()) + (90 * 24 * 3600),
    }


# ══════════════════════════════════════════════════════════════════════
# MAIN HANDLER
# ══════════════════════════════════════════════════════════════════════
def lambda_handler(raw_event: dict, context: Any) -> dict:
    print("="*60)
    print(f"Cloud Seeker Analyzer v5")
    print(f"TABLE={TABLE_NAME} | SNS={'SET' if SNS_TOPIC else '⚠️ NOT SET'}")
    print("="*60)

    records = []

    if "Records" in raw_event:
        print("Trigger: S3 (CloudTrail log file)")
        for rec in raw_event["Records"]:
            if "s3" not in rec: continue
            bucket = rec["s3"]["bucket"]["name"]
            key    = rec["s3"]["object"]["key"]
            print(f"  s3://{bucket}/{key}")
            try:
                obj  = s3_client.get_object(Bucket=bucket, Key=key)
                raw  = obj["Body"].read()
                raw  = gzip.decompress(raw) if key.endswith(".gz") else raw
                data = json.loads(raw)
                batch = data.get("Records", [])
                print(f"  {len(batch)} records in file")
                records.extend(batch)
            except Exception as e:
                print(f"  ❌ {e}")
    elif "detail" in raw_event:
        print("Trigger: EventBridge")
        records = [raw_event["detail"]]
    elif "eventName" in raw_event:
        print("Trigger: Direct test")
        records = [raw_event]
    else:
        print(f"Unknown trigger keys: {list(raw_event.keys())}")
        return {"status": "unknown", "processed": 0}

    processed = alerts = emails = 0
    for rec in records:
        processed += 1
        alert = process_record(rec)
        if alert:
            alerts += 1
            store_alert(alert)
            if send_email(alert) and alert["severity"] in ("CRITICAL","HIGH"):
                emails += 1
            push_metric(alert["severity"], alert.get("region","unknown"))

    print(f"Done: processed={processed} alerts={alerts} emails={emails}")
    return {"status":"ok","processed":processed,"alerts":alerts,"emails":emails}
