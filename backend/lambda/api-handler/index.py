"""
Cloud Seeker — API Handler v9
Adds /compliance endpoint that runs real AWS checks.
 
New route: GET /compliance
  → calls compliance_checker logic directly
  → returns real scores for all 6 frameworks
  → results cached for 5 minutes (Lambda stays warm)
"""
 
import json
import boto3
import os
import logging
import urllib.request
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Attr
from decimal import Decimal
 
try:
    from jose import jwt, JWTError
    JOSE_AVAILABLE = True
except ImportError:
    JOSE_AVAILABLE = False
 
# ── Import compliance checker (same Lambda package) ───────────────────────────
# Paste the entire compliance_checker_v2.py content here,
# OR deploy as a separate Lambda and call it via boto3.
# For simplicity we inline the run_compliance function below.
 
logger = logging.getLogger()
logger.setLevel(logging.INFO)
 
dynamodb   = boto3.resource("dynamodb")
iam_client = boto3.client("iam")
TABLE_NAME            = os.environ.get("ALERTS_TABLE",          "cloud-seeker-alerts-prod")
COGNITO_REGION        = os.environ.get("COGNITO_REGION",        "eu-north-1")
COGNITO_USER_POOL_ID  = os.environ.get("COGNITO_USER_POOL_ID",  "eu-north-1_2WmnIZkq3")
COGNITO_APP_CLIENT_ID = os.environ.get("COGNITO_APP_CLIENT_ID", "7qau0i0ce9486315dhhk148a3k")
JWKS_URL = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
_jwks_cache = None
 
# ── Compliance result cache (5 min) ──────────────────────────────────────────
_compliance_cache = None
_compliance_cache_time = None
COMPLIANCE_CACHE_SECONDS = 300  # 5 minutes
 
def _get_jwks():
    global _jwks_cache
    if _jwks_cache: return _jwks_cache
    try:
        with urllib.request.urlopen(JWKS_URL, timeout=5) as r:
            _jwks_cache = json.loads(r.read().decode())
    except Exception as e:
        logger.error(f"JWKS fetch failed: {e}")
        _jwks_cache = {"keys": []}
    return _jwks_cache
 
def verify_token(token):
    if not JOSE_AVAILABLE or not COGNITO_USER_POOL_ID or not token:
        return {}
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        jwks = _get_jwks()
        public_key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if not public_key: raise ValueError("Unknown key")
        issuer = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
        return jwt.decode(token, public_key, algorithms=["RS256"],
                          audience=COGNITO_APP_CLIENT_ID, issuer=issuer,
                          options={"verify_exp": True})
    except Exception as e:
        raise ValueError(str(e))
 
def _extract_token(event):
    headers = event.get("headers") or {}
    auth = headers.get("Authorization") or headers.get("authorization") or ""
    return auth[7:] if auth.startswith("Bearer ") else None
 
# ══════════════════════════════════════════════════════════════════════════════
# REAL COMPLIANCE CHECKS
# ══════════════════════════════════════════════════════════════════════════════
 
def _check(fn):
    try:    return fn()
    except Exception as e: return False, f"Check error: {str(e)[:60]}"
 
def chk_cloudtrail():
    ct = boto3.client("cloudtrail")
    trails = ct.describe_trails(includeShadowTrails=False).get("trailList", [])
    multi = [t for t in trails if t.get("IsMultiRegionTrail")]
    if not multi: return False, "No multi-region CloudTrail"
    status = ct.get_trail_status(Name=multi[0]["TrailARN"])
    if not status.get("IsLogging"): return False, "CloudTrail logging STOPPED"
    return True, f"Multi-region trail active: {multi[0]['Name']}"
 
def chk_root_mfa():
    iam = boto3.client("iam")
    enabled = bool(iam.get_account_summary()["SummaryMap"].get("AccountMFAEnabled", 0))
    return (True, "Root MFA enabled") if enabled else (False, "Root MFA NOT enabled — critical!")
 
def chk_root_no_keys():
    iam = boto3.client("iam")
    keys = iam.get_account_summary()["SummaryMap"].get("AccountAccessKeysPresent", 0)
    return (True, "Root has no access keys") if keys == 0 else (False, f"Root has {keys} access key(s)!")
 
