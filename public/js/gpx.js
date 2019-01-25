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
      const time = childNamed(node, 'time');

      if (lastPoint) {
        distance += haversine(lastPoint, { lat, lon });
      }

      const point = {
        lat,
        lon,
        distance,
        time: time && Date.parse(time.textContent)
      };

      lastPoint = point;
      yield point;
    }
  }
}

async function parseRoute(doc) {
  const trk = childNamed(doc.documentElement, 'trk');
  const metadata = childNamed(doc.documentElement, 'metadata');
  const metadataName = metadata && childNamed(metadata, 'name');
  const trkseg = trk && childNamed(trk, 'trkseg');
  const trkName = trk && childNamed(trk, 'name');

  const name = (metadataName && metadataName.textContent) ||
    (trkName && trkName.textContent) || 'Unnamed';
  const points = trkseg && Array.from(trackPoints(trkseg));

  return points && { name, points };
}
