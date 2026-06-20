import time
import functools

_store = {}


def ttl_cache(seconds=20):
    """Cache a function's return value for `seconds`. Works on no-arg
    or simple-arg functions used for market data lookups."""
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            key = (fn.__name__, args, tuple(sorted(kwargs.items())))
            now = time.time()
            if key in _store:
                ts, value = _store[key]
                if now - ts < seconds:
                    return value
            value = fn(*args, **kwargs)
            _store[key] = (now, value)
            return value
        return wrapper
    return decorator