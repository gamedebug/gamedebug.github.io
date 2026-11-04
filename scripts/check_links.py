#!/usr/bin/env python3
"""Fail if any page in dist/ links to an internal page or asset that does not exist."""
import collections
import pathlib
import re
import sys
import urllib.parse

DIST = pathlib.Path(__file__).resolve().parent.parent / 'dist'
SITE = 'https://gamedebug.github.io'


def exists(ref, page):
    if ref.startswith(SITE):
        ref = ref[len(SITE):] or '/'
    u = urllib.parse.urlsplit(ref)
    if u.scheme or u.netloc or not u.path:
        return True  # external, mailto:, data:, or a bare #fragment
    path = urllib.parse.unquote(u.path)
    target = DIST / path.lstrip('/') if path.startswith('/') else page.parent / path
    return any(t.is_file() for t in (target, target / 'index.html', target.with_suffix('.html')))


def main():
    broken = collections.defaultdict(set)
    pages = sorted(DIST.rglob('*.html'))
    for page in pages:
        for ref in re.findall(r'(?:href|src)="([^"]+)"', page.read_text(encoding='utf-8', errors='replace')):
            if not exists(ref, page):
                broken[ref].add(str(page.relative_to(DIST)))
    for ref, where in sorted(broken.items()):
        print(f'BROKEN {ref}  <- {", ".join(sorted(where)[:3])}')
    print(f'{len(pages)} pages checked, {len(broken)} broken internal links')
    sys.exit(1 if broken else 0)


if __name__ == '__main__':
    main()
