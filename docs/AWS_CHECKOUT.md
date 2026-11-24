# MerchantLens on AWS

Use [checkout.yaml](../cloud/checkout.yaml) in the AWS account selected for the demo, in Sydney (`ap-southeast-2`). It creates a separate demo stack with CloudFront HTTPS for customer payments, a private EC2 host, and Systems Manager access for the analyst and merchant. Any existing exhibition stack and EC2 instances are outside this stack.

Two signed checkout QR codes work over mobile data. Both use simulated funds, and WhatsApp runs in preview. The stack includes a private Neptune Database for graph experiments. MerchantLens payment and case data live in SQLite on the encrypted EC2 root disk.

## Prepare a release

From a fresh checkout on the deployment laptop, use Node.js 22.16 or later and run the following in Bash or Git Bash:

```sh
npm ci
npm run setup
bash scripts/package-checkout.sh
```

The archive contains the built UI and the server modules needed for SQLite, with no credentials or local payment data. Run the deployment with AWS CloudShell in the Sydney console or with an authenticated local AWS CLI profile. For CloudShell, upload `cloud/checkout.yaml` and `.demo-tools/merchantlens-checkout.tar.gz`. For a local profile, export `AWS_PROFILE` with its name and run from the repository root.

Check the account shown by `aws sts get-caller-identity` before continuing. Use an existing private artifact bucket in the same account and region, or create one in S3 with Block Public Access and SSE-S3 encryption. Set `CHECKOUT_BUCKET` to that bucket name. In CloudShell, use `checkout.yaml` and `merchantlens-checkout.tar.gz` for the file paths below.

```sh
export AWS_REGION=ap-southeast-2
CHECKOUT_BUCKET=your-private-sydney-release-bucket
CHECKOUT_TEMPLATE=cloud/checkout.yaml
CHECKOUT_RELEASE=.demo-tools/merchantlens-checkout.tar.gz
if command -v sha256sum >/dev/null 2>&1; then
  CHECKOUT_SHA=$(sha256sum "$CHECKOUT_RELEASE" | cut -d ' ' -f 1)
else
  CHECKOUT_SHA=$(shasum -a 256 "$CHECKOUT_RELEASE" | cut -d ' ' -f 1)
fi
CHECKOUT_KEY="merchantlens/checkout/$CHECKOUT_SHA.tar.gz"
CHECKOUT_PREFIX=$(aws ec2 describe-managed-prefix-lists \
  --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
  --query 'PrefixLists[0].PrefixListId' --output text)
aws s3 cp "$CHECKOUT_RELEASE" "s3://$CHECKOUT_BUCKET/$CHECKOUT_KEY"
aws cloudformation deploy --template-file "$CHECKOUT_TEMPLATE" \
  --stack-name merchantlens-checkout --capabilities CAPABILITY_IAM \
  --parameter-overrides "ReleaseBucket=$CHECKOUT_BUCKET" "ReleaseKey=$CHECKOUT_KEY" \
    "ReleaseSha256=$CHECKOUT_SHA" "CloudFrontPrefixList=$CHECKOUT_PREFIX" EnableNeptune=true \
  --no-execute-changeset
```

Inspect the change set in the CloudFormation console before executing it. The base stack creates billable EC2, EBS and two Systems Manager interface endpoints. CloudFront and S3 can also incur usage charges. The S3 gateway endpoint does not require a NAT gateway. The default Neptune configuration uses one `db.t4g.medium` instance. Check the target account's trial eligibility before executing the change set. Set `EnableNeptune=false` if deploying the checkout without the cluster. [Neptune pricing](https://aws.amazon.com/neptune/pricing/) · [AWS PrivateLink pricing](https://aws.amazon.com/privatelink/pricing/)

## Sign in and verify

1. In CloudFormation, open the **Outputs** tab for **PublicCheckout** and **CheckoutInstanceId**. Once `PublicCheckout/phone` responds, verify that the same public hostname returns HTTP 404 for `/analyst`, `/merchant`, and their state APIs. The CloudFront domain is the public origin. The checkout server obtains it from the stack's Parameter Store entry.
2. Open an authorized Systems Manager shell on the instance to retrieve the generated logins privately with `sudo cat /var/lib/merchantlens/initial-logins.txt`. Share only the assigned login with each operator. If the app is still starting, check `sudo journalctl -u merchantlens -u cloud-final --no-pager`.
3. From the presenter laptop, with the account's AWS CLI session and Session Manager plugin, forward the private staff port. Substitute **CheckoutInstanceId** for `i-example`.

   ```sh
   aws ssm start-session --region ap-southeast-2 --target i-example \
     --document-name AWS-StartPortForwardingSession \
     --parameters '{"portNumber":["4180"],"localPortNumber":["14180"]}'
   ```

4. Sign in at [Analyst Workbench](http://127.0.0.1:14180/analyst) as `reviewer` and [Merchant Operations](http://127.0.0.1:14180/merchant) as `bakery`. Generate both codes under **Demo payment QR codes**. Turn off Wi-Fi on the phones and scan each code. Confirm the simulated cake and wallet payments. Fulfil the cake in Merchant Operations and verify that both paths update the 3D graph. Open the wallet case's report preview.
5. If enabled, use the **NeptuneEndpoint** from inside the VPC with an IAM principal authorized for Neptune data-plane calls. The checkout role has no Neptune data access.

The host bootstraps the release once. Use a fresh stack for a new demo release or back up the app data before replacing the EC2 host. The root disk and the optional Neptune data are removed when their resources are deleted. The external release bucket has its own lifecycle. This stack's isolated subnet has no internet egress. PayU and live WhatsApp need an explicitly configured egress path and service credentials.
