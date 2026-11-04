#!/usr/bin/env python3
"""Compare every post in dist/ with the live-site baseline.

For each of the 84 posts: body text similarity and the number of headings,
code blocks, tables, images, lists and blockquotes. Prints the posts that
differ; exits non-zero if any post is missing or below the threshold.

Usage: python3 -I scripts/verify_content.py [--threshold 0.99] [--show slug]
"""
import argparse
import difflib
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts' / 'baseline'))
from export_baseline import Body  # noqa: E402

# kramdown and remark/smartypants render quotes and dashes differently;
# fold them so only real content differences count.
FOLD = str.maketrans({'“': '"', '”': '"', '‘': "'", '’': "'", '–': '-', '—': '-', '…': '...'})


def tokens(text):
    text = unicodedata.normalize('NFKC', text).translate(FOLD)
    text = text.replace('---', '-').replace('--', '-')
    return re.findall(r'[A-Za-z0-9_]+|[^\sA-Za-z0-9_]', text)


def new_page(path):
    html = (ROOT / 'dist' / path.strip('/') / 'index.html').read_text(encoding='utf-8')
    m = re.search(r'<article id="post-body">(.*)</article>', html, re.S)
    p = Body()
    p.feed(m.group(1))
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--threshold', type=float, default=0.99)
    ap.add_argument('--show', help='print a diff of one slug')
    args = ap.parse_args()
    base = json.loads((ROOT / 'scripts/baseline/baseline.json').read_text(encoding='utf-8'))
    posts = [p for p in base['pages'] if 'text' in p]
    bad = 0
    for old in posts:
        slug = old['path'].strip('/')
        try:
            new = new_page(old['path'])
        except FileNotFoundError:
            print(f'MISSING  {slug}')
            bad += 1
            continue
        a, b = tokens(old['text']), tokens(' '.join(new.text))
        ratio = difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()
        keys = ('pre', 'table', 'img', 'ul', 'ol', 'blockquote')
        diffs = {k: (old['counts'].get(k, 0), new.counts.get(k, 0)) for k in keys
                 if old['counts'].get(k, 0) != new.counts.get(k, 0)}
        nh_old, nh_new = len(old['headings']), len(new.headings)
        if nh_old != nh_new:
            diffs['headings'] = (nh_old, nh_new)
        if ratio < args.threshold or diffs:
            bad += ratio < args.threshold
            shown = ', '.join(f'{k} {o}->{n}' for k, (o, n) in diffs.items())
            print(f'{ratio:.4f}  {slug}  {shown}')
        if args.show == slug:
            for op in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
                if op[0] != 'equal':
                    print(f"  {op[0]}: {''.join(a[op[1]:op[2]])[:120]!r} -> {''.join(b[op[3]:op[4]])[:120]!r}")
    print(f'{len(posts)} posts checked, {bad} below {args.threshold} or missing')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
