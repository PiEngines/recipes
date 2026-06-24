from decimal import Decimal

import pytest

from app.utils.scaling import scale_amount


class TestScaleAmountBasic:
    def test_integer_scales_up(self):
        # module: 100g for 4 servings → parent: 8 servings → 200g
        assert scale_amount("100", module_servings=4, parent_servings=8) == "200"

    def test_integer_scales_down(self):
        # 100g for 4 servings → 2 servings → 50g
        assert scale_amount("100", module_servings=4, parent_servings=2) == "50"

    def test_fraction_amount_scales(self):
        # ½ cup for 2 servings → 4 servings → 1 cup
        assert scale_amount("1/2", module_servings=2, parent_servings=4) == "1"

    def test_mixed_number_scales(self):
        # 1½ for 2 servings → 4 servings → 3
        assert scale_amount("1 1/2", module_servings=2, parent_servings=4) == "3"

    def test_result_is_fraction_string(self):
        # 1 for 4 servings → 2 servings → 1/2
        assert scale_amount("1", module_servings=4, parent_servings=2) == "1/2"

    def test_result_is_mixed_number_string(self):
        # 1 for 2 servings → 3 servings → 1 1/2
        assert scale_amount("1", module_servings=2, parent_servings=3) == "1 1/2"

    def test_same_servings_returns_original_value(self):
        assert scale_amount("3", module_servings=4, parent_servings=4) == "3"

    def test_unicode_fraction_scales(self):
        # ¼ for 2 servings → 4 servings → 1/2
        assert scale_amount("¼", module_servings=2, parent_servings=4) == "1/2"


class TestScaleAmountWithServingsOverride:
    def test_override_replaces_parent_servings(self):
        # module: 100g for 4; override → treat parent as 8 → 200g
        assert scale_amount("100", module_servings=4, parent_servings=2, servings_override=8) == "200"

    def test_override_zero_parent_servings_uses_override(self):
        # Even if parent_servings is irrelevant, override takes precedence
        assert scale_amount("100", module_servings=4, parent_servings=0, servings_override=4) == "100"

    def test_override_equals_module_servings_no_change(self):
        assert scale_amount("3", module_servings=4, parent_servings=10, servings_override=4) == "3"


class TestScaleAmountWithScaleFactor:
    def test_scale_factor_halves(self):
        # 4 cups scaled 1:1 then × 0.5 → 2 cups
        assert scale_amount("4", module_servings=4, parent_servings=4, scale_factor=0.5) == "2"

    def test_scale_factor_as_decimal(self):
        assert scale_amount("4", module_servings=4, parent_servings=4, scale_factor=Decimal("0.5")) == "2"

    def test_scale_factor_and_servings_override_combined(self):
        # 1 for 2 servings → override=4 (×2) → then ×0.5 → back to 1
        assert scale_amount("1", module_servings=2, parent_servings=1, servings_override=4, scale_factor=0.5) == "1"

    def test_scale_factor_08(self):
        # 10 for 4 servings → 4 servings (ratio 1:1) × 0.8 = 8
        assert scale_amount("10", module_servings=4, parent_servings=4, scale_factor=0.8) == "8"


class TestScaleAmountUnparsable:
    def test_text_amount_returned_unchanged(self):
        assert scale_amount("nach Geschmack", module_servings=4, parent_servings=8) == "nach Geschmack"

    def test_etwas_returned_unchanged(self):
        assert scale_amount("etwas", module_servings=4, parent_servings=8) == "etwas"

    def test_eine_prise_returned_unchanged(self):
        assert scale_amount("1 Prise", module_servings=4, parent_servings=8) == "1 Prise"

    def test_unparsable_ignores_scale_factor(self):
        # scale_factor should have no effect if amount is not numeric
        assert scale_amount("etwas", module_servings=4, parent_servings=8, scale_factor=2.0) == "etwas"

    def test_unparsable_ignores_servings_override(self):
        assert scale_amount("etwas", module_servings=4, parent_servings=8, servings_override=2) == "etwas"


class TestScaleAmountEdgeCases:
    def test_module_servings_zero_returns_original(self):
        assert scale_amount("5", module_servings=0, parent_servings=4) == "5"
