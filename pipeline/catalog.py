"""Shared catalog helpers: scope and reference data, identity/date validation,
provider-feed enrichment, and assembly of the published catalog JSON.
Standard library only. A failed import never replaces the last good catalog.
"""

import copy
import datetime as dt
import json
import os
import pathlib
import re
import tempfile
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parent
SCOPE = json.loads((ROOT / 'reference/scope.json').read_text(encoding='utf-8'))
INGREDIENTS = json.loads((ROOT / 'reference/ingredients.json').read_text(encoding='utf-8'))
EDUCATION = json.loads((ROOT / 'reference/education.json').read_text(encoding='utf-8'))
MAX_BYTES = 100 * 1024 * 1024


def today():
    return dt.datetime.now(ZoneInfo(SCOPE['timezone'])).date().isoformat()


def now():
    return dt.datetime.now(dt.UTC).isoformat()


def norm(s):
    return re.sub(r'\s+', ' ', str(s).strip()).casefold()


def regno(value):
    s = str(value).strip()
    if not re.fullmatch(r'\d{1,6}-\d{1,5}(?:-\d{1,6})?', s):
        raise ValueError('Invalid EPA registration number')
    return '-'.join(str(int(x)) for x in s.split('-'))


def valid_date(s):
    if not isinstance(s, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', s):
        raise ValueError('Expected ISO date YYYY-MM-DD')
    dt.date.fromisoformat(s)
    return s


def source_url(value, hosts=None):
    p = urllib.parse.urlparse(str(value))
    if p.scheme != 'https' or not p.hostname or p.username or p.password:
        raise ValueError('Source link must use HTTPS without embedded credentials')
    if hosts and p.hostname not in hosts:
        raise ValueError('Unexpected source domain')
    return value


def download(url, token=None):
    source_url(url)
    headers = {
        'User-Agent': 'CPN-Seed-Treatment-Catalog/0.1',
        'Accept': 'application/json, text/plain, application/zip',
    }
    if token:
        headers['Authorization'] = 'Bearer ' + token

    # Do not forward a feed token across a redirect.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, hdrs, newurl):
            raise ValueError('Feed redirect rejected; configure the final HTTPS endpoint')

    with urllib.request.build_opener(NoRedirect).open(
        urllib.request.Request(url, headers=headers), timeout=90
    ) as r:
        raw = r.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError('Source exceeds 100 MiB limit')
    return raw


def read_feed(location, token=None):
    raw = (
        download(location, token)
        if location.startswith('https://')
        else pathlib.Path(location).read_bytes()
    )
    if len(raw) > MAX_BYTES:
        raise ValueError('Feed is too large')
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError('Feed must be a JSON object')
    return data


def enrich(products, feed, date_end, provider='Greenbook'):
    """Join by FULL registration number. EPA facts win; conflicts remain visible."""
    if provider not in ('Greenbook', 'CDMS'):
        raise ValueError('Unsupported enrichment provider')
    key = provider.lower()
    hosts = (
        {'www.greenbook.net', 'greenbook.net'}
        if provider == 'Greenbook'
        else {'www.cdms.net', 'cdms.net', 'www.telus.com'}
    )
    if not feed:
        return products, {'state': 'Not connected', 'matched': 0, 'unmatched': 0}
    if feed.get('schema_version') != 1 or feed.get('source') != provider:
        raise ValueError('Expected normalized ' + provider + ' schema v1')
    retrieved = valid_date(feed.get('retrieved_on'))
    if (
        retrieved > date_end
        or (dt.date.fromisoformat(date_end) - dt.date.fromisoformat(retrieved)).days > 7
    ):
        raise ValueError(provider + ' enrichment is older than seven days or future dated')
    entries = feed.get('products')
    if not isinstance(entries, list):
        raise ValueError('Invalid ' + provider + ' products array')
    byreg = {}
    for g in entries:
        r = regno(g.get('registration_number'))
        if r in byreg:
            raise ValueError('Duplicate ' + provider + ' registration requires review: ' + r)
        source_url(g.get('source_url'), hosts)
        for doc in g.get('documents', []):
            if doc.get('type') not in ('specimen_label', 'supplemental_label', 'sds'):
                raise ValueError('Invalid document type')
            source_url(doc.get('url'), hosts)
            if doc.get('date'):
                valid_date(doc['date'])
                if doc['date'] > date_end:
                    raise ValueError('Future document date')
        if g.get('source_updated'):
            valid_date(g['source_updated'])
            if g['source_updated'] > date_end:
                raise ValueError('Future provider source date')
        byreg[r] = g
    matched = 0
    for p in products:
        g = byreg.get(p['id'])
        if not g:
            continue
        previous_updated = (p.get(key) or {}).get('source_updated')
        if previous_updated and g.get('source_updated') and g['source_updated'] < previous_updated:
            raise ValueError(provider + ' source revision is older than the published reference')
        matched += 1
        warnings = []
        gi = g.get('ingredients', [])
        if provider == 'CDMS' and g.get('ingredient_basis') != 'label':
            gi = []
            warnings.append(
                'CDMS label formulation not supplied; SDS composition is not a complete active ingredient list'
            )
        if not gi:
            warnings.append(provider + ' ingredients not supplied')
        else:
            epa_set = {norm(x['name']) for x in p['ingredients']}
            gb_set = {norm(x['name']) for x in gi}
            if epa_set != gb_set:
                warnings.append('Source ingredient lists differ; EPA formulation displayed')
            ep = {norm(x['name']): x.get('percent') for x in p['ingredients']}
            if any(
                x.get('percent') is not None
                and ep.get(norm(x['name'])) is not None
                and abs(float(x['percent']) - float(ep[norm(x['name'])])) > 0.01
                for x in gi
                if norm(x['name']) in ep
            ):
                warnings.append('Source ingredient percentages differ; EPA values displayed')
        if g.get('status') and g['status'] != 'Active Registration':
            warnings.append(provider + ' status differs; check current label')
        p[key] = {k: g.get(k) for k in ('name', 'source_url', 'source_updated')}
        p[key]['documents'] = g.get('documents', [])
        p[key].update(retrieved_at=retrieved, warnings=warnings)
    return products, {
        'state': 'Connected',
        'retrieved_on': retrieved,
        'matched': matched,
        'unmatched': len(byreg) - matched,
    }


def product_facts(product):
    """Ignore retrieval bookkeeping, but retain all scientific and provider facts."""
    q = copy.deepcopy(product)
    if q:
        for key in (
            'retrieved_at',
            'imported_at',
            'source_snapshot_date',
            'source_row',
            'base_source_row',
        ):
            q.pop(key, None)
        for key in ('greenbook', 'cdms'):
            if q.get(key):
                q[key].pop('retrieved_at', None)
    return q


def atomic_write(path, text):
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix='.catalog-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as out:
            out.write(text)
            out.flush()
            os.fsync(out.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def publish(
    previous,
    products,
    date_end,
    greenbook_status,
    allow_large_change=False,
    cdms_status=None,
    metadata=None,
    mode='live',
):
    """Assemble the public catalog. `previous` is the currently published catalog
    (or None); the loss guard compares against it."""
    if not products:
        raise ValueError('No publishable products; keeping last good snapshot')
    oldids = {p['id'] for p in (previous or {}).get('products', [])}
    newids = {p['id'] for p in products}
    if oldids and len(oldids - newids) / len(oldids) > 0.30 and not allow_large_change:
        raise ValueError(
            'More than 30% of existing registrations would disappear; review source then use --allow-large-change'
        )
    from comparison_evidence import load_label_specs

    catalog = {
        'mode': mode,
        'scope': SCOPE,
        'ingredient_reference': INGREDIENTS,
        'education': EDUCATION,
        'label_specs': load_label_specs(),
        'products': products,
        'meta': {
            'last_successful_sync': now(),
            'source_checked': date_end,
            'status_date_end': date_end,
            'automation': 'External scheduler required',
            'complete': True,
            'epa': 'Connected',
            'greenbook': greenbook_status,
            'cdms': cdms_status or {'state': 'Not connected'},
            'quarantined_count': 0,
            'coverage_note': 'Validated records from configured APPRIL export. No efficacy or state-authorization assessment.',
        },
    }
    if metadata:
        catalog['meta'].update(metadata)
    return catalog
