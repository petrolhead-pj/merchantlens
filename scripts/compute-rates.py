"""Read AWS on-demand regional compute and standard gp3 base prices."""
import argparse
import json
import boto3

p=argparse.ArgumentParser()
p.add_argument("--profile", required=True)
p.add_argument("--region", required=True)
p.add_argument("types", nargs="+")
a=p.parse_args()
pricing=boto3.Session(profile_name=a.profile).client("pricing",region_name="us-east-1")
for name,filters in [(t,dict(instanceType=t,operatingSystem="Linux",tenancy="Shared",preInstalledSw="NA",capacitystatus="Used",operation="RunInstances")) for t in a.types]+[("gp3",dict(volumeApiName="gp3",productFamily="Storage"))]:
    filters["regionCode"]=a.region
    data=pricing.get_products(ServiceCode="AmazonEC2",Filters=[dict(Type="TERM_MATCH",Field=k,Value=v) for k,v in filters.items()])
    for record in data["PriceList"]:
        for term in json.loads(record)["terms"]["OnDemand"].values():
            for rate in term["priceDimensions"].values():
                print(name,rate["pricePerUnit"]["USD"],rate["unit"])
