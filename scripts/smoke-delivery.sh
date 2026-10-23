#!/usr/bin/env bash
# Delivery smoke checks (contracts/http-delivery.md, quickstart §7).
# Usage: scripts/smoke-delivery.sh <base-url>   e.g. https://fretboard-master-5o7.pages.dev
set -u

if [ $# -ne 1 ]; then
  echo "usage: $0 <base-url>" >&2
  exit 2
fi

base="${1%/}"
host="${base#*://}"
fails=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; fails=$((fails + 1)); }

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

# http -> https redirect, same path
http_base="http://${host}"
code=$(status "${http_base}/about")
loc=$(curl -s -o /dev/null -w '%{redirect_url}' "${http_base}/about")
if { [ "$code" = 301 ] || [ "$code" = 308 ]; } && [ "$loc" = "https://${host}/about" ]; then
  pass "http redirects to https ($code -> $loc)"
else
  fail "http redirect: status $code, location '$loc'"
fi

# HSTS
if curl -sI "${base}/" | tr -d '\r' | grep -qi '^strict-transport-security:'; then
  pass "strict-transport-security header present"
else
  fail "strict-transport-security header missing"
fi

# screens
for p in / /notes /triads /about; do
  code=$(status "${base}${p}")
  [ "$code" = 200 ] && pass "$p -> 200" || fail "$p -> $code (expected 200)"
done

# trailing slash: 308 to no-slash, or 200
code=$(status "${base}/triads/")
loc=$(curl -s -o /dev/null -w '%{redirect_url}' "${base}/triads/")
if [ "$code" = 200 ] || { [ "$code" = 308 ] && [ "$loc" = "${base}/triads" ]; }; then
  pass "/triads/ -> $code"
else
  fail "/triads/ -> $code, location '$loc'"
fi

# unknown path: 404 with notice
body=$(mktemp)
code=$(curl -s -o "$body" -w '%{http_code}' "${base}/nope")
if [ "$code" = 404 ] && grep -q "We could not find that page" "$body"; then
  pass "/nope -> 404 with notice"
else
  fail "/nope -> $code or notice missing"
fi
rm -f "$body"

code=$(status "${base}/caged")
[ "$code" = 404 ] && pass "/caged -> 404" || fail "/caged -> $code (expected 404)"

# case sensitivity: 404 or home-with-notice
body=$(mktemp)
code=$(curl -s -o "$body" -w '%{http_code}' "${base}/Triads")
if [ "$code" = 404 ] || { [ "$code" = 200 ] && grep -q "We could not find that page" "$body"; }; then
  pass "/Triads -> $code"
else
  fail "/Triads -> $code (expected 404 or home with notice)"
fi
rm -f "$body"

if [ "$fails" -gt 0 ]; then
  echo "$fails check(s) failed"
  exit 1
fi
echo "all delivery checks passed"
