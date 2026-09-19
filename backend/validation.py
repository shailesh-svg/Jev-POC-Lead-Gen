"""Bounds checks for the numbers a provider returns, shared by every feature."""
import math


def bounded(value, low=0.0, high=1.0, message='Invalid value returned by provider'):
    """Return value as a float, or raise ValueError when it is not inside [low, high]."""
    number = float(value)
    if not math.isfinite(number) or not low <= number <= high:
        raise ValueError(message)
    return number
