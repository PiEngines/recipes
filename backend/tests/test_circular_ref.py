from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.modules.service import check_circular_reference


def _make_db(fetchone_result):
    """Build a mock Session where db.execute(...).fetchone() returns the given result."""
    mock_result = MagicMock()
    mock_result.fetchone.return_value = fetchone_result

    db = MagicMock()
    db.execute.return_value = mock_result
    return db


class TestCheckCircularReferenceDirect:
    def test_self_embed_raises(self):
        db = _make_db(None)
        with pytest.raises(HTTPException) as exc_info:
            check_circular_reference(db, parent_recipe_id=1, new_module_id=1)
        assert exc_info.value.status_code == 400
        assert "bereits Bestandteil" in exc_info.value.detail

    def test_self_embed_does_not_hit_db(self):
        db = _make_db(None)
        with pytest.raises(HTTPException):
            check_circular_reference(db, parent_recipe_id=5, new_module_id=5)
        db.execute.assert_not_called()

    def test_direct_cycle_raises(self):
        # CTE finds that parent is already a descendant of the new module
        db = _make_db((1,))  # fetchone returns a row → cycle detected
        with pytest.raises(HTTPException) as exc_info:
            check_circular_reference(db, parent_recipe_id=1, new_module_id=2)
        assert exc_info.value.status_code == 400
        assert "bereits Bestandteil" in exc_info.value.detail

    def test_no_cycle_does_not_raise(self):
        # CTE finds nothing → no cycle
        db = _make_db(None)
        check_circular_reference(db, parent_recipe_id=1, new_module_id=2)  # must not raise


class TestCheckCircularReferenceIndirect:
    def test_indirect_cycle_three_levels_raises(self):
        # Graph: A→B→C, embedding C into A would create A→B→C→A
        # CTE starting from C finds A in descendants → cycle
        db = _make_db((1,))
        with pytest.raises(HTTPException) as exc_info:
            check_circular_reference(db, parent_recipe_id=1, new_module_id=3)
        assert exc_info.value.status_code == 400

    def test_valid_embed_no_common_ancestry_does_not_raise(self):
        # CTE finds no path back to parent → valid
        db = _make_db(None)
        check_circular_reference(db, parent_recipe_id=10, new_module_id=20)  # must not raise

    def test_error_message_is_correct(self):
        db = _make_db((1,))
        with pytest.raises(HTTPException) as exc_info:
            check_circular_reference(db, parent_recipe_id=1, new_module_id=2)
        assert exc_info.value.detail == (
            "Dieses Rezept kann nicht eingebunden werden – es ist bereits Bestandteil dieses Rezepts."
        )
