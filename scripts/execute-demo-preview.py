"""Execute only an add-only initial MerchantLens preview in the selected account."""
import argparse
from pprint import pprint

import boto3

p = argparse.ArgumentParser()
for field in ("profile", "region", "account", "changeset"):
    p.add_argument("--" + field, required=True)
a = p.parse_args()
s = boto3.Session(profile_name=a.profile, region_name=a.region)
if s.client("sts").get_caller_identity()["Account"] != a.account:
    raise ValueError("Wrong account")
c = s.client("cloudformation")
stack = "merchantlens-exhibition"
preview = c.describe_change_set(ChangeSetName=a.changeset, StackName=stack)
if (preview["StackName"] != stack or preview["Status"] != "CREATE_COMPLETE"
        or preview["ExecutionStatus"] != "AVAILABLE" or preview.get("NextToken")):
    raise ValueError("Expected one complete, available exhibition preview")
changes = [r["ResourceChange"] for r in preview["Changes"]]
if not changes or any(r["Action"] != "Add" for r in changes):
    raise ValueError("Initial deployment must be add-only")
pprint([(r["LogicalResourceId"], r["ResourceType"]) for r in changes])
c.execute_change_set(ChangeSetName=preview["ChangeSetId"], StackName=stack)
try:
    c.get_waiter("stack_create_complete").wait(StackName=stack, WaiterConfig={"Delay":10,"MaxAttempts":120})
except Exception:
    for event in c.describe_stack_events(StackName=stack)["StackEvents"]:
        if "FAILED" in event["ResourceStatus"]:
            print(event["LogicalResourceId"], event.get("ResourceStatusReason",""))
    raise
print("CREATE_COMPLETE", c.describe_stacks(StackName=stack)["Stacks"][0]["Outputs"])
