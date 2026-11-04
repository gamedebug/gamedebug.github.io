#!/usr/bin/env python3
"""Check that every URL of the old site exists in the new build (or live site).

Each path in scripts/baseline/baseline.json must resolve, and post pages must
keep their exact <title>. Non-post pages (/, /posts/, ...) only need to exist.

Usage:
  python3 -I scripts/verify_urls.py                 # check dist/
  python3 -I scripts/verify_urls.py --live URL      # check a deployed site over HTTP
"""
import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent


def title_of(text):
    m = re.search(r'<title>(.*?)</title>', text, re.S)
    return html.unescape(re.sub(r'\s+', ' ', m.group(1)).strip()) if m else None


def from_dist(path):
    rel = path.strip('/')
    for f in (ROOT / 'dist' / rel / 'index.html', ROOT / 'dist' / f'{rel}.html'):
        if f.is_file():
            return 200, f.read_text(encoding='utf-8')
    return 404, ''


def from_live(base, path):
    url = base.rstrip('/') + quote(path)
    for i in range(5):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'gamedebug-verify'})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, r.read().decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            return e.code, ''
        except Exception:
            time.sleep(2 * (i + 1))
    return 'network error', ''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--live', metavar='URL')
    args = ap.parse_args()
    base = json.loads((ROOT / 'scripts/baseline/baseline.json').read_text(encoding='utf-8'))
    failures = 0
    for page in base['pages']:
        status, text = from_live(args.live, page['path']) if args.live else from_dist(page['path'])
        problem = None
        if status != 200:
            problem = f'status {status}'
        elif 'text' in page:  # a post: the title must match
            old, new = html.unescape(page['title'] or ''), title_of(text)
            if old != new:
                problem = f'title {old!r} -> {new!r}'
        if problem:
            failures += 1
            print(f'FAIL {page["path"]}: {problem}')
    total = len(base['pages'])
    print(f'{total - failures}/{total} URLs OK' + (f' on {args.live}' if args.live else ' in dist/'))
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
