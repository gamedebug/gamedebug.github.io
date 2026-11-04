#!/usr/bin/env python3
"""Export a baseline of the live Jekyll site for the Astro migration.

For every URL in the live sitemap, record the HTTP status, <title>, and for
article pages the headings, element counts and plain text of the post body.
The new site is later checked against this file (scripts/verify-urls).

Usage: python3 scripts/baseline/export_baseline.py [out.json]
"""
import json
import re
import sys
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

SITE = 'https://gamedebug.github.io'
UA = 'Mozilla/5.0 (X11; Linux x86_64) gamedebug-baseline'
# The post body sits between the back button and the tag/share footer.
BODY_START = 'fa-chevron-left"></i> </a> </div>'
BODY_END = '<div class="entry-meta">'


def fetch(url, tries=6):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, r.read().decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode('utf-8', 'replace')
        except Exception:
            time.sleep(2 * (i + 1))
    raise RuntimeError(f'failed to fetch {url}')


class Body(HTMLParser):
    """Collect plain text, headings and element counts of a post body."""
    SKIP = {'script', 'style'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text, self.headings, self.counts = [], [], {}
        self._skip = 0
        self._heading = None

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip += 1
        if tag in ('pre', 'table', 'img', 'ul', 'ol', 'blockquote'):
            self.counts[tag] = self.counts.get(tag, 0) + 1
        if re.fullmatch(r'h[1-6]', tag):
            self._heading = [tag, '']

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self._skip -= 1
        if self._heading and tag == self._heading[0]:
            self.headings.append(f'{tag} {norm(self._heading[1])}')
            self._heading = None

    def handle_data(self, data):
        if self._skip:
            return
        self.text.append(data)
        if self._heading:
            self._heading[1] += data


def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name('baseline.json'))
    status, sitemap = fetch(f'{SITE}/sitemap.xml')
    assert status == 200, status
    urls = re.findall(r'<loc>([^<]+)</loc>', sitemap)
    pages = []
    for n, url in enumerate(urls, 1):
        status, html = fetch(url)
        m = re.search(r'<title>(.*?)</title>', html, re.S)
        page = {
            'url': url,
            'path': unquote(urlparse(url).path),
            'status': status,
            'title': norm(m.group(1)) if m else None,
        }
        if BODY_START in html and BODY_END in html:
            body = html.split(BODY_START, 1)[1].split(BODY_END, 1)[0]
            p = Body()
            p.feed(body)
            page.update(headings=p.headings, counts=p.counts, text=norm(' '.join(p.text)))
        pages.append(page)
        print(f'[{n}/{len(urls)}] {status} {page["path"]}', file=sys.stderr)
        time.sleep(0.3)
    out.write_text(json.dumps({'site': SITE, 'exported': time.strftime('%Y-%m-%d'),
                               'pages': pages}, ensure_ascii=False, indent=1) + '\n',
                   encoding='utf-8')
    posts = sum('text' in p for p in pages)
    print(f'{len(pages)} pages ({posts} with post body) -> {out}', file=sys.stderr)


if __name__ == '__main__':
    main()
