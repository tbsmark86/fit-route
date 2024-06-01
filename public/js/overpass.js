/* jshint esversion: 6 */

/**
 * execute overpass request
 */
function overpass(req) {
  const params = new URLSearchParams();
  params.append('data', req);

  return fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: params
  }).then((response) => response.json());
}

function box2poly(box) {
  let str = '(poly:"';
  for (const p of box) {
    str += `${p.lat.toFixed(3)} ${p.lon.toFixed(3)} `;
  }
  str = str.trimRight();
  str += '")';
  return str;
}

function tags2str(tags) {
  let str = '';
  for (const tag of Object.keys(tags)) {
    str += `${tag}=${tags[tag]}` + '\n';
  }
  return str;
}

function deleteMatching(tags, re) {
  Object.keys(tags).map((key) => {
    if (re.test(key)) {
      delete tags[key];
    }
  });
}

/**
 * Compile Data to reduced POI-Format
 * GPX Symbol see as example
 *  https://www.gpsbabel.org/htmldoc-development/GarminIcons.html
 * sadly there is no standard
 */
function makePoi(ele, name, sym) {
  // default ignored tags:
  delete ele.tags.amenity;
  delete ele.tags.wheelchair;
  return {
    lat: ele.center ? ele.center.lat : ele.lat,
    lon: ele.center ? ele.center.lon : ele.lon,
    name,
    text: tags2str(ele.tags),
    sym
  };
}

function isClosed(str) {
  if (str) {
    str = str.toLowerCase();
    return str.includes('abandoned') || str.includes('closed');
  }
  return false;
}

function looksOld(poi, disused_kind) {
  if (poi.tags.abandoned || poi.tags[`abandoned:${disused_kind}`]) {
    // https://wiki.openstreetmap.org/wiki/Key:abandoned
    return true;
  } else if (poi.tags.disused || poi.tags[`disused:${disused_kind}`]) {
    // https://wiki.openstreetmap.org/wiki/Key:disused
    return true;
  } else if (isClosed(poi.tags.description) || isClosed(poi.tags.name)) {
    // real life data sometimes
    return true;
  } else if (poi.tags.opening_hours === 'closed' || poi.tags.opening_hours === 'off') {
    // permanently close
    // https://wiki.openstreetmap.org/wiki/Key:opening_hours
    return true;
  }
  return false;
}

/**
 * Box is a list of points that forms a polygon
 */
export function findWater(box) {
  const query = `
	[out:json];
	node[amenity~"(^drinking_water|water_point$)"]
	    [access!=private]
	    [access!=no]
	    [access!=customers]
	    [access!=permissive]
	    ${box2poly(box)};
	out;
    `;
  return overpass(query).then((data) => {
    let res = [];
    for (let ele of data.elements) {
      if (ele.tags.drinking_water && ele.tags.drinking_water !== 'yes') {
        // should not happen, but maybe ...
        continue;
      }
      if (looksOld(ele, 'amenity')) {
        continue;
      }

      res.push(makePoi(ele, 'Water', 'Drinking Water'));
    }

    return res;
  });
}

/**
 * Query Gas Stations with 24h shops (not for gas for food/water/toilet ...)
 */
export function findGas(box) {
  // gas_stations may be small (nodes)
  // ore whole buildings (way) therefore search for 'nw'
  const query = `
	[out:json];
	nw[amenity=fuel]
	    [opening_hours="24/7"]
	    [shop!=no]
	    ${box2poly(box)};
	out center;
    `;

  return overpass(query).then((data) => {
    let res = [];
    for (let ele of data.elements) {
      if (looksOld(ele, 'shop')) {
        continue;
      }

      if (ele.tags.automated === 'yes') {
        // these typical have 24/7 because well automated ... but
        // nothing to buy there.
        // Guess that if not also tagged with shop there is none and
        // especially none which is open 24/7!
        if (!ele.tags.shop && !ele.tags.car_wash) {
          continue;
        }
      } else if (ele.tags['fuel:cng'] === 'yes' || ele.tags['fuel:lpg'] === 'yes') {
        // try guessing if this a lpg-only station
        if (ele.tags['fuel:diesel'] && ele.tags['fuel:diesel'] !== 'no') {
          // other fuel available
        } else if (ele.tags.brand || ele.tags.shop || ele.tags.compressed_air || ele.tags.car_wash) {
          // shop ...; known brand or air station
        } else {
          continue;
        }
      } else if (ele.tags['name'] === 'Tankpool24') {
        // automated brand
        continue;
      }

      let name = ele.tags.brand || 'Gas';
      if (ele.tags.automated === 'yes') {
        // automated is likely that opening_hours not reflect the
        // shop hours!
        name += '?';
      } else if (ele.tags.self_service === 'yes' && !ele.tags.shop) {
        // similar
        name += '?';
      }

      res.push(makePoi(ele, name, 'Gas Station'));
    }

    return res;
  });
}

export function findToilet(box) {
  const query = `
	[out:json];
	node[amenity=toilets]
	    [access!=private]
	    [access!=no]
	    [access!=customers]
	    [access!=permissive]
	    [!fixme]
	    ${box2poly(box)};
	out;
    `;

  return overpass(query).then((data) => {
    let res = [];
    for (let ele of data.elements) {
      if (looksOld(ele, 'amenity')) {
        continue;
      }

      res.push(makePoi(ele, 'Toilet'));
    }

    return res;
  });
}
