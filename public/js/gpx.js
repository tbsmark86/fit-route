
export async function parseGpx(file) {

    if(file.name.endsWith('.fit')) {
	// Very likely a fit file transparently switch to Fit-Reader!
	console.log('Read as fit file');
	let lib = await import('./fit/decoder.js');
	let decoder = new lib.FITDecoder();
	return decoder.readRoute(await readFile(file, 'binary'));
    }
    console.log('Read as gpx file');
    return parseRoute(await parseXml(await readFile(file, 'text')));
}

async function readFile(file, mode) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ({ target: { result } }) => resolve(result);
    reader.onerror = (error) => reject(error);
    if(mode === 'binary') {
	reader.readAsArrayBuffer(file);
    } else {
	reader.readAsText(file, 'UTF-8');
    }

  });
}

async function parseXml(buffer) {
  return new Promise((resolve, reject) => {
    const parser = new DOMParser(); /* global DOMParser */
    const doc = parser.parseFromString(buffer, 'application/xml');
    const errors = doc.getElementsByTagName('parsererror');
    if (errors.length) {
      console.error('Parse error:', errors.item(0).innerText);
      reject();
    } else if (doc.documentElement.nodeName !== 'gpx') {
      reject();
    } else {
      resolve(doc);
    }
  });
}

const toDegrees = (radians) => ((radians * 180) / Math.PI + 360) % 360;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

function haversine({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }) {
  const R = 6371e3;
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return d;
}

function azimuth({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return toDegrees(θ);
}

const childNamed = (node, nodeName) => Array.from(node.children).find((node) => node.nodeName === nodeName);
const childsNamed = (node, nodeName) => Array.from(node.children).filter((node) => node.nodeName === nodeName);

function* trackPoints(trksegs) {
  for (const trkseg of trksegs) {
    for (const node of trkseg.children) {
      if (node.nodeName === 'trkpt') {
        yield waypoint(node);
      }
    }
  }
}

function* routePoints(rte) {
  for (const node of rte.children) {
    if (node.nodeName === 'rtept') {
      yield waypoint(node);
    }
  }
}

function waypoint(node) {
  const lat = parseFloat(node.getAttribute('lat'));
  const lon = parseFloat(node.getAttribute('lon'));
  const ele = childNamed(node, 'ele');
  const time = childNamed(node, 'time');

  return {
    lat,
    lon,
    ele: ele && parseFloat(ele.textContent),
    time: time && Date.parse(time.textContent)
  };
}

function* setDistance(points) {
  let distance = 0;
  let prevPoint = 0;

  for (const point of points) {
    if (prevPoint) {
      distance += haversine(prevPoint, point);
    }
    yield { ...point, distance };
    prevPoint = point;
  }
}

/**
 * Read gpx exenstion created by brouter-web 'osmand' style:
 *
 * Example:
 *  <rtept lat="52.430425" lon="13.263190">
 *    <desc>left</desc>
 *    <extensions>
 *	<time>182</time>
 *      <turn>TL</turn>
 *      <turn-angle>-47</turn-angle>
 *	<offset>0</offset>
 *    </extensions>
 *  </rtept>
 *
 * Offset is id of matching trkpt
 * turn possible values: https://github.com/abrensch/brouter/blob/a0de73632338004995d152a6aa6180d866e0525c/brouter-core/src/main/java/btools/router/VoiceHint.java
 */
function* routeInstructions(rte) {
  const map2fit = {
    TU: 'u_turn',
    TRU: 'u_turn',
    TSHL: 'sharp_left',
    TL: 'left',
    TSLL: 'slight_left',
    KL: 'left_fork', // wild guess
    C: 'straight',
    KR: 'right_fork', // wild guess
    TSLR: 'slight_right',
    TR: 'right',
    TSHR: 'sharp_right'
  };

  for (const node of rte.children) {
    if (node.nodeName === 'rtept') {
      const lat = parseFloat(node.getAttribute('lat'));
      const lon = parseFloat(node.getAttribute('lon'));
      const extension = childNamed(node, 'extensions');
      if (!extension) {
        continue;
      }
      const offsetNode = childNamed(extension, 'offset');
      if (!offsetNode) {
        continue;
      }
      const offset = parseInt(offsetNode.textContent, 10);

      const turnNode = childNamed(extension, 'turn');
      if (!turnNode) {
        // start and end node don't have turn data
        continue;
      }
      const turnOsm = turnNode.textContent;

      // convert OsmAnd-Enum to fit-Enum
      let turn = map2fit[turnOsm];
      let name = undefined; // empty hint by default
      if (turn === undefined) {
        if (turnOsm.startsWith('RNDB') || turnOsm.startsWith('RNLB')) {
          // there is no roundabout instruction in fit - make a message
          name = 'Exit ' + turnOsm.slice(4);
          turn = 'danger';
        } else {
          // unknown - convert to message
          turn = 'generic';
          name = turnOsm;
          console.log('unknown', turnOsm);
        }
      }

      yield {
        lat,
        lon,
        offset,
        turn,
        name
      };
    }
  }
}

/**
 * Enhance point data with instruction information
 */
function insertInstructions(points, instructions) {
  for (const instruction of instructions) {
    let point = points[instruction.offset];
    if (!point) {
      console.warn(`Warning: Instruction offset unknown.`, instruction);
      continue;
    } else if (point.lat !== instruction.lat || point.lon !== instruction.lon) {
      // sanity check
      console.warn(`Warning: Instruction data not matching point.`, instruction);
      continue;
    }
    point.turn = instruction.turn;
    point.name = instruction.name;
  }
  return points;
}

export function elevationChange(points) {
  let eleGain = 0;
  let eleLoss = 0;
  let lastEle;

  for (const { ele } of points) {
    if (ele === undefined) {
      return {};
    }

    if (lastEle === undefined) {
      lastEle = ele;
      continue;
    }

    const delta = ele - lastEle;
    if (Math.abs(delta) >= 4) {
      lastEle = ele;
      if (delta > 0) {
        eleGain += delta;
      } else {
        eleLoss -= delta;
      }
    }
  }

  return { eleGain, eleLoss };
}

async function parseRoute(doc) {
  const metadata = childNamed(doc.documentElement, 'metadata');
  const metadataName = metadata && childNamed(metadata, 'name');

  const trk = childNamed(doc.documentElement, 'trk');
  // a track sometimes is split into multiple segments
  const trksegs = trk && childsNamed(trk, 'trkseg');
  const trkName = trk && childNamed(trk, 'name');

  const rte = childNamed(doc.documentElement, 'rte');
  const rteName = rte && childNamed(rte, 'name');

  const name =
    (metadataName && metadataName.textContent) ||
    (trkName && trkName.textContent) ||
    (rteName && rteName.textContent) ||
    'Unnamed';
  let points = Array.from(setDistance(trksegs.length && trackPoints(trksegs)) || (rte && routePoints(rte)));
  const { eleGain, eleLoss } = (points && elevationChange(points)) || {};

  if(points.length == 0) {
    throw new Error('Can\'t find a track or route in this GPX.')
  } else if(childsNamed(doc.documentElement, 'trk').length > 1) {
    alert('GPX contains multiple tracks!\nPlease split if you want to process all of them.');
  }

  const instructions = trksegs && rte && Array.from(routeInstructions(rte));
  if (instructions) {
    points = insertInstructions(points, instructions);
  }

  return points && { name, points, eleGain, eleLoss };
}