def chk_password_policy():
    iam = boto3.client("iam")
    try:
        p = iam.get_account_password_policy()["PasswordPolicy"]
        issues = []
        if p.get("MinimumPasswordLength", 0) < 14: issues.append("min length <14")
        if not p.get("RequireSymbols"):             issues.append("no symbols required")
        if not p.get("RequireNumbers"):             issues.append("no numbers required")
        if not p.get("RequireUppercaseCharacters"): issues.append("no uppercase required")
        if p.get("MaxPasswordAge", 999) > 90:       issues.append("max age >90 days")
        if issues: return False, "Policy weak: " + ", ".join(issues)
        return True, f"Strong policy: {p.get('MinimumPasswordLength')}+ chars"
    except iam.exceptions.NoSuchEntityException:
        return False, "No password policy configured"
 
def chk_s3_block():
    try:
        s3c = boto3.client("s3control")
        acct = boto3.client("sts").get_caller_identity()["Account"]
        cfg = s3c.get_public_access_block(AccountId=acct)["PublicAccessBlockConfiguration"]
        if all(cfg.get(k) for k in ["BlockPublicAcls","IgnorePublicAcls","BlockPublicPolicy","RestrictPublicBuckets"]):
            return True, "S3 account public access fully blocked"
        return False, "S3 public access NOT fully blocked"
    except: return False, "Could not check S3 public access block"
 
def chk_guardduty():
    gd = boto3.client("guardduty")
    detectors = gd.list_detectors().get("DetectorIds", [])
    if not detectors: return False, "GuardDuty NOT enabled"
    det = gd.get_detector(DetectorId=detectors[0])
    if det.get("Status") != "ENABLED": return False, "GuardDuty DISABLED"
    return True, f"GuardDuty enabled"
 
def chk_cloudwatch():
    cw = boto3.client("cloudwatch")
    total = len(cw.describe_alarms()["MetricAlarms"])
    if total == 0: return False, "No CloudWatch alarms"
    return True, f"{total} CloudWatch alarm(s) configured"
 
def chk_config():
    cfg = boto3.client("config")
    recorders = cfg.describe_configuration_recorder_status().get("ConfigurationRecordersStatus", [])
    if not recorders: return False, "AWS Config not set up"
    if not any(r.get("recording") for r in recorders): return False, "Config recorder not recording"
    return True, "AWS Config is recording"
 
def chk_iam_mfa():
    iam = boto3.client("iam")
    users = []
    for page in iam.get_paginator("list_users").paginate():
        users.extend(page["Users"])
    if not users: return True, "No IAM users"
    mfa = sum(1 for u in users[:15] if iam.list_mfa_devices(UserName=u["UserName"])["MFADevices"])
    checked = min(len(users), 15)
    pct = int((mfa / checked) * 100)
    if pct == 100: return True, f"All {checked} users have MFA"
    return False, f"Only {mfa}/{checked} users have MFA ({pct}%)"
 
def chk_old_keys():
    iam = boto3.client("iam")
    users = []
    for page in iam.get_paginator("list_users").paginate():
        users.extend(page["Users"])
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    old = []
    for u in users[:15]:
        for k in iam.list_access_keys(UserName=u["UserName"])["AccessKeyMetadata"]:
            if k["Status"] == "Active":
                created = k["CreateDate"].replace(tzinfo=timezone.utc) if k["CreateDate"].tzinfo is None else k["CreateDate"]
                if created < cutoff: old.append(u["UserName"])
    if old: return False, f"{len(old)} key(s) older than 90 days"
    return True, "No access keys older than 90 days"
 
def chk_vpc_flow():
    ec2 = boto3.client("ec2")
    active = [f for f in ec2.describe_flow_logs()["FlowLogs"] if f.get("FlowLogStatus") == "ACTIVE"]
    if active: return True, f"{len(active)} VPC flow log(s) active"
    vpcs = ec2.describe_vpcs()["Vpcs"]
    return False, f"{len(vpcs)} VPC(s) but no flow logs"
 
def chk_ebs_encrypt():
    ec2 = boto3.client("ec2")
    if ec2.get_ebs_encryption_by_default().get("EbsEncryptionByDefault"):
        return True, "EBS encryption by default enabled"
    return False, "EBS encryption by default NOT enabled"
 
def chk_sns():
    topics = boto3.client("sns").list_topics().get("Topics", [])
    if topics: return True, f"{len(topics)} SNS topic(s) for alerting"
    return False, "No SNS topics configured"
 
 
