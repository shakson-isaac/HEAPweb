#!/usr/bin/env bash
# GitHub API access, from the credential git already uses.
#
# Pushes work because ~/.git-credentials holds a token for github.com, but
# nothing exports it, so API calls (opening a PR, reading Dependabot alerts,
# watching a workflow run) looked unavailable and were done by hand instead.
# This reads that same file at call time. It does NOT copy the token anywhere:
# no new file, no shell history, no environment left behind after the shell
# exits. The credential keeps its single home at mode 600.
#
#   source tools/gh_env.sh            # exports GH_TOKEN for this shell
#   source tools/gh_env.sh --check    # report identity and scopes, export nothing
#   gh_api /repos/:owner/:repo/pulls  # GET helper
#
# `gh` the CLI is not installed on O2 and the npm registry is not reachable
# from every node, so these are plain curl calls.

_gh_read_token() {
  local f="$HOME/.git-credentials"
  [ -r "$f" ] || { echo "gh_env: no $f" >&2; return 1; }
  local line
  line=$(grep -m1 'github\.com' "$f") || { echo "gh_env: no github.com entry in $f" >&2; return 1; }
  printf '%s' "$line" | sed -E 's#^https?://[^:]*:([^@]*)@.*#\1#'
}

if [ "${1:-}" = "--check" ]; then
  _tok=$(_gh_read_token) || return 1 2>/dev/null || exit 1
  _hdr=$(curl -s -D - -o /tmp/.gh_me.$$ -H "Authorization: Bearer $_tok" https://api.github.com/user)
  echo "GitHub credential"
  echo "  source : ~/.git-credentials (mode $(stat -c %a "$HOME/.git-credentials"))"
  echo "  status : $(printf '%s' "$_hdr" | head -1 | tr -d '\r')"
  echo "  user   : $(python3 -c "import json;print(json.load(open('/tmp/.gh_me.$$')).get('login','?'))" 2>/dev/null)"
  echo "  scopes : $(printf '%s' "$_hdr" | grep -i '^x-oauth-scopes:' | cut -d' ' -f2- | tr -d '\r')"
  rm -f "/tmp/.gh_me.$$"
  unset _tok _hdr
else
  GH_TOKEN=$(_gh_read_token) && export GH_TOKEN
fi

# GET any API path. Usage: gh_api /repos/shakson-isaac/HEAPweb/pulls
gh_api() {
  local p="$1"; shift || true
  curl -s -H "Authorization: Bearer ${GH_TOKEN:-$(_gh_read_token)}" \
       -H "Accept: application/vnd.github+json" \
       "https://api.github.com${p}" "$@"
}
