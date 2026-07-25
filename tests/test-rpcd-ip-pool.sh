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

zt_networks="$(printf '%s\n' '{}' |
	"$zt_test_repo/root/usr/libexec/rpcd/zerotier-controller" call list_networks)"
printf '%s' "$zt_networks" | jq -e '
	.networks == [{"id":"8056c2e21c000001","name":"home_zj"}]
' >/dev/null

zt_created="$(printf '%s\n' '{"name":"lab","cidr":"10.42.7.9/24"}' |
	"$zt_test_repo/root/usr/libexec/rpcd/zerotier-controller" call create_network)"
printf '%s' "$zt_created" | jq -e '.id == "8056c2e21c000002"' >/dev/null
jq -e '
	.name == "lab" and
	.v4AssignMode.zt == true and
	.ipAssignmentPools == [{"ipRangeStart":"10.42.7.1","ipRangeEnd":"10.42.7.254"}] and
	.routes == [{"target":"10.42.7.0/24","via":null}]
' "$zt_test_payload" >/dev/null

zt_create_invalid="$(printf '%s\n' '{"name":"invalid","cidr":"10.42.7.0/31"}' |
	"$zt_test_repo/root/usr/libexec/rpcd/zerotier-controller" call create_network)"
printf '%s' "$zt_create_invalid" | jq -e '.error | contains("/8 and /30")' >/dev/null

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

zt_status="$(printf '%s\n' '{}' |
	"$zt_test_repo/root/usr/libexec/rpcd/zerotier-controller" call status)"
printf '%s' "$zt_status" | jq -e '
	(.tokenPresent | type == "boolean") and
	(.storageWritable | type == "boolean") and
	(.freeSpaceBytes | type == "number")
' >/dev/null

zt_members_online="$(printf '%s\n' '{"nwid":"8056c2e21c000001","online_only":true}' |
	"$zt_test_repo/root/usr/libexec/rpcd/zerotier-controller" call list_members)"
printf '%s' "$zt_members_online" | jq -e '
	.members != null and .peers != null
' >/dev/null

echo 'rpcd Controller tests passed'