# ── Framework definitions ─────────────────────────────────────────────────────
FRAMEWORKS = {
    "CIS AWS Benchmark":   {"icon":"🏛️","color":"#4F46E5","checks":[
        ("CloudTrail multi-region", chk_cloudtrail,    2),
        ("Root MFA enabled",        chk_root_mfa,      3),
        ("Root no access keys",     chk_root_no_keys,  3),
        ("Strong password policy",  chk_password_policy,2),
        ("S3 public access blocked",chk_s3_block,      2),
        ("IAM users have MFA",      chk_iam_mfa,       2),
        ("No old access keys",      chk_old_keys,      1),
    ]},
    "PCI DSS":             {"icon":"💳","color":"#F59E0B","checks":[
        ("CloudTrail logging",      chk_cloudtrail,    2),
        ("Root MFA",                chk_root_mfa,      3),
        ("S3 public access blocked",chk_s3_block,      2),
        ("EBS encryption",          chk_ebs_encrypt,   2),
        ("GuardDuty enabled",       chk_guardduty,     2),
        ("No old access keys",      chk_old_keys,      1),
        ("CloudWatch alarms",       chk_cloudwatch,    1),
    ]},
    "SOC 2":               {"icon":"✅","color":"#22C55E","checks":[
        ("CloudTrail logging",      chk_cloudtrail,    2),
        ("CloudWatch alarms",       chk_cloudwatch,    2),
        ("GuardDuty enabled",       chk_guardduty,     2),
        ("AWS Config recording",    chk_config,        2),
        ("IAM users have MFA",      chk_iam_mfa,       2),
        ("SNS alerting",            chk_sns,           1),
        ("VPC flow logs",           chk_vpc_flow,      1),
    ]},
    "HIPAA":               {"icon":"🏥","color":"#F59E0B","checks":[
        ("CloudTrail audit logs",   chk_cloudtrail,    3),
        ("EBS encryption",          chk_ebs_encrypt,   3),
        ("S3 public access blocked",chk_s3_block,      3),
        ("Root MFA",                chk_root_mfa,      2),
        ("IAM users have MFA",      chk_iam_mfa,       2),
        ("AWS Config recording",    chk_config,        2),
    ]},
    "NIST 800-53":         {"icon":"🔒","color":"#64748B","checks":[
        ("CloudTrail logging",      chk_cloudtrail,    2),
        ("Root MFA",                chk_root_mfa,      2),
        ("Strong password policy",  chk_password_policy,2),
        ("AWS Config recording",    chk_config,        2),
        ("GuardDuty enabled",       chk_guardduty,     2),
        ("VPC flow logs",           chk_vpc_flow,      2),
        ("CloudWatch alarms",       chk_cloudwatch,    1),
        ("No old access keys",      chk_old_keys,      1),
    ]},
    "AWS Well-Architected":{"icon":"☁️","color":"#6366F1","checks":[
        ("CloudTrail enabled",      chk_cloudtrail,    2),
        ("GuardDuty enabled",       chk_guardduty,     2),
        ("CloudWatch alarms",       chk_cloudwatch,    2),
        ("EBS encryption",          chk_ebs_encrypt,   2),
        ("Root no access keys",     chk_root_no_keys,  2),
        ("VPC flow logs",           chk_vpc_flow,      1),
        ("SNS alerting",            chk_sns,           1),
    ]},
}
 
