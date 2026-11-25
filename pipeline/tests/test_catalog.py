import copy
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from catalog import SCOPE, enrich, publish, regno, source_url
from sources import parse_greenbook, parse_ppis

DAY = '2026-10-16'


def products():
    """A minimal published product, as the workbook importer produces it."""
    return [
        {
            'id': '100-123',
            'registration_number': '100-123',
            'name': 'Validation fixture — not a commercial product',
            'registrant': 'Test',
            'sites': [SCOPE['sites'][11]],
            'ingredients': [{'name': 'Metalaxyl', 'percent': 25, 'cas': None, 'pc_code': None}],
            'epa_verified': True,
            'greenbook': None,
        }
    ]


class CatalogTests(unittest.TestCase):
    def test_exact_14_sites_and_blank_start(self):
        self.assertEqual(len(SCOPE['sites']), 14)
        self.assertIsNone(SCOPE['status_date_start'])

    def test_distributor_number_preserved(self):
        self.assertEqual(regno('071532-00022-007969'), '71532-22-7969')

    def test_no_javascript_source_link(self):
        with self.assertRaises(ValueError):
            source_url('javascript:alert(1)')

    def test_full_number_join_and_conflict(self):
        p = products()
        gb = {
            'schema_version': 1,
            'source': 'Greenbook',
            'retrieved_on': DAY,
            'products': [
                {
                    'registration_number': '100-123-999',
                    'name': 'Another product',
                    'source_url': 'https://www.greenbook.net/products/1/example',
                    'ingredients': [],
                }
            ],
        }
        result, status = enrich(p, gb, DAY)
        self.assertIsNone(result[0]['greenbook'])
        gb['products'][0]['registration_number'] = '100-123'
        gb['products'][0]['ingredients'] = [{'name': 'Metalaxyl', 'percent': 40}]
        result, status = enrich(p, gb, DAY)
        self.assertEqual(result[0]['ingredients'][0]['percent'], 25)
        self.assertTrue(result[0]['greenbook']['warnings'])

    def test_loss_guard_against_previous_catalog(self):
        many = []
        for i in range(5):
            x = copy.deepcopy(products()[0])
            x['id'] = x['registration_number'] = '100-' + str(100 + i)
            many.append(x)
        previous = publish(None, many, DAY, {})
        with self.assertRaisesRegex(ValueError, '30%'):
            publish(previous, many[:2], DAY, {})
        self.assertEqual(len(publish(previous, many[:2], DAY, {}, True)['products']), 2)
        self.assertEqual(len(publish(previous, many[:4], DAY, {})['products']), 4)


class SourceTests(unittest.TestCase):
    def test_greenbook_missing_fields_fail_without_publication(self):
        with self.assertRaises(ValueError):
            parse_greenbook('<h1>Example</h1>', 'https://www.greenbook.net/products/1/example')

    def test_greenbook_parser_fixture(self):
        html = '<h1>Example</h1><h2>Active Ingredients</h2><ul><li>Metalaxyl CAS 57837-19-1 29.99%</li></ul><div>Signal word</div><div>Caution</div><div>EPA Reg #</div><div>100-123</div><div>Last updated</div><div>Dec 31, 2025</div><div>Status</div><div>Active Registration</div>'
        p = parse_greenbook(html, 'https://www.greenbook.net/products/1/example')
        self.assertEqual(p['registration_number'], '100-123')
        self.assertEqual(p['ingredients'][0]['name'], 'Metalaxyl')
        self.assertAlmostEqual(p['ingredients'][0]['percent'], 29.99)
        self.assertFalse(p['ingredients_complete'])

    def test_ppis_candidates_never_masquerade_as_appril(self):
        reg = '00010000123'
        sc = '123456789'
        pc = '000001'
        product = (
            reg
            + '01'
            + '3'
            + '20200101'
            + '00000000'
            + '  '
            + 'Fixture'.ljust(70)
            + 'F'
            + '00'
            + 'F'
        )
        data = {
            'sitename': [sc + SCOPE['sites'][11].ljust(100)],
            'prodsite': [reg + sc],
            'chemname': [pc + 'ISO'.ljust(20) + 'Metalaxyl'.ljust(270) + 'Y'],
            'formula': [reg + pc + '299900 '],
            'product': [product],
        }
        result = parse_ppis(data)
        self.assertFalse(result['complete'])
        self.assertIsNone(result['products'][0]['status_date'])
        self.assertEqual(result['products'][0]['sites'][0]['status'], 'Unverified')
        self.assertAlmostEqual(result['products'][0]['ingredients'][0]['percent'], 29.99)


if __name__ == '__main__':
    unittest.main()
