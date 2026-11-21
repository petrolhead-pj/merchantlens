"""Read-only service and quota checks for the selected demo profile and region."""
import argparse
from pathlib import Path
import boto3
from botocore.exceptions import ClientError

p = argparse.ArgumentParser()
p.add_argument("--profile", required=True)
p.add_argument("--region", required=True)
args = p.parse_args()
s = boto3.Session(profile_name=args.profile, region_name=args.region)
calls = [
    ("cloudformation", "validate_template", {"TemplateBody": Path("cloud/template.yaml").read_text()}),
    ("cloudformation", "describe_stacks", {"StackName": "merchantlens-exhibition"}),
    ("lambda", "get_account_settings", {}),
    ("apigatewayv2", "get_apis", {"MaxResults": "1"}),
    ("sqs", "list_queues", {"QueueNamePrefix": "merchantlens-exhibition"}),
    ("dynamodb", "list_tables", {"Limit": 1}),
    ("s3", "list_buckets", {"MaxBuckets": 1}),
    ("scheduler", "list_schedules", {"MaxResults": 1}),
    ("cloudwatch", "describe_alarms", {"MaxRecords": 1}),
    ("logs", "describe_log_groups", {"limit": 1}),
    ("iam", "list_roles", {"MaxItems": 1}),
]
for service, method, params in calls:
    try:
        result = getattr(s.client(service), method)(**params)
        print(service, method, "OK", result.get("AccountLimit", {}).get("ConcurrentExecutions", ""))
    except ClientError as error:
        print(service, method, error.response["Error"]["Code"], error.response["Error"]["Message"])
