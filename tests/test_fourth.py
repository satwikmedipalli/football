"""Sanity checks on situations every coach agrees on. These would have caught
the old punt bug (punting scored as giving the opponent the ball at the goal line)."""

import pytest

from gridiron import fourth


@pytest.fixture(scope="module")
def m():
    return fourth.fit()


def test_punt_deep_in_own_territory(m):
    # 4th and 10 from your own 20: punt.
    assert m.best(80, 10)[0] == "punt"


def test_punt_gives_opponent_long_field(m):
    # After a punt from your own 30 the opponent should start deep in their own half.
    assert m.punt_opp[70] > 60


def test_go_on_4th_and_1_near_midfield(m):
    assert m.best(45, 1)[0] == "go"


def test_field_goal_on_4th_and_long_in_the_red_zone(m):
    assert m.best(12, 9)[0] == "fg"


def test_ep_curve_increases_toward_goal(m):
    assert m.ep_first(10) > m.ep_first(50) > m.ep_first(90)


def test_conversion_falls_with_distance(m):
    assert m.p_convert(1) > m.p_convert(5) > m.p_convert(10)
