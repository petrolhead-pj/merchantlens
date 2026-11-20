"""Prepare a local, single-seller Olist replay from the three original CSV files."""
import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path


def rows(folder, name, required):
    with (folder / f"olist_{name}_dataset.csv").open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        missing = set(required) - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{name}: missing columns {sorted(missing)}")
        yield from reader


def prepare(folder, seller):
    sellers = defaultdict(set)
    for row in rows(folder, "order_items", ["order_id", "seller_id"]):
        sellers[row["order_id"]].add(row["seller_id"])
    payments = {}
    counts = Counter()
    for row in rows(folder, "order_payments", ["order_id", "payment_type", "payment_value"]):
        order = row["order_id"]
        counts[order] += 1
        payments[order] = row
    eligible = defaultdict(list)
    for row in rows(folder, "orders", ["order_id", "order_purchase_timestamp", "order_delivered_customer_date"]):
        order = row["order_id"]
        if counts[order] != 1 or len(sellers[order]) != 1:
            continue
        owner = next(iter(sellers[order]))
        if not owner:
            continue
        bought = datetime.fromisoformat(row["order_purchase_timestamp"])
        delivered = row["order_delivered_customer_date"]
        if delivered and datetime.fromisoformat(delivered) < bought:
            continue
        payment = payments[order]
        eligible[owner].append(dict(id=order, purchase=bought.isoformat(sep=" "),
                                    delivery=delivered or None, method=payment["payment_type"],
                                    amount=str(Decimal(payment["payment_value"]))))
    if not eligible:
        raise ValueError("No eligible single-seller, single-payment orders")
    owner = seller or max(sorted(eligible), key=lambda key: len(eligible[key]))
    if owner not in eligible:
        raise ValueError("Requested seller has no eligible orders")
    return dict(format="merchantlens-olist-v1", seller=owner,
                inputPaymentRows=sum(counts.values()), eligibleOrders=sum(map(len, eligible.values())),
                orders=sorted(eligible[owner], key=lambda item: (item["purchase"], item["id"])))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--seller")
    parser.add_argument("--output", type=Path, default=Path("olist-replay.json"))
    args = parser.parse_args()
    try:
        data = prepare(args.folder, args.seller)
        args.output.write_text(json.dumps(data), encoding="utf-8")
        print(f"{len(data['orders'])} selected orders. Open Historical order replay and choose {args.output.resolve()}")
    except (OSError, ValueError, ArithmeticError) as error:
        sys.exit(str(error))
