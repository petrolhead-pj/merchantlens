"""Create the exhibition budget if absent and verify its thresholds and subscribers."""
import argparse
import boto3

p = argparse.ArgumentParser()
for key in ("profile", "account", "email"):
    p.add_argument("--" + key, required=True)
args = p.parse_args()
s = boto3.Session(profile_name=args.profile, region_name="us-east-1")
assert s.client("sts").get_caller_identity()["Account"] == args.account
client = s.client("budgets")
name = "MerchantLens-Account-Monthly"
target = dict(AccountId=args.account, BudgetName=name)
alerts = [("ACTUAL", 5), ("ACTUAL", 8), ("ACTUAL", 10), ("FORECASTED", 10)]
try:
    client.describe_budget(**target)
except client.exceptions.NotFoundException:
    client.create_budget(AccountId=args.account, Budget=dict(BudgetName=name,
        BudgetLimit=dict(Amount="10", Unit="USD"), TimeUnit="MONTHLY", BudgetType="COST",
        CostTypes=dict(IncludeCredit=False)), NotificationsWithSubscribers=[
            dict(Notification=dict(NotificationType=kind, ComparisonOperator="GREATER_THAN",
                Threshold=value, ThresholdType="ABSOLUTE_VALUE"),
                Subscribers=[dict(SubscriptionType="EMAIL", Address=args.email)])
            for kind, value in alerts])
budget = client.describe_budget(**target)["Budget"]
assert budget["BudgetType"] == "COST" and budget["TimeUnit"] == "MONTHLY"
assert not budget.get("CostFilters") and not budget["CostTypes"]["IncludeCredit"]
assert float(budget["BudgetLimit"]["Amount"]) == 10 and budget["BudgetLimit"]["Unit"] == "USD"
notes = client.describe_notifications_for_budget(**target)["Notifications"]
assert {(n["NotificationType"], n["Threshold"]) for n in notes} == set(alerts)
for n in notes:
    assert n["ComparisonOperator"] == "GREATER_THAN" and n["ThresholdType"] == "ABSOLUTE_VALUE"
    query = {k:v for k,v in n.items() if k != "NotificationState"}
    subs = client.describe_subscribers_for_notification(**target, Notification=query)["Subscribers"]
    assert dict(SubscriptionType="EMAIL", Address=args.email) in subs
    print("Verified", n["NotificationType"], n["Threshold"], "USD and subscriber")
