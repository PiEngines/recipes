from fractions import Fraction
from typing import Union

_UNICODE_FRACTIONS: dict[str, str] = {
    "¼": "1/4",
    "½": "1/2",
    "¾": "3/4",
    "⅓": "1/3",
    "⅔": "2/3",
    "⅕": "1/5",
    "⅖": "2/5",
    "⅗": "3/5",
    "⅘": "4/5",
    "⅙": "1/6",
    "⅚": "5/6",
    "⅛": "1/8",
    "⅜": "3/8",
    "⅝": "5/8",
    "⅞": "7/8",
}


def parse_amount(value: str) -> Union[Fraction, str]:
    """Parse an amount string into a Fraction, or return the original string unchanged."""
    if not isinstance(value, str):
        return value

    s = value.strip()
    for uc, ascii_frac in _UNICODE_FRACTIONS.items():
        s = s.replace(uc, ascii_frac)

    parts = s.split()
    try:
        if len(parts) == 1:
            return Fraction(parts[0])
        if len(parts) == 2:
            whole = Fraction(parts[0])
            frac = Fraction(parts[1])
            if whole < 0 or frac < 0:
                return value
            return whole + frac
    except (ValueError, ZeroDivisionError):
        pass

    return value
