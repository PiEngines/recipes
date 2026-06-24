from fractions import Fraction

import pytest

from app.utils.amount_parser import parse_amount


class TestParseAmountNumeric:
    def test_integer(self):
        assert parse_amount("2") == Fraction(2)

    def test_decimal(self):
        assert parse_amount("0.5") == Fraction(1, 2)

    def test_simple_fraction(self):
        assert parse_amount("1/2") == Fraction(1, 2)

    def test_mixed_number(self):
        assert parse_amount("1 1/2") == Fraction(3, 2)

    def test_mixed_number_with_thirds(self):
        assert parse_amount("2 1/3") == Fraction(7, 3)

    def test_whole_number_as_fraction(self):
        assert parse_amount("4/2") == Fraction(2)


class TestParseAmountUnicode:
    def test_quarter(self):
        assert parse_amount("¼") == Fraction(1, 4)

    def test_half(self):
        assert parse_amount("½") == Fraction(1, 2)

    def test_three_quarters(self):
        assert parse_amount("¾") == Fraction(3, 4)

    def test_third(self):
        assert parse_amount("⅓") == Fraction(1, 3)

    def test_two_thirds(self):
        assert parse_amount("⅔") == Fraction(2, 3)

    def test_eighth(self):
        assert parse_amount("⅛") == Fraction(1, 8)

    def test_three_eighths(self):
        assert parse_amount("⅜") == Fraction(3, 8)


class TestParseAmountUnparsable:
    def test_text_unchanged(self):
        assert parse_amount("nach Geschmack") == "nach Geschmack"

    def test_etwas_unchanged(self):
        assert parse_amount("etwas") == "etwas"

    def test_eine_prise_unchanged(self):
        assert parse_amount("1 Prise") == "1 Prise"

    def test_two_word_non_numeric_unchanged(self):
        assert parse_amount("ein bisschen") == "ein bisschen"

    def test_original_returned_with_surrounding_whitespace(self):
        # "Original-String unverändert" — surrounding whitespace is preserved
        assert parse_amount("  nach Geschmack  ") == "  nach Geschmack  "

    def test_no_error_on_division_by_zero_fraction(self):
        # "1/0" would raise ZeroDivisionError — must return original string
        assert parse_amount("1/0") == "1/0"
