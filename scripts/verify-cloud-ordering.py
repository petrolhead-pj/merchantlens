"""Verify early evidence and replay through the deployed IAM-protected HTTP API."""
import argparse
import json
import time
from datetime import datetime, timezone
from uuid import uuid4

import boto3
import requests
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

p = argparse.ArgumentParser()
for field in ("profile", "region", "stack"):
    p.add_argument("--" + field, required=True)
a = p.parse_args()
s = boto3.Session(profile_name=a.profile, region_name=a.region)
cfn = s.client("cloudformation")
outputs = cfn.describe_stacks(StackName=a.stack)["Stacks"][0]["Outputs"]
endpoint = next(o["OutputValue"] for o in outputs if o["OutputKey"] == "Endpoint")
table_name = cfn.describe_stack_resource(StackName=a.stack, LogicalResourceId="Store")["StackResourceDetail"]["PhysicalResourceId"]
table = s.resource("dynamodb").Table(table_name)
bucket = cfn.describe_stack_resource(StackName=a.stack, LogicalResourceId="Artifacts")["StackResourceDetail"]["PhysicalResourceId"]
s3 = s.client("s3")
public_block = s3.get_public_access_block(Bucket=bucket)["PublicAccessBlockConfiguration"]
assert all(public_block[k] for k in ("BlockPublicAcls","IgnorePublicAcls","BlockPublicPolicy","RestrictPublicBuckets"))
assert requests.get(endpoint, timeout=15).status_code in (401,403)
print("Verified unsigned read rejected and evidence bucket public access blocked", flush=True)
ref = str(uuid4())
payment = dict(ref=ref, payment=str(uuid4()), id=str(uuid4()), merchant="SRB-2041",
               amount=50000, currency="INR", time=datetime.now(timezone.utc).isoformat(), kind="payment")
credit = dict(payment, kind="credit", id=str(uuid4()))

def send(path, event):
    req = AWSRequest(method="POST", url=endpoint + "/" + path, data=json.dumps(event),
                     headers={"Content-Type": "application/json"})
    SigV4Auth(s.get_credentials().get_frozen_credentials(), "execute-api", a.region).add_auth(req)
    reply = requests.post(req.url, headers=dict(req.headers), data=req.data, timeout=15)
    assert reply.status_code == 202, (reply.status_code, reply.text)

def item(pk, sk):
    return table.get_item(Key={"pk":pk, "sk":sk}, ConsistentRead=True).get("Item")

def until(read):
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        value = read()
        if value:
            return value
        time.sleep(0.5)
    raise TimeoutError("Missing stored evidence for " + ref)

send("evidence", credit)
early = until(lambda: item("DEMO", ref))
assert early["pending"] == "OPEN" and early["c"]["version"] == 1
send("provider", payment)
def confirmed():
    stored = item("DEMO", ref)
    return stored if stored["c"]["version"] == 2 else None
matched = until(confirmed)
assert "pending" not in matched and matched["c"]["status"] == "Purpose mismatch — review"
send("provider", payment)
# A fresh provider event ID for the same confirmation gives a durable processing
# marker even though its transaction must leave case totals and history untouched.
alias = dict(payment, id=str(uuid4()))
send("provider", alias)
until(lambda: item("EVENT#provider", alias["id"]))
assert item("DEMO", ref) == matched
print("Confirmed evidence-first match, one payment, preserved version and duplicate history", ref)
