"""Check EPA for a new APPRIL workbook and publish the catalog only if it changed.

1. A HEAD request compares EPA's ETag/Last-Modified/Content-Length with the values
   recorded in sync-status.json. If they match, nothing is downloaded or written.
2. Otherwise the workbook is downloaded, staged and validated. Files are written
   only when the catalog content changes, or (status only) when EPA re-uploaded
   an identical workbook, so the next check can skip the download again.
3. On failure nothing is written; the last published catalog stays in place and
   the caller (the GitHub Actions job) fails visibly.

Git history of public/data/ is the change log. No provider website scraping,
source credentials, or workbook files are published.
"""

import argparse
import copy
import json
import os
import pathlib
import shutil
import sys
import tempfile
from types import SimpleNamespace

from catalog import ROOT, atomic_write, now, product_facts, source_url
from refresh_epa import probe_source
from refresh_epa import run as refresh

WORKFLOW = 'https://github.com/bzbradford/whats-on-your-seed-v2/actions/workflows/data-update.yml'
SCHEDULE = {
    'kind': 'GitHub Actions',
    'cron': '30 6 * * 1',
    'timezone': 'America/Chicago',
    'workflow_url': WORKFLOW,
}
AUTOMATION = (
    'GitHub Actions: weekly on Mondays at 06:30 America/Chicago; '
    'downloads the EPA workbook only when it has changed'
)


