"""
Cloud Seeker — Lambda: API Gateway Handler
Serves the frontend dashboard with alerts, stats, compliance data.
"""

import json
import boto3
import os
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Key, Attr
from typing import Any
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
cloudwatch = boto3.client("cloudwatch")
config_client = boto3.client("config")

TABLE_NAME = os.environ.get("ALERTS_TABLE", "cloud-seeker-alerts")


# ─── Response Helpers ─────────────────────────────────────────────────────────

def cors_response(status_code: int, body: Any) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body, default=decimal_default),
    }


def decimal_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError


# ─── Route Handlers ──────────────────────────────────────────────────────────

def get_alerts(query_params: dict) -> dict:
    """GET /alerts — returns recent security alerts"""
    table = dynamodb.Table(TABLE_NAME)

    severity_filter = query_params.get("severity")
    limit = int(query_params.get("limit", 50))
    status = query_params.get("status", "OPEN")

    scan_kwargs = {
        "FilterExpression": Attr("status").eq(status),
        "Limit": min(limit, 200),
    }
    if severity_filter:
        scan_kwargs["FilterExpression"] = (
            Attr("status").eq(status) & Attr("severity").eq(severity_filter)
        )

    result = table.scan(**scan_kwargs)
    items = result.get("Items", [])

    # Sort by created_at descending
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return cors_response(200, {
        "alerts": items,
        "count": len(items),
    })


def get_stats() -> dict:
    """GET /stats — returns dashboard KPI stats"""
    table = dynamodb.Table(TABLE_NAME)

    now = datetime.now(timezone.utc)
    last_24h = (now - timedelta(hours=24)).isoformat()

    result = table.scan(
        FilterExpression=Attr("created_at").gte(last_24h)
    )
    alerts = result.get("Items", [])

    by_severity = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for alert in alerts:
        sev = alert.get("severity", "LOW")
        by_severity[sev] = by_severity.get(sev, 0) + 1

    # CloudWatch metrics: total events in last hour
    cw_response = cloudwatch.get_metric_statistics(
        Namespace="CloudSeeker/Security",
        MetricName="ThreatDetected",
        StartTime=now - timedelta(hours=1),
        EndTime=now,
        Period=3600,
        Statistics=["Sum"],
    )
    threats_last_hour = int(
        sum(dp["Sum"] for dp in cw_response.get("Datapoints", []))
    )

    return cors_response(200, {
        "total_alerts_24h": len(alerts),
        "by_severity": by_severity,
        "threats_last_hour": threats_last_hour,
        "open_critical": by_severity["CRITICAL"],
    })


def get_compliance() -> dict:
    """GET /compliance — AWS Config compliance summary"""
    try:
        response = config_client.describe_compliance_by_config_rule(
            ComplianceTypes=["COMPLIANT", "NON_COMPLIANT"]
        )
        rules = response.get("ComplianceByConfigRules", [])

        compliant = sum(
            1 for r in rules
            if r.get("Compliance", {}).get("ComplianceType") == "COMPLIANT"
        )
        non_compliant = sum(
            1 for r in rules
            if r.get("Compliance", {}).get("ComplianceType") == "NON_COMPLIANT"
        )
        total = compliant + non_compliant
        score = int((compliant / total * 100)) if total > 0 else 0

        return cors_response(200, {
            "score": score,
            "compliant_rules": compliant,
            "non_compliant_rules": non_compliant,
            "total_rules": total,
            "rules": [
                {
                    "name": r.get("ConfigRuleName"),
                    "status": r.get("Compliance", {}).get("ComplianceType"),
                }
                for r in rules[:20]
            ],
        })
    except Exception as e:
        print(f"Config error: {e}")
        return cors_response(200, {
            "score": 0, "error": "Config not enabled or insufficient permissions"
        })


def resolve_alert(alert_id: str) -> dict:
    """POST /alerts/{id}/resolve"""
    table = dynamodb.Table(TABLE_NAME)
    table.update_item(
        Key={"alert_id": alert_id},
        UpdateExpression="SET #s = :val, resolved_at = :ts",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":val": "RESOLVED",
            ":ts": datetime.now(timezone.utc).isoformat(),
        },
    )
    return cors_response(200, {"alert_id": alert_id, "status": "RESOLVED"})


# ─── Main Handler ─────────────────────────────────────────────────────────────

def lambda_handler(event: dict, context: Any) -> dict:
    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    query = event.get("queryStringParameters") or {}
    path_params = event.get("pathParameters") or {}

    print(f"{method} {path}")

    if method == "OPTIONS":
        return cors_response(200, {})

    if path == "/stats" and method == "GET":
        return get_stats()

    if path == "/alerts" and method == "GET":
        return get_alerts(query)

    if path == "/compliance" and method == "GET":
        return get_compliance()

    if "/resolve" in path and method == "POST":
        alert_id = path_params.get("id")
        if alert_id:
            return resolve_alert(alert_id)

    return cors_response(404, {"error": "Route not found"})
