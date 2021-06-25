/* global L */

const latlng = ({ lat, lon }) => [lat, lon];

function mounted() {
  this.map = L.map('route-map', {
    zoomControl: false,
    fullscreenControl: { position: 'topright' }
  });
  L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

  const attributions = [
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    '&copy; <a href="https://carto.com/attributions">CARTO</a>'
  ];
  this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: attributions.join(' | '),
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(this.map);

  const points = this.route.points;

  this.routeLayer = L.polyline(points.map(latlng), { color: 'blue' }).addTo(this.map);
  this.distanceLayer = L.layerGroup().addTo(this.map);
  this.turnsLayer = L.layerGroup();

  const overlays = { Distance: this.distanceLayer, Turns: this.turnsLayer };
  L.control.layers({}, overlays, { position: 'bottomright' }).addTo(this.map);

  const [start, finish] = [points[0], points[points.length - 1]];
  L.circleMarker(latlng(start), { radius: 8, weight: 0, color: 'green', fillOpacity: 0.6 }).addTo(this.map);
  L.circleMarker(latlng(finish), { radius: 8, weight: 0, color: 'red', fillOpacity: 0.6 }).addTo(this.map);

  this.map.on('zoomend', ({ target: map }) => {
    this.zoom = map.getZoom();
  });

  this.map.fitBounds(this.routeLayer.getBounds());
}

function midpoint(fraction, { lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }) {
  const mid = (a, b) => a + (b - a) * fraction;

  return { lat: mid(lat1, lat2), lon: mid(lon1, lon2) };
}

const distanceMarkerInterval = (zoom) => {
  switch (Math.min(zoom, 13)) {
    case 13:
      return 1;
    case 12:
    case 11:
      return 5;
    case 10:
      return 10;
    case 9:
      return 50;
    default:
      return 1e6;
  }
};

function* distancePoints(points, units, zoom) {
  const interval = distanceMarkerInterval(zoom);
  const intervalDistance = interval * 1000 * (units === 'miles' ? 1.609344 : 1);
  let nextDistance = intervalDistance;
  let label = interval;
  let lastPoint;
  for (const point of points) {
    while (point.distance >= nextDistance) {
      const fraction = (nextDistance - lastPoint.distance) / (point.distance - lastPoint.distance);
      yield { label, latlng: midpoint(fraction, lastPoint, point) };
      label += interval;
      nextDistance += intervalDistance;
    }
    lastPoint = point;
  }
}

function* distanceMarkers(points, units, zoom) {
  const mapLabel = (label) =>
    `<div class="map-label"><div class="map-label-content">${label}</div><div class="map-label-arrow" /></div></div>`;

  for (const { label, latlng } of distancePoints(points, units, zoom)) {
    const icon = L.divIcon({ iconSize: null, html: mapLabel(label) });
    yield L.marker(latlng, { icon });
  }
}

const turnIconSize = (zoom) => {
  switch (Math.min(zoom, 15)) {
    case 15:
      return [32, 32];
    case 14:
      return [24, 24];
    case 13:
      return [16, 16];
    default:
      return [8, 8];
  }
};

function* turnMarkers(turns, zoom) {
  const iconSize = turnIconSize(zoom);
  for (const turn of turns) {
    const icon = L.icon({ iconUrl: `images/${turn.turn}.svg`, iconSize });
    yield L.marker(latlng(turn), { icon });
  }
}

function drawMarkers() {
  this.distanceLayer.clearLayers();
  for (const distanceMarker of distanceMarkers(this.route.points, this.units, this.zoom)) {
    distanceMarker.addTo(this.distanceLayer);
  }

  this.turnsLayer.clearLayers();
  for (const turnMarker of turnMarkers(this.route.turns, this.zoom)) {
    turnMarker.addTo(this.turnsLayer);
  }
}

const RouteMap = {
  template: '#route-map-template',
  props: {
    route: Object,
    units: String
  },
  mounted,
  data: () => ({
    map: null,
    tileLayer: null,
    routeLayer: null,
    zoom: null
  }),
  watch: {
    units: drawMarkers,
    zoom: drawMarkers
  }
};

export default RouteMap;
