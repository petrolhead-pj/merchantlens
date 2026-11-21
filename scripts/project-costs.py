"""Read the project's budgets, pre-tax service charges and remaining-month forecast."""
import argparse
from datetime import date, timedelta
from decimal import Decimal
from botocore.exceptions import ClientError
import boto3

p = argparse.ArgumentParser()
p.add_argument("--profile", required=True)
a = p.parse_args()
s = boto3.Session(profile_name=a.profile, region_name="us-east-1")
account = s.client("sts").get_caller_identity()["Account"]
today = date.today()
start = today.replace(day=1)
end = (start + timedelta(days=32)).replace(day=1)
print("Account", account[-4:], "period", start, end)
try:
    print("Account name", s.client("account").get_account_information().get("AccountName"))
except ClientError as e:
    print(e.response["Error"])
try:
    budgets = s.client("budgets")
    for page in budgets.get_paginator("describe_budgets").paginate(AccountId=account):
        for b in page.get("Budgets", []):
            print("Budget", b["BudgetName"], b.get("BudgetLimit"), b.get("CalculatedSpend"))
except ClientError as e:
    print(e.response["Error"])
ce = s.client("ce")
scope = {"And":[{"Dimensions":{"Key":"LINKED_ACCOUNT","Values":[account]}},
                {"Not":{"Dimensions":{"Key":"RECORD_TYPE","Values":["Credit","Tax","Refund"]}}}]}
try:
    params = dict(TimePeriod={"Start":str(start),"End":str(today)}, Granularity="MONTHLY",
                  Metrics=["UnblendedCost"], Filter=scope,
                  GroupBy=[{"Type":"DIMENSION","Key":"SERVICE"},{"Type":"DIMENSION","Key":"USAGE_TYPE"}])
    costs = []
    while True:
        r = ce.get_cost_and_usage(**params)
        costs.extend((Decimal(g["Metrics"]["UnblendedCost"]["Amount"]),g["Keys"])
                     for period in r["ResultsByTime"] for g in period["Groups"])
        if not r.get("NextPageToken"):
            break
        params["NextPageToken"] = r["NextPageToken"]
    print("Through", today-timedelta(days=1), "USD",sum(v for v,_ in costs))
    for value, keys in sorted(costs,reverse=True)[:12]:
        print(f"{value:.4f}", *keys)
except ClientError as e:
    print(e.response["Error"])
try:
    print("Remaining forecast",ce.get_cost_forecast(TimePeriod={"Start":str(today),"End":str(end)},
        Metric="UNBLENDED_COST",Granularity="MONTHLY",Filter=scope)["Total"])
except ClientError as e:
    print(e.response["Error"])