def read_json(path, default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else copy.deepcopy(default)


def changes_between(old, new):
    before = {p['id']: product_facts(p) for p in old['products']}
    after = {p['id']: product_facts(p) for p in new['products']}
    changes = []
    for rid in sorted(before.keys() | after.keys()):
        a, b = before.get(rid), after.get(rid)
        if a == b:
            continue
        fields = sorted(
            k for k in (a or {}).keys() | (b or {}).keys() if (a or {}).get(k) != (b or {}).get(k)
        )
        changes.append(
            {
                'registration_number': rid,
                'action': 'added' if a is None else 'removed' if b is None else 'changed',
                'fields': fields,
            }
        )
    return changes


def publication_reasons(old, new):
    """Describe why a catalog must be republished, independently of check dates."""
    reasons = []
    if old.get('mode') != new.get('mode'):
        reasons.append('mode')
    if old['meta'].get('automation') != new['meta'].get('automation'):
        reasons.append('automation')
    if old['meta'].get('audit', {}).get('sha256') != new['meta'].get('audit', {}).get('sha256'):
        reasons.append('epa_workbook')
    if changes_between(old, new):
        reasons.append('product_records')
    # Reviewed references and scope can change independently of source data.
    for key in ('scope', 'ingredient_reference', 'education', 'label_specs'):
        if old.get(key) != new.get(key):
            reasons.append(key)
    for key in ('greenbook', 'cdms'):
        a = copy.deepcopy(old['meta'].get(key, {}))
        b = copy.deepcopy(new['meta'].get(key, {}))
        a.pop('retrieved_on', None)
        b.pop('retrieved_on', None)
        if a != b:
            reasons.append(key + '_metadata')
    return reasons


def needs_publication(old, new):
    return bool(publication_reasons(old, new))


def publication_report(reasons):
    """Do not infer new source data from a publication or registration count alone."""
    if any(k in reasons for k in ('epa_workbook', 'product_records')):
        return 'updated', 'Source data published.'
    if any(k in reasons for k in ('scope', 'ingredient_reference', 'education', 'label_specs')):
        return 'reference_updated', 'Reference or scope changes published; source data unchanged.'
    if reasons:
        return 'metadata_updated', 'Catalog metadata published; source data unchanged.'
    return 'unchanged', 'Sources checked; no new data. Published catalog unchanged.'


def source_states(args, catalog, checked, success):
    states = {
        'EPA': {
            'state': 'checked' if success else 'update failed; last published data retained',
            'checked_at': checked if success else None,
            'attempted_at': checked,
            'workbook_created': catalog['meta'].get('source_snapshot_date'),
            'source_url': 'https://www3.epa.gov/pesticides/appril/apprildatadump_public.xlsx',
        }
    }
    for provider in ('Greenbook', 'CDMS'):
        configured = bool(getattr(args, provider.lower(), None))
        states[provider] = {
            'state': ('checked' if success else 'configured; update did not complete')
            if configured
            else 'not configured; saved references only',
            'checked_at': checked if configured and success else None,
            'retrieved_on': catalog['meta'].get(provider.lower(), {}).get('retrieved_on'),
        }
    return states


def run(args):
    output = pathlib.Path(args.output)
    status_path = output.with_name('sync-status.json')
    old = read_json(output)
    if not old or not old.get('products'):
        raise ValueError('An existing validated catalog is required for a scheduled update')
    previous_status = read_json(status_path, {})
    checked = now()
    try:
        # Scheduled URLs must be HTTPS; credentials belong in environment secrets.
        for name in ('greenbook', 'cdms'):
            value = getattr(args, name, None)
            if value:
                source_url(value)
        headers = probe_source()
        if (
            headers
            and headers == previous_status.get('source_headers')
            and not getattr(args, 'force', False)
        ):
            print(json.dumps({'outcome': 'not_modified', 'source_headers': headers}))
            return 0
        work = ROOT / 'private'
        work.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='scheduled-', dir=work) as directory:
            stage = pathlib.Path(directory)
            staged = stage / 'catalog.json'
            shutil.copyfile(output, staged)
            job = SimpleNamespace(
                workbook=None,
                db=str(stage / 'catalog.sqlite'),
                output=str(staged),
                greenbook=args.greenbook,
                cdms=args.cdms,
                allow_large_change=False,
                require_complete_feeds=True,
                # Registrations that leave scope get an EPA status observation in the audit.
                tracked_registrations=sorted(p['id'] for p in old['products']),
                automation=AUTOMATION,
            )
            if refresh(job):
                raise RuntimeError('Source update did not complete')
            candidate = read_json(staged)
        changes = changes_between(old, candidate)
        reasons = publication_reasons(old, candidate)
        changed = bool(reasons)
        headers_changed = bool(headers) and headers != previous_status.get('source_headers')
        outcome, message = publication_report(reasons)
        counts = {
            k: sum(x['action'] == k for x in changes) for k in ('added', 'changed', 'removed')
        }
        summary = {'outcome': outcome, 'products': len(candidate['products']), 'changes': counts}
        if not changed and not headers_changed:
            print(json.dumps(summary))
            return 0
        if not changed:
            # EPA re-uploaded an identical workbook: record its headers only.
            status = dict(previous_status, source_headers=headers)
            atomic_write(status_path, json.dumps(status, ensure_ascii=False, indent=2))
            print(json.dumps(dict(summary, outcome='headers_updated')))
            return 0
        status = {
            'state': 'success',
            'outcome': outcome,
            'publication_reasons': reasons,
            'checked_at': checked,
            'last_publication_at': candidate['meta']['imported_at'],
            'message': message,
            'scheduler': SCHEDULE,
            'sources': source_states(args, candidate, checked, True),
            'workbook_sha256': candidate['meta']['audit']['sha256'],
            'source_headers': headers or previous_status.get('source_headers'),
            'changes': counts,
        }
        history_path = output.with_name('update-history.json')
        history = read_json(history_path, {'schema_version': 1, 'updates': []})
        entry = {
            'checked_at': checked,
            'published_at': status['last_publication_at'],
            'outcome': outcome,
            'publication_reasons': reasons,
            'message': message,
            'workbook_created': candidate['meta']['source_snapshot_date'],
            'workbook_sha256': candidate['meta']['audit']['sha256'],
            'counts': counts,
            'records': changes,
        }
        history['updates'] = ([entry] + history['updates'])[:52]
        candidate['meta']['last_update_summary'] = counts
        candidate['meta']['source_updates'] = status['sources']
        # All acquisition and validation has completed before publication.
        atomic_write(history_path, json.dumps(history, ensure_ascii=False, indent=2))
        atomic_write(
            output.with_name('epa-import-audit.json'),
            json.dumps(candidate['meta']['audit'], ensure_ascii=False, indent=2),
        )
        atomic_write(output, json.dumps(candidate, ensure_ascii=False))
        atomic_write(status_path, json.dumps(status, ensure_ascii=False, indent=2))
        print(json.dumps(summary))
        return 0
    except Exception as exc:
        # Do not put endpoint URLs, tokens, or arbitrary server errors in output.
        print(
            'Scheduled update failed ('
            + type(exc).__name__
            + '). Nothing was written; the published catalog is unchanged.',
            file=sys.stderr,
        )
        return 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default=str(ROOT.parent / 'public/data/catalog.json'))
    parser.add_argument(
        '--force',
        action='store_true',
        help='Download and reconcile even if EPA reports the workbook is unchanged',
    )
    parser.add_argument('--greenbook', default=os.getenv('GREENBOOK_FEED_URL') or None)
    parser.add_argument('--cdms', default=os.getenv('CDMS_FEED_URL') or None)
    return run(parser.parse_args())


if __name__ == '__main__':
    sys.exit(main())