def get_compliance():
    global _compliance_cache, _compliance_cache_time
    now = datetime.now(timezone.utc)
 
    # Return cached result if fresh (5 min)
    if _compliance_cache and _compliance_cache_time:
        age = (now - _compliance_cache_time).total_seconds()
        if age < COMPLIANCE_CACHE_SECONDS:
            logger.info(f"Returning cached compliance (age={int(age)}s)")
            return _compliance_cache
 
    logger.info("Running fresh compliance checks…")
    cache = {}
 
    def cached(fn):
        k = fn.__name__
        if k not in cache: cache[k] = _check(fn)
        return cache[k]
 
    results = {}
    overall_w_pass = overall_w_total = 0
 
    for fw_name, fw in FRAMEWORKS.items():
        w_pass = w_total = 0
        checks_out = []
        for name, fn, weight in fw["checks"]:
            passed, detail = cached(fn)
            checks_out.append({"name": name, "passed": passed, "detail": detail})
            w_total += weight
            if passed: w_pass += weight
 
        score = int((w_pass / w_total) * 100) if w_total else 0
        results[fw_name] = {
            "icon":   fw["icon"],
            "color":  fw["color"],
            "score":  score,
            "passed": sum(1 for c in checks_out if c["passed"]),
            "failed": sum(1 for c in checks_out if not c["passed"]),
            "total":  len(checks_out),
            "checks": checks_out,
            "status": "PASSING" if score >= 90 else "WARNING" if score >= 75 else "FAILING",
        }
        overall_w_pass  += w_pass
        overall_w_total += w_total
 
    overall = int((overall_w_pass / overall_w_total) * 100) if overall_w_total else 0
    _compliance_cache = {
        "overallScore":    overall,
        "frameworks":      results,
        "checkedAt":       now.isoformat(),
        "totalFrameworks": len(FRAMEWORKS),
        "passing":  sum(1 for v in results.values() if v["status"] == "PASSING"),
        "warning":  sum(1 for v in results.values() if v["status"] == "WARNING"),
        "failing":  sum(1 for v in results.values() if v["status"] == "FAILING"),
    }
    _compliance_cache_time = now
    return _compliance_cache
 
# ══════════════════════════════════════════════════════════════════════════════
# EXISTING HELPERS (unchanged from v8)
# ══════════════════════════════════════════════════════════════════════════════
 
NEVER_SHOW = {"Invoke","InvokeFunction","InvokeFunction20150331","InvokeApi","InvokeHTTPS",
              "InvokeAsync","InvokeWithResponseStream","Publish","PublishBatch","SendMessage",
              "SendMessageBatch","ReceiveMessage","DeleteMessage","GetObject","PutObject",
              "HeadObject","AssumeRole","AssumeRoleWithWebIdentity","GetCallerIdentity","GetSessionToken"}
 
def fix(obj):
    if isinstance(obj, Decimal): return int(obj) if obj%1==0 else float(obj)
    raise TypeError
 
def resp(code, body):
    return {
        "statusCode": code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Cache-Control": "no-cache",
        },
        "body": json.dumps(body, default=fix),
    }
 
def _clean(items):
    items = [i for i in items if i.get("event_name","") not in NEVER_SHOW]
    items = [i for i in items if i.get("user","") not in ("AWSService","AWS Internal")]
    items = [i for i in items if not str(i.get("source_ip","")).endswith(".amazonaws.com")]
    return items
 
def _scan_all(table, **kw):
    items = []
    r = table.scan(**kw)
    items.extend(r.get("Items",[]))
    while "LastEvaluatedKey" in r:
        kw["ExclusiveStartKey"] = r["LastEvaluatedKey"]
        r = table.scan(**kw)
        items.extend(r.get("Items",[]))
    return items
 
def get_alerts(params):
    table  = dynamodb.Table(TABLE_NAME)
    limit  = min(int(params.get("limit", 100)), 500)
    status = params.get("status", "OPEN")
    filters = [Attr("status").eq("RESOLVED" if status=="RESOLVED" else "OPEN")]
    if params.get("severity"):
        filters.append(Attr("severity").eq(params["severity"].upper()))
    expr = filters[0]
    for f in filters[1:]: expr = expr & f
    items = _clean(_scan_all(table, FilterExpression=expr))
    items.sort(key=lambda x: x.get("created_at",""), reverse=True)
    for i in items: i.pop("ttl", None)
    return {"alerts": items[:limit], "count": len(items[:limit]),
            "timestamp": datetime.now(timezone.utc).isoformat()}
 
