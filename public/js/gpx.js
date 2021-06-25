export async function parseGpx(file) {
  return await parseRoute(await parseXml(await readFile(file)));
}

async function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ({ target: { result } }) => resolve(result);
    reader.onerror = (error) => reject(error);
    reader.readAsText(file, 'UTF-8');
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

function* trackPoints(trkseg) {
  for (const node of trkseg.children) {
    if (node.nodeName === 'trkpt') {
      const lat = parseFloat(node.getAttribute('lat'));
      const lon = parseFloat(node.getAttribute('lon'));
      const ele = childNamed(node, 'ele');
      const time = childNamed(node, 'time');

      yield {
        lat,
        lon,
        ele: ele && parseFloat(ele.textContent),
        time: time && Date.parse(time.textContent)
      };
    }
  }
}

function* routePoints(rte) {
  for (const node of rte.children) {
    if (node.nodeName === 'rtept') {
      const lat = parseFloat(node.getAttribute('lat'));
      const lon = parseFloat(node.getAttribute('lon'));
      const time = undefined;

      yield {
        lat,
        lon,
        time
      };
    }
  }
}

function turnMapping(angle) {
  const [slight, regular, sharp, reverse] = [30, 60, 120, 150];

  if (angle >= slight && angle <= 360 - slight) {
    if (angle < regular) {
      return 'slight_right';
    } else if (angle < sharp) {
      return 'right';
    } else if (angle < reverse) {
      return 'sharp_right';
    } else if (angle <= 360 - reverse) {
      return 'u_turn';
    } else if (angle <= 360 - sharp) {
      return 'sharp_left';
    } else if (angle <= 360 - regular) {
      return 'left';
    } else {
      return 'slight_left';
    }
  }
  return undefined;
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

function* turnPoints(points) {
  let prevPoint;
  let turnPoint;
  let prevBearing;

  for (const point of points) {
    if (prevPoint && point.distance - prevPoint.distance > 5) {
      if (!turnPoint) {
        const { lat, lon, distance, time } = prevPoint;
        turnPoint = { lat, lon, distance, time };
      }
      const turnDistance = point.distance - turnPoint.distance;

      const bearing = Math.round(azimuth(turnPoint, point));

      const angle = (bearing - prevBearing + 360) % 360;
      const isTurning = angle >= 10 && angle <= 350 && turnDistance < 25;

      if (!isTurning) {
        const turn = turnMapping(angle);
        if (turn) {
          yield { ...turnPoint, turn };
        }

        prevBearing = bearing;
        turnPoint = undefined;
      }
    }
    prevPoint = point;
  }
}

function elevationChange(points) {
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
  const trkseg = trk && childNamed(trk, 'trkseg');
  const trkName = trk && childNamed(trk, 'name');

  const rte = childNamed(doc.documentElement, 'rte');
  const rteName = rte && childNamed(rte, 'name');

  const name =
    (metadataName && metadataName.textContent) ||
    (trkName && trkName.textContent) ||
    (rteName && rteName.textContent) ||
    'Unnamed';

  const points = Array.from(setDistance((trkseg && trackPoints(trkseg)) || (rte && routePoints(rte)) || []));
  if (!points.length) {
    throw new Error('No points found');
  }

  const turns = Array.from(turnPoints(points));
  const { eleGain, eleLoss } = elevationChange(points);
  return points && points.length && { name, points, turns, eleGain, eleLoss };
}
