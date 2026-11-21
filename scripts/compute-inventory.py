"""Read-only regional inventory for the exhibition cost assessment."""
import argparse
import json
from concurrent.futures import ThreadPoolExecutor
import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

p = argparse.ArgumentParser()
p.add_argument("--profile", required=True)
p.add_argument("--region", required=True)
args = p.parse_args()
s = boto3.Session(profile_name=args.profile, region_name=args.region)
print("Account", s.client("sts").get_caller_identity()["Account"][-4:], flush=True)
regions = sorted(r["RegionName"] for r in s.client("ec2").describe_regions()["Regions"])
print("Enabled regions", regions, flush=True)

def inspect(region):
    session = boto3.Session(profile_name=args.profile, region_name=region)
    cfg = Config(connect_timeout=5, read_timeout=15, retries={"total_max_attempts":2})
    ec2 = session.client("ec2", config=cfg)
    def rows(client, op, key, **kwargs):
        if client.can_paginate(op):
            pages = client.get_paginator(op).paginate(**kwargs)
        else:
            pages = [getattr(client,op)(**kwargs)]
        return [r for page in pages for r in page.get(key,[])]
    result = {}
    def collect(label, client, op, key, fields, **kwargs):
        try:
            items = rows(client,op,key,**kwargs)
            if op == "describe_instances":
                items = [i for r in items for i in r["Instances"]]
            if items:
                result[label] = [{k:r[k] for k in fields if k in r} for r in items]
        except (BotoCoreError,ClientError) as e:
            result.setdefault("errors",{})[label] = getattr(e,"response",{}).get("Error",{}).get("Code",type(e).__name__)
    collect("instances",ec2,"describe_instances","Reservations",["InstanceId","InstanceType","State","LaunchTime","PlatformDetails","InstanceLifecycle","PublicIpAddress","VpcId","BlockDeviceMappings"])
    collect("volumes",ec2,"describe_volumes","Volumes",["VolumeId","Size","VolumeType","Iops","Throughput","Attachments","CreateTime"])
    collect("snapshots",ec2,"describe_snapshots","Snapshots",["SnapshotId","VolumeSize","StartTime"],OwnerIds=["self"])
    collect("elastic_ips",ec2,"describe_addresses","Addresses",["AllocationId","PublicIp","InstanceId","NetworkInterfaceId"])
    collect("interfaces",ec2,"describe_network_interfaces","NetworkInterfaces",["NetworkInterfaceId","InterfaceType","Association","Description","Status"])
    collect("nat",ec2,"describe_nat_gateways","NatGateways",["NatGatewayId","State","CreateTime"])
    collect("endpoints",ec2,"describe_vpc_endpoints","VpcEndpoints",["VpcEndpointId","VpcEndpointType","State","SubnetIds"])
    collect("vpn",ec2,"describe_vpn_connections","VpnConnections",["VpnConnectionId","State"])
    collect("transit",ec2,"describe_transit_gateway_attachments","TransitGatewayAttachments",["TransitGatewayAttachmentId","State"])
    for svc,key,fields in [("elbv2","LoadBalancers",["LoadBalancerName","Type","Scheme"]),("elb","LoadBalancerDescriptions",["LoadBalancerName","Scheme"])]:
        collect(svc,session.client(svc,config=cfg),"describe_load_balancers",key,fields)
    return region,result

with ThreadPoolExecutor(max_workers=6) as pool:
    for region,result in pool.map(inspect,regions):
        print(region,json.dumps(result,default=str),flush=True)
