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
    }
    else if (doc.documentElement.nodeName !== 'gpx') {
      reject();
    }
    else {
      resolve(doc);
    }
  });
}

const childNamed = (node, nodeName) =>
  Array.from(node.children).find(node => node.nodeName === nodeName);

function haversine({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return d;
}

function* trackPoints(trkseg) {
  let lastPoint;
  let distance = 0;

  for (const node of trkseg.children) {
    if (node.nodeName === 'trkpt') {
      const lat = parseFloat(node.getAttribute('lat'));
      const lon = parseFloat(node.getAttribute('lon'));
      const ele = childNamed(node, 'ele');
      const time = childNamed(node, 'time');

      if (lastPoint) {
        distance += haversine(lastPoint, { lat, lon });
      }

      const point = {
        lat,
        lon,
        ele: ele && parseFloat(ele.textContent),
        distance,
        time: time && Date.parse(time.textContent)
      };

      lastPoint = point;
      yield point;
    }
  }
}

function* routePoints(rte) {
  let lastPoint;
  let distance = 0;

  for (const node of rte.children) {
    if (node.nodeName === 'rtept') {
      const lat = parseFloat(node.getAttribute('lat'));
      const lon = parseFloat(node.getAttribute('lon'));
      const time = undefined;

      if (lastPoint) {
        distance += haversine(lastPoint, { lat, lon });
      }

      const point = {
        lat,
        lon,
        time,
        distance
      };

      lastPoint = point;
      yield point;
    }
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
      }
      else {
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

  const name = (metadataName && metadataName.textContent) ||
    (trkName && trkName.textContent) ||
    (rteName && rteName.textContent) ||
    'Unnamed';
  const points = (trkseg && Array.from(trackPoints(trkseg))) ||
    (rte && Array.from(routePoints(rte)));
  const { eleGain, eleLoss } = points && elevationChange(points) || {};

  return points && { name, points, eleGain, eleLoss };
}
