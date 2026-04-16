"""
Cloud Seeker — Lambda Unit Tests
Run: pytest tests/ -v
"""

import sys
import os
import json
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../lambda/analyzer"))


# ─── Fixtures ────────────────────────────────────────────────────────────────

def make_cloudtrail_event(event_name, **kwargs):
    return {
        "eventName": event_name,
        "eventSource": "signin.amazonaws.com",
        "sourceIPAddress": "1.2.3.4",
        "awsRegion": "us-east-1",
        "eventTime": "2024-01-15T10:30:00Z",
        "userIdentity": kwargs.get("userIdentity", {"type": "IAMUser", "userName": "test-user"}),
        "requestParameters": kwargs.get("requestParameters", {}),
    }


# ─── Analyzer Tests ──────────────────────────────────────────────────────────

class TestThreatDetection:

    @patch("index.dynamodb")
    @patch("index.cloudwatch")
    def test_root_login_detected(self, mock_cw, mock_ddb):
        from index import lambda_handler

        mock_table = MagicMock()
        mock_ddb.Table.return_value = mock_table
        mock_cw.put_metric_data.return_value = {}

        event = make_cloudtrail_event(
            "ConsoleLogin",
            userIdentity={"type": "Root", "arn": "arn:aws:iam::123456789:root"}
        )

        result = lambda_handler(event, None)

        assert result["threat_detected"] is True
        assert result["severity"] == "CRITICAL"
        assert "Root" in result["reason"]
        mock_table.put_item.assert_called_once()

    @patch("index.dynamodb")
    @patch("index.cloudwatch")
    def test_open_security_group_detected(self, mock_cw, mock_ddb):
        from index import lambda_handler

        mock_table = MagicMock()
        mock_ddb.Table.return_value = mock_table
        mock_cw.put_metric_data.return_value = {}

        event = make_cloudtrail_event(
            "AuthorizeSecurityGroupIngress",
            requestParameters={
                "ipPermissions": {"items": [{"ipRanges": {"items": [{"cidrIp": "0.0.0.0/0"}]}}]},
                "fromPort": 22,
                "toPort": 22,
            }
        )

        result = lambda_handler(event, None)

        assert result["threat_detected"] is True
        assert result["severity"] == "CRITICAL"

    @patch("index.dynamodb")
    @patch("index.cloudwatch")
    def test_normal_event_no_alert(self, mock_cw, mock_ddb):
        from index import lambda_handler

        event = make_cloudtrail_event("DescribeInstances")
        result = lambda_handler(event, None)

        assert result["threat_detected"] is False
        mock_ddb.Table.assert_not_called()

    @patch("index.dynamodb")
    @patch("index.cloudwatch")
    def test_delete_trail_detected(self, mock_cw, mock_ddb):
        from index import lambda_handler

        mock_table = MagicMock()
        mock_ddb.Table.return_value = mock_table
        mock_cw.put_metric_data.return_value = {}

        event = make_cloudtrail_event("DeleteTrail")
        result = lambda_handler(event, None)

        assert result["threat_detected"] is True
        assert "CloudTrail" in result["reason"]

    @patch("index.dynamodb")
    @patch("index.cloudwatch")
    def test_alert_stored_in_dynamodb(self, mock_cw, mock_ddb):
        from index import lambda_handler

        mock_table = MagicMock()
        mock_ddb.Table.return_value = mock_table
        mock_cw.put_metric_data.return_value = {}

        event = make_cloudtrail_event("DeleteTrail")
        result = lambda_handler(event, None)

        # Verify DynamoDB put_item was called with correct fields
        call_args = mock_table.put_item.call_args[1]["Item"]
        assert "alert_id" in call_args
        assert "severity" in call_args
        assert "created_at" in call_args
        assert "status" in call_args
        assert call_args["status"] == "OPEN"
        assert "ttl" in call_args  # TTL set for auto-expiry

    @patch("index.dynamodb")
    @patch("index.cloudwatch")
    def test_cloudwatch_metric_published(self, mock_cw, mock_ddb):
        from index import lambda_handler

        mock_table = MagicMock()
        mock_ddb.Table.return_value = mock_table
        mock_cw.put_metric_data.return_value = {}

        event = make_cloudtrail_event("DeleteTrail")
        lambda_handler(event, None)

        mock_cw.put_metric_data.assert_called_once()
        call_args = mock_cw.put_metric_data.call_args[1]
        assert call_args["Namespace"] == "CloudSeeker/Security"

    def test_iam_user_login_not_flagged(self):
        from index import _check_root_login

        event = make_cloudtrail_event(
            "ConsoleLogin",
            userIdentity={"type": "IAMUser", "userName": "alice"}
        )
        result = _check_root_login(event)
        assert result["threat"] is False

    def test_public_bucket_acl_detected(self):
        from index import _check_public_bucket

        event = make_cloudtrail_event(
            "PutBucketAcl",
            requestParameters={"bucketName": "my-bucket", "AccessControl": "public-read"}
        )
        result = _check_public_bucket(event)
        assert result["threat"] is True
        assert "my-bucket" in result["reason"]


# ─── API Handler Tests ────────────────────────────────────────────────────────

class TestAPIHandler:

    def test_options_cors(self):
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../lambda/api-handler"))
        from index import lambda_handler

        event = {"httpMethod": "OPTIONS", "path": "/alerts", "queryStringParameters": None, "pathParameters": None}
        result = lambda_handler(event, None)

        assert result["statusCode"] == 200
        assert "Access-Control-Allow-Origin" in result["headers"]

    def test_unknown_route_404(self):
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../lambda/api-handler"))
        from index import lambda_handler

        event = {"httpMethod": "GET", "path": "/nonexistent", "queryStringParameters": None, "pathParameters": None}
        result = lambda_handler(event, None)

        assert result["statusCode"] == 404
