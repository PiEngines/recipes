from decimal import Decimal
from fractions import Fraction
from typing import Optional, Union

from app.utils.amount_parser import parse_amount


def _to_readable_string(f: Fraction) -> str:
    """Convert a Fraction to a human-readable amount string."""
    if f.denominator == 1:
        return str(f.numerator)
    whole = int(f)
    remainder = f - whole
    if whole == 0:
        return f"{remainder.numerator}/{remainder.denominator}"
    return f"{whole} {remainder.numerator}/{remainder.denominator}"


def scale_amount(
    amount: str,
    module_servings: int,
    parent_servings: int,
    servings_override: Optional[int] = None,
    scale_factor: Optional[Union[float, Decimal]] = None,
) -> str:
    """Scale an ingredient amount from a module recipe into the parent recipe context.

    Formula: amount * effective_servings / module_servings * scale_factor
    """
    parsed = parse_amount(amount)
    if not isinstance(parsed, Fraction):
        return amount

    if module_servings == 0:
        return amount

    effective_servings = servings_override if servings_override is not None else parent_servings
    result = parsed * effective_servings / module_servings

    if scale_factor is not None:
        result = result * Fraction(str(scale_factor)).limit_denominator(10000)

    return _to_readable_string(result)
