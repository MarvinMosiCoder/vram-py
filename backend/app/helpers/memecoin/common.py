""" memecoin helpers """

def dig(data, *keys):
    """Walk nested keys, returning None as soon as one is missing."""
    for key in keys:
        if not isinstance(data, dict):
            return None
        data = data.get(key)
    return data