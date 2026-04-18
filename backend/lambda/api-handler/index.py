"""
Cloud Seeker — API Handler v7
Adds /users endpoint: IAM usernames, total count, recent console logins.
"""
import json, boto3, os, logging
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Attr
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb    = boto3.resource("dynamodb")
iam_client  = boto3.client("iam")
TABLE_NAME  = os.environ.get("ALERTS_TABLE", "cloud-seeker-alerts-prod")

NEVER_SHOW = {
    "Invoke","InvokeFunction","InvokeFunction20150331",
    "InvokeApi","InvokeHTTPS","InvokeAsync","InvokeWithResponseStream",
    "Publish","PublishBatch","SendMessage","SendMessageBatch",
    "ReceiveMessage","DeleteMessage","GetObject","PutObject",
    "HeadObject","AssumeRole","AssumeRoleWithWebIdentity",
    "GetCallerIdentity","GetSessionToken",
}

def fix(obj):
    if isinstance(obj, Decimal): return int(obj) if obj%1==0 else float(obj)
    raise TypeError

def resp(code, body):
    return {
        "statusCode": code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
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

# ─── /alerts ─────────────────────────────────────────────────────────────────
def get_alerts(params):
    table  = dynamodb.Table(TABLE_NAME)
    limit  = min(int(params.get("limit", 100)), 500)
    status = params.get("status", "OPEN")

    filters = [Attr("status").eq("RESOLVED" if status=="RESOLVED" else "OPEN")]
    if params.get("severity"):
        filters.append(Attr("severity").eq(params["severity"].upper()))

    expr = filters[0]
    for f in filters[1:]: expr = expr & f
    items = _scan_all(table, FilterExpression=expr)
    items = _clean(items)
    items.sort(key=lambda x: x.get("created_at",""), reverse=True)
    for i in items: i.pop("ttl", None)
    return {"alerts": items[:limit], "count": len(items[:limit]),
            "timestamp": datetime.now(timezone.utc).isoformat()}

# ─── /stats ──────────────────────────────────────────────────────────────────
def get_stats():
    table = dynamodb.Table(TABLE_NAME)
    now   = datetime.now(timezone.utc)
    items = _clean(_scan_all(table))

    hour_ago = (now - timedelta(hours=1)).isoformat()
    day_ago  = (now - timedelta(days=1)).isoformat()

    by_sev = {"CRITICAL":0,"HIGH":0,"MEDIUM":0,"LOW":0}
    by_region = {}; by_cat = {}; by_day = {}
    open_count = last_hour = last_day = 0

    for item in items:
        sev    = item.get("severity","LOW")
        region = item.get("region","unknown")
        cat    = item.get("event_source","unknown").replace(".amazonaws.com","").upper()
        ts     = item.get("created_at", item.get("event_time",""))
        by_sev[sev]       = by_sev.get(sev,0) + 1
        by_region[region] = by_region.get(region,0) + 1
        by_cat[cat]       = by_cat.get(cat,0) + 1
        by_day[ts[:10]]   = by_day.get(ts[:10],0) + 1
        if item.get("status","OPEN") == "OPEN": open_count += 1
        if ts >= hour_ago: last_hour += 1
        if ts >= day_ago:  last_day  += 1

    return {
        "totalAlerts": len(items), "openAlerts": open_count,
        "lastHourAlerts": last_hour, "lastDayAlerts": last_day,
        "criticalAlerts": by_sev.get("CRITICAL",0), "highAlerts": by_sev.get("HIGH",0),
        "bySeverity": by_sev,
        "byRegion":   dict(sorted(by_region.items(), key=lambda x:x[1], reverse=True)),
        "byCategory": dict(sorted(by_cat.items(), key=lambda x:x[1], reverse=True)),
        "byDay":      dict(sorted(by_day.items())),
        "timestamp":  now.isoformat(),
    }

# ─── /users  (NEW in v7) ──────────────────────────────────────────────────────
def get_users():
    """
    Returns:
      - List of IAM users (name + creation date)
      - Total user count
      - Recent ConsoleLogin events from DynamoDB (already captured by CloudTrail)
    """
    # IAM users list
    users = []
    try:
        paginator = iam_client.get_paginator("list_users")
        for page in paginator.paginate():
            for u in page.get("Users", []):
                users.append({
                    "UserName":   u.get("UserName"),
                    "UserId":     u.get("UserId"),
                    "CreateDate": u.get("CreateDate","").isoformat()
                        if hasattr(u.get("CreateDate",""), "isoformat") else str(u.get("CreateDate","")),
                    "Arn":        u.get("Arn"),
                })
    except Exception as e:
        logger.warning(f"IAM list_users failed (check permissions): {e}")
        users = []

    # Recent console logins from DynamoDB (captured by our Lambda analyzer)
    table = dynamodb.Table(TABLE_NAME)
    try:
        login_items = _scan_all(table, FilterExpression=Attr("event_name").eq("ConsoleLogin"))
        login_items.sort(key=lambda x: x.get("created_at",""), reverse=True)
        recent_logins = []
        for item in login_items[:10]:
            item.pop("ttl", None)
            recent_logins.append(item)
    except Exception as e:
        logger.warning(f"Login scan failed: {e}")
        recent_logins = []

    return {
        "totalUsers":    len(users),
        "users":         users[:50],              # cap at 50
        "recentLogins":  recent_logins,
        "timestamp":     datetime.now(timezone.utc).isoformat(),
    }

# ─── /resolve ────────────────────────────────────────────────────────────────
def resolve_alert(alert_id):
    table  = dynamodb.Table(TABLE_NAME)
    result = table.scan(FilterExpression=Attr("alert_id").eq(alert_id), Limit=5)
    items  = result.get("Items", [])
    if not items: return None
    item = items[0]
    table.update_item(
        Key={"alert_id": item["alert_id"], "created_at": item["created_at"]},
        UpdateExpression="SET #s = :r, resolved_at = :t",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":r": "RESOLVED",
            ":t": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"resolved": True, "alert_id": alert_id}

# ─── Router ───────────────────────────────────────────────────────────────────
def lambda_handler(event, context):
    method = event.get("httpMethod", "GET")
    path   = event.get("path", "/")
    params = event.get("queryStringParameters") or {}
    logger.info(f"{method} {path}")

    if method == "OPTIONS": return resp(200, {})
    try:
        if path == "/alerts"   and method == "GET":  return resp(200, get_alerts(params))
        if path == "/stats"    and method == "GET":  return resp(200, get_stats())
        if path == "/users"    and method == "GET":  return resp(200, get_users())
        if path == "/health"   and method == "GET":  return resp(200, {"status":"healthy","version":"7.0.0"})
        if "/resolve" in path  and method == "POST":
            aid = path.split("/")[2] if len(path.split("/")) > 2 else ""
            r = resolve_alert(aid)
            return resp(200, r) if r else resp(404, {"error": "Not found"})
        return resp(404, {"error": f"Route not found: {path}"})
    except Exception as e:
        logger.error(str(e), exc_info=True)
        return resp(500, {"error": str(e)})
