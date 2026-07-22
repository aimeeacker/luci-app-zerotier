#!/bin/sh
set -eu

zt_test_repo="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
zt_test_dir="$(mktemp -d /tmp/zerotier-controller-test.XXXXXX)"
zt_test_bin="$zt_test_dir/bin"
zt_test_payload="$zt_test_dir/payload.json"
mkdir -p "$zt_test_bin"
trap 'rm -rf "$zt_test_dir"' EXIT
ln -s "$zt_test_repo/tests/fixtures/mock-curl" "$zt_test_bin/curl"

export PATH="$zt_test_bin:$PATH"
export ZT_CONTROLLER_TOKEN=test-token
export ZT_TEST_PAYLOAD="$zt_test_payload"

zt_result="$(printf '%s\n' '{"nwid":"8056c2e21c000001","cidr":"10.16.0.1/24","old_cidr":"10.10.10.0/24"}' |
	"$zt_test_repo/root/usr/libexec/rpcd/zerotier-controller" call update_ip_pool)"

printf '%s' "$zt_result" | jq -e '
	.cidr == "10.16.0.0/24" and
	.ipRangeStart == "10.16.0.1" and
	.ipRangeEnd == "10.16.0.254"
' >/dev/null

jq -e '
	.v4AssignMode.zt == true and
	.ipAssignmentPools == [{"ipRangeStart":"10.16.0.1","ipRangeEnd":"10.16.0.254"}] and
	([.routes[] | select(.target == "10.10.10.0/24")] | length) == 0 and
	([.routes[] | select(.target == "10.16.0.0/24" and .via == null)] | length) == 1 and
	([.routes[] | select(.target == "192.168.50.0/24" and .via == "10.10.10.1")] | length) == 1 and
	([.routes[] | select(.target == "10.200.0.0/16" and .via == null)] | length) == 1
' "$zt_test_payload" >/dev/null

zt_invalid="$(printf '%s\n' '{"nwid":"8056c2e21c000001","cidr":"10.16.0.1/31","old_cidr":""}' |
	"$zt_test_repo/root/usr/libexec/rpcd/zerotier-controller" call update_ip_pool)"
printf '%s' "$zt_invalid" | jq -e '.error | contains("/8 and /30")' >/dev/null

echo 'rpcd IP pool tests passed'
