function finalKey(key) {
  return 'fit-route-' + key;
}

export function getBool(key, def) {
  key = finalKey(key);
  const val = localStorage[key];
  if (val !== null) {
    try {
      return JSON.parse(val);
    } catch (e) {}
  }
  return def;
}

export function setBool(key, val) {
  key = finalKey(key);
  localStorage[key] = JSON.stringify(val);
}

export function setBoolWatchFunc(key, val) {
  return setBool.bind(null, key);
}

export function getString(key, def) {
  key = finalKey(key);
  return localStorage[key] || def;
}

export function setString(key, val) {
  key = finalKey(key);
  localStorage[key] = val;
}

export function setStringWatchFunc(key, val) {
  return setString.bind(null, key);
}
