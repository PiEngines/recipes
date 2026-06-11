import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix="/api/seasonal", tags=["seasonal"])

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "seasonal_data.json"

MONTH_NAMES = {
    1: "Januar",
    2: "Februar",
    3: "März",
    4: "April",
    5: "Mai",
    6: "Juni",
    7: "Juli",
    8: "August",
    9: "September",
    10: "Oktober",
    11: "November",
    12: "Dezember",
}


def _load_data() -> dict:
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def _filter_category(items: list[dict], month: int) -> list[dict]:
    result = []
    for item in items:
        status = item.get("months", {}).get(str(month))
        if status not in ("fresh", "stored"):
            continue
        entry = {
            "id": item["id"],
            "name": item["name"],
            "status": status,
            "harvest": item.get("harvest", []),
        }
        if "plant" in item:
            entry["plant"] = item["plant"]
        result.append(entry)
    return result


@router.get("/current")
def get_current_seasonal():
    data = _load_data()
    month = datetime.now().month
    return {
        "month": month,
        "month_name": MONTH_NAMES[month],
        "vegetables": _filter_category(data.get("vegetables", []), month),
        "fruits": _filter_category(data.get("fruits", []), month),
        "salads": _filter_category(data.get("salads", []), month),
        "herbs": _filter_category(data.get("herbs", []), month),
    }
