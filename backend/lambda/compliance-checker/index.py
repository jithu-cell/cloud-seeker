"""
Cloud Seeker — Lambda: Compliance Checker
Evaluates AWS Config rules and checks custom security policies.
"""

import json
import boto3
import os
from typing import Any
from datetime import datetime, timezone

config_client = boto3.client("config")
dynamodb = boto3.resource("dynamodb")
cloudwatch = boto3.client("cloudwatch")

TABLE_NAME = os.environ.get("ALERTS_TABLE", "cloud-seeker-alerts")

# Custom compliance rules (supplement AWS Config)
CUSTOM_RULES = [
    {
        "name": "cloudtrail-enabled",
        "description": "CloudTrail must be enabled in all regions",
        "check": lambda: _check_cloudtrail_enabled(),
    },
    {
        "name": "root-mfa-enabled",
        "description": "MFA must be enabled for root account",
        "check": lambda: _check_root_mfa(),
    },
    {
        "name": "password-policy-strong",
        "description": "IAM password policy must require 14+ characters",
        "check": lambda: _check_password_policy(),
    },
]


def _check_cloudtrail_enabled() -> dict:
    ct = boto3.client("cloudtrail")
    trails = ct.describe_trails(includeShadowTrails=False).get("trailList", [])
    if trails and any(t.get("IsMultiRegionTrail") for t in trails):
        return {"compliant": True, "detail": f"{len(trails)} trail(s) active"}
    return {"compliant": False, "detail": "No multi-region CloudTrail found"}


def _check_root_mfa() -> dict:
    iam = boto3.client("iam")
    summary = iam.get_account_summary()["SummaryMap"]
    root_mfa = summary.get("AccountMFAEnabled", 0)
    return {
        "compliant": bool(root_mfa),
        "detail": "Root MFA enabled" if root_mfa else "Root MFA NOT enabled — HIGH RISK",
    }


def _check_password_policy() -> dict:
    iam = boto3.client("iam")
    try:
        policy = iam.get_account_password_policy()["PasswordPolicy"]
        min_length = policy.get("MinimumPasswordLength", 0)
        requires_symbols = policy.get("RequireSymbols", False)
        requires_numbers = policy.get("RequireNumbers", False)
        compliant = min_length >= 14 and requires_symbols and requires_numbers
        return {
            "compliant": compliant,
            "detail": f"Min length: {min_length}, Symbols: {requires_symbols}, Numbers: {requires_numbers}",
        }
    except iam.exceptions.NoSuchEntityException:
        return {"compliant": False, "detail": "No IAM password policy set"}


def lambda_handler(event: dict, context: Any) -> dict:
    """
    Runs compliance checks and stores results.
    Called periodically by EventBridge Scheduler.
    """
    print("Starting compliance check run...")

    results = []
    failed_checks = 0

    for rule in CUSTOM_RULES:
        try:
            check_result = rule["check"]()
            results.append({
                "rule": rule["name"],
                "description": rule["description"],
                "compliant": check_result["compliant"],
                "detail": check_result.get("detail", ""),
            })
            if not check_result["compliant"]:
                failed_checks += 1
        except Exception as e:
            print(f"Rule {rule['name']} check failed: {e}")
            results.append({
                "rule": rule["name"],
                "compliant": False,
                "detail": f"Check error: {str(e)}",
            })
            failed_checks += 1

    total = len(results)
    passed = total - failed_checks
    score = int((passed / total) * 100) if total > 0 else 0

    # Publish compliance score metric
    cloudwatch.put_metric_data(
        Namespace="CloudSeeker/Compliance",
        MetricData=[
            {
                "MetricName": "ComplianceScore",
                "Value": score,
                "Unit": "Percent",
                "Timestamp": datetime.now(timezone.utc),
            }
        ],
    )

    print(f"Compliance check complete: {score}% ({passed}/{total} rules passed)")
    return {
        "score": score,
        "passed": passed,
        "failed": failed_checks,
        "total": total,
        "results": results,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
