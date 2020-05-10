

export function getBool(key, def) {
  key = 'fit-route-' + key;
  const val = localStorage[key];
  if(val !== null) {
    try {
      return JSON.parse(val);
    } catch(e) {
    }
  }
  console.log('get ', key, 'default');
  return def;
}

export function setBool(key, val) {
  key = 'fit-route-' + key;
  localStorage[key] = JSON.stringify(val);
}

export function setBoolWatchFunc(key, val) {
  return setBool.bind(null, key);
}
