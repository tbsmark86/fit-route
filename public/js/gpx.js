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

const childrenNamed = (node, nodeName) =>
  Array.from(node.children).filter(node => node.nodeName === nodeName);

function points(trkseg) {
  return childrenNamed(trkseg, 'trkpt')
    .map(node => {
      const lat = parseFloat(node.getAttribute('lat'));
      const lon = parseFloat(node.getAttribute('lon'));
      const time = childNamed(node, 'time');
      return { lat, lon, time: time && Date.parse(time.textContent) };
    });
}

async function parseRoute(doc) {
  const trk = childNamed(doc.documentElement, 'trk');
  const trkseg = trk && childNamed(trk, 'trkseg');
  const name = trk && childNamed(trk, 'name');
  return trkseg && {
    name: name && name.textContent || 'Unnamed',
    points: trkseg && points(trkseg)
  };
}