def get_stats():
    table    = dynamodb.Table(TABLE_NAME)
    now      = datetime.now(timezone.utc)
    items    = _clean(_scan_all(table))
    hour_ago = (now - timedelta(hours=1)).isoformat()
    day_ago  = (now - timedelta(days=1)).isoformat()
    by_sev   = {"CRITICAL":0,"HIGH":0,"MEDIUM":0,"LOW":0}
    by_region = {}; by_cat = {}; by_day = {}
    open_count = last_hour = last_day = 0
    for item in items:
        sev = item.get("severity","LOW"); region = item.get("region","unknown")
        cat = item.get("event_source","unknown").replace(".amazonaws.com","").upper()
        ts  = item.get("created_at", item.get("event_time",""))
        by_sev[sev] = by_sev.get(sev,0)+1
        by_region[region] = by_region.get(region,0)+1
        by_cat[cat] = by_cat.get(cat,0)+1
        by_day[ts[:10]] = by_day.get(ts[:10],0)+1
        if item.get("status","OPEN") == "OPEN": open_count += 1
        if ts >= hour_ago: last_hour += 1
        if ts >= day_ago:  last_day  += 1
    return {
        "totalAlerts": len(items), "openAlerts": open_count,
        "lastHourAlerts": last_hour, "lastDayAlerts": last_day,
        "criticalAlerts": by_sev.get("CRITICAL",0), "highAlerts": by_sev.get("HIGH",0),
        "bySeverity": by_sev,
        "byRegion":   dict(sorted(by_region.items(), key=lambda x:x[1], reverse=True)),
        "byCategory": dict(sorted(by_cat.items(),    key=lambda x:x[1], reverse=True)),
        "byDay":      dict(sorted(by_day.items())),
        "timestamp":  now.isoformat(),
    }
 
def get_users():
    users = []
    try:
        for page in iam_client.get_paginator("list_users").paginate():
            for u in page.get("Users",[]):
                users.append({"UserName":u.get("UserName"),"UserId":u.get("UserId"),
                    "CreateDate":u.get("CreateDate","").isoformat() if hasattr(u.get("CreateDate",""),"isoformat") else str(u.get("CreateDate","")),
                    "Arn":u.get("Arn")})
    except Exception as e: logger.warning(f"IAM list_users: {e}")
    table = dynamodb.Table(TABLE_NAME)
    try:
        login_items = _scan_all(table, FilterExpression=Attr("event_name").eq("ConsoleLogin"))
        login_items.sort(key=lambda x: x.get("created_at",""), reverse=True)
        recent_logins = login_items[:10]
        for i in recent_logins: i.pop("ttl", None)
    except Exception as e:
        logger.warning(f"Login scan: {e}"); recent_logins = []
    return {"totalUsers":len(users),"users":users[:50],"recentLogins":recent_logins,
            "timestamp":datetime.now(timezone.utc).isoformat()}
 
def resolve_alert(alert_id):
    table  = dynamodb.Table(TABLE_NAME)
    result = table.scan(FilterExpression=Attr("alert_id").eq(alert_id), Limit=5)
    items  = result.get("Items",[])
    if not items: return None
    item = items[0]
    table.update_item(
        Key={"alert_id":item["alert_id"],"created_at":item["created_at"]},
        UpdateExpression="SET #s = :r, resolved_at = :t",
        ExpressionAttributeNames={"#s":"status"},
        ExpressionAttributeValues={":r":"RESOLVED",":t":datetime.now(timezone.utc).isoformat()},
    )
    return {"resolved":True,"alert_id":alert_id}
 
# ══════════════════════════════════════════════════════════════════════════════
# MAIN HANDLER
# ══════════════════════════════════════════════════════════════════════════════
def lambda_handler(event, context):
    method = event.get("httpMethod","GET")
    path   = event.get("path","/")
    params = event.get("queryStringParameters") or {}
    logger.info(f"{method} {path}")
 
    if method == "OPTIONS": return resp(200, {})
    if path == "/health" and method == "GET":
        return resp(200, {"status":"healthy","version":"9.0.0"})
 
    # JWT check
    token = _extract_token(event)
    try:
        verify_token(token)
    except ValueError as e:
        logger.warning(f"Auth rejected: {e}")
        return resp(401, {"error":"Unauthorized","detail":str(e)})
 
    try:
        if path == "/alerts"     and method == "GET":  return resp(200, get_alerts(params))
        if path == "/stats"      and method == "GET":  return resp(200, get_stats())
        if path == "/users"      and method == "GET":  return resp(200, get_users())
        if path == "/compliance" and method == "GET":  return resp(200, get_compliance())  # ← NEW
        if "/resolve" in path    and method == "POST":
            aid = path.split("/")[2] if len(path.split("/")) > 2 else ""
            r   = resolve_alert(aid)
            return resp(200, r) if r else resp(404, {"error":"Not found"})
        return resp(404, {"error":f"Route not found: {path}"})
    except Exception as e:
        logger.error(str(e), exc_info=True)
        return resp(500, {"error":str(e)})
  