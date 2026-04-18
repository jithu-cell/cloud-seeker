"""
Cloud Seeker — API Handler (FIXED v4)
=====================================
Endpoints:
  GET  /alerts              - list open alerts (real DynamoDB data)
  GET  /alerts?status=ALL   - list all alerts including resolved
  POST /alerts/{id}/resolve - mark alert as resolved
  GET  /stats               - summary counts for dashboard
  GET  /health              - health check
"""

import json
import boto3
import os
import logging
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Attr
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb   = boto3.resource('dynamodb')
TABLE_NAME = os.environ.get('ALERTS_TABLE', 'cloud-seeker-alerts-prod')


def decimal_fix(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError


def make_response(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Cache-Control': 'no-cache, no-store'
        },
        'body': json.dumps(body, default=decimal_fix)
    }


def get_alerts(query_params: dict) -> dict:
    table  = dynamodb.Table(TABLE_NAME)
    limit  = min(int(query_params.get('limit', 100)), 500)
    status = query_params.get('status', 'OPEN')   # OPEN | ALL | RESOLVED

    # Build filter
    filters = []
    if status == 'OPEN':
        filters.append(Attr('status').eq('OPEN'))
    elif status == 'RESOLVED':
        filters.append(Attr('status').eq('RESOLVED'))
    # status=ALL → no status filter

    sev_filter = query_params.get('severity')
    if sev_filter:
        filters.append(Attr('severity').eq(sev_filter.upper()))

    region_filter = query_params.get('region')
    if region_filter:
        filters.append(Attr('region').eq(region_filter))

    # Combine filters
    expr = None
    for f in filters:
        expr = f if expr is None else expr & f

    kwargs = {}
    if expr:
        kwargs['FilterExpression'] = expr

    result = table.scan(**kwargs)
    items  = result.get('Items', [])

    # Keep paginating if needed
    while 'LastEvaluatedKey' in result and len(items) < limit:
        kwargs['ExclusiveStartKey'] = result['LastEvaluatedKey']
        result = table.scan(**kwargs)
        items.extend(result.get('Items', []))

    # Sort newest first
    items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    items = items[:limit]

    # Remove internal fields
    for item in items:
        item.pop('ttl', None)

    return {
        'alerts':    items,
        'count':     len(items),
        'timestamp': datetime.now(timezone.utc).isoformat()
    }


def resolve_alert(alert_id: str) -> dict:
    """Mark an alert as resolved."""
    table = dynamodb.Table(TABLE_NAME)

    # Find the alert (need both hash and range key)
    result = table.scan(
        FilterExpression=Attr('alert_id').eq(alert_id),
        Limit=1
    )
    items = result.get('Items', [])
    if not items:
        return None

    item = items[0]

    # Update status to RESOLVED
    table.update_item(
        Key={
            'alert_id':  item['alert_id'],
            'created_at': item['created_at']
        },
        UpdateExpression='SET #s = :resolved, resolved_at = :ts',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={
            ':resolved': 'RESOLVED',
            ':ts': datetime.now(timezone.utc).isoformat()
        }
    )
    return {'resolved': True, 'alert_id': alert_id}


def get_stats() -> dict:
    table = dynamodb.Table(TABLE_NAME)

    # Get all alerts (DynamoDB is small in free tier, scan is fine)
    result = table.scan()
    all_items = result.get('Items', [])

    while 'LastEvaluatedKey' in result:
        result = table.scan(ExclusiveStartKey=result['LastEvaluatedKey'])
        all_items.extend(result.get('Items', []))

    now       = datetime.now(timezone.utc)
    hour_ago  = (now - timedelta(hours=1)).isoformat()
    day_ago   = (now - timedelta(days=1)).isoformat()
    week_ago  = (now - timedelta(days=7)).isoformat()

    # Aggregate
    by_sev      = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
    by_region   = {}
    by_category = {}
    by_day      = {}
    open_count  = 0
    last_hour   = 0
    last_day    = 0
    last_week   = 0

    for item in all_items:
        sev    = item.get('severity', 'LOW')
        region = item.get('region', 'unknown')
        cat    = item.get('event_source', 'unknown').replace('.amazonaws.com', '').upper()
        ts     = item.get('created_at', item.get('event_time', ''))

        by_sev[sev] = by_sev.get(sev, 0) + 1
        by_region[region]   = by_region.get(region, 0) + 1
        by_category[cat]    = by_category.get(cat, 0) + 1

        # Time bucketing
        day_key = ts[:10] if ts else 'unknown'
        by_day[day_key] = by_day.get(day_key, 0) + 1

        if item.get('status', 'OPEN') == 'OPEN':
            open_count += 1

        if ts >= hour_ago:  last_hour += 1
        if ts >= day_ago:   last_day  += 1
        if ts >= week_ago:  last_week += 1

    return {
        'totalAlerts':     len(all_items),
        'openAlerts':      open_count,
        'lastHourAlerts':  last_hour,
        'lastDayAlerts':   last_day,
        'lastWeekAlerts':  last_week,
        'criticalAlerts':  by_sev.get('CRITICAL', 0),
        'highAlerts':      by_sev.get('HIGH', 0),
        'bySeverity':      by_sev,
        'byRegion':        dict(sorted(by_region.items(), key=lambda x: x[1], reverse=True)),
        'byCategory':      dict(sorted(by_category.items(), key=lambda x: x[1], reverse=True)),
        'byDay':           dict(sorted(by_day.items())),
        'timestamp':       now.isoformat()
    }


def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    path   = event.get('path', '/')
    params = event.get('queryStringParameters') or {}

    logger.info(f"{method} {path} params={params}")

    if method == 'OPTIONS':
        return make_response(200, {})

    try:
        # GET /alerts
        if path == '/alerts' and method == 'GET':
            return make_response(200, get_alerts(params))

        # POST /alerts/{id}/resolve
        if path.startswith('/alerts/') and path.endswith('/resolve') and method == 'POST':
            alert_id = path.split('/')[2]
            result   = resolve_alert(alert_id)
            if result:
                return make_response(200, result)
            return make_response(404, {'error': 'Alert not found'})

        # GET /stats
        if path == '/stats' and method == 'GET':
            return make_response(200, get_stats())

        # GET /health
        if path == '/health':
            return make_response(200, {
                'status':    'healthy',
                'service':   'Cloud Seeker API',
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'version':   '4.0.0'
            })

        return make_response(404, {'error': f'Route not found: {method} {path}'})

    except Exception as exc:
        logger.error(f"Handler error: {exc}", exc_info=True)
        return make_response(500, {'error': 'Internal server error', 'detail': str(exc)})
