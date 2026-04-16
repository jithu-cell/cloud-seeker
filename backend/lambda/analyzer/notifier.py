"""
Cloud Seeker — Lambda: SNS Alert Notifier
Sends formatted security alerts via SNS (email/SMS).
"""

import json
import boto3
import os
from typing import Any

sns = boto3.client("sns")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")

SEVERITY_EMOJI = {
    "CRITICAL": "🚨",
    "HIGH":     "⚠️",
    "MEDIUM":   "🔶",
    "LOW":      "ℹ️",
}


def lambda_handler(event: dict, context: Any) -> dict:
    """
    Input: Alert dict from Step Functions (only called when threat_detected=True)
    Output: SNS message ID
    """
    if not event.get("threat_detected"):
        return {"sent": False, "reason": "No threat detected, skipping notification"}

    severity = event.get("severity", "UNKNOWN")
    emoji = SEVERITY_EMOJI.get(severity, "⚠️")

    subject = f"[{severity}] Cloud Seeker Security Alert: {event.get('event_name', 'Unknown Event')}"

    body = f"""
{emoji} CLOUD SEEKER SECURITY ALERT {emoji}
{'=' * 50}

Severity:    {severity}
Alert ID:    {event.get('alert_id', 'N/A')}
Event:       {event.get('event_name', 'N/A')}
Reason:      {event.get('reason', 'N/A')}

Details:
  • Region:     {event.get('region', 'N/A')}
  • Source IP:  {event.get('source_ip', 'N/A')}
  • User/Role:  {event.get('user', 'N/A')}
  • Time:       {event.get('event_time', 'N/A')}

Action Required:
  1. Log in to AWS Console
  2. Review CloudTrail event: {event.get('event_name')}
  3. Check the alert in Cloud Seeker dashboard
  4. Remediate if confirmed malicious

Dashboard: https://your-cloudseeker-domain.amplifyapp.com

--
Cloud Seeker | AWS Security Intelligence Platform
Alert ID: {event.get('alert_id', 'N/A')}
"""

    try:
        response = sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject[:100],
            Message=body,
            MessageAttributes={
                "severity": {
                    "DataType": "String",
                    "StringValue": severity,
                },
                "alert_id": {
                    "DataType": "String",
                    "StringValue": event.get("alert_id", "unknown"),
                },
            },
        )

        print(f"SNS notification sent: {response['MessageId']}")
        return {
            "sent": True,
            "message_id": response["MessageId"],
            "alert_id": event.get("alert_id"),
        }

    except Exception as e:
        print(f"Failed to send SNS notification: {str(e)}")
        return {"sent": False, "error": str(e)}
