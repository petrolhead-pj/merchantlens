"""Inspect the public AWS regional price lists for the demo's billing units."""
import json
import sys
from urllib.request import urlopen

region = sys.argv[1]
units = {
    "AmazonCloudWatch": ["MetricMonitorUsage", "AlarmMonitorUsage", "DataProcessing-Bytes"],
    "AmazonApiGateway": ["ApiGatewayHttpRequest"],
    "AmazonDynamoDB": ["ReadRequestUnits", "WriteRequestUnits"],
    "AWSLambda": ["Lambda-GB-Second", "Request"],
}
for service, suffixes in units.items():
    url = f"https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/{service}/current/{region}/index.json"
    with urlopen(url, timeout=60) as response:
        catalog = json.load(response)
    for sku, product in catalog["products"].items():
        usage = product["attributes"].get("usagetype", "")
        if usage.startswith("Global-"):
            continue
        if usage.partition("-")[2].split(":")[-1] not in suffixes:
            continue
        for term in catalog["terms"]["OnDemand"].get(sku, {}).values():
            for rate in term["priceDimensions"].values():
                if rate["beginRange"] == "0":
                    print(service, usage, rate["pricePerUnit"]["USD"], rate["unit"])
