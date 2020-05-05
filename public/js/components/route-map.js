/* global L */

const latlng = ({ lat, lon }) => [lat, lon];

function mounted() {
  this.map = L.map('route-map', {
    zoomControl: false,
    fullscreenControl: { position: 'topright' }
  });
  L.control.zoom({ position: 'bottomright' }).addTo(this.map);

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
  this.markerLayer = L.layerGroup().addTo(this.map);
  this.turnLayer = L.layerGroup().addTo(this.map);

  const [start, finish] = [points[0], points[points.length - 1]];
  L.circleMarker(latlng(start), { radius: 8, weight: 0, color: 'greeen', fillOpacity: 0.6 }).addTo(this.map);
  L.circleMarker(latlng(finish), { radius: 8, weight: 0, color: 'red', fillOpacity: 0.6 }).addTo(this.map);

  this.map.on('zoomend', ({ target: map }) => {
    this.zoom = map.getZoom();
  });

  this.map.fitBounds(this.routeLayer.getBounds());


  drawTurns.call(this);
}

const markerInterval = (zoom) => {
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

function* markerPoints(points, units, zoom) {
  const interval = markerInterval(zoom);
  const distanceInterval = interval * 1000 * (units === 'miles' ? 1.609344 : 1);
  let distanceNext = distanceInterval;
  let label = interval;
  for (const point of points) {
    if (point.distance >= distanceNext) {
      yield { label, latlng: latlng(point) };
      label += interval;
      distanceNext += distanceInterval;
    }
  }
}

function drawMarkers() {
  const mapLabel = (label) =>
    `<div class="map-label"><div class="map-label-content">${label}</div><div class="map-label-arrow" /></div></div>`;

  this.markerLayer.clearLayers();
  for (const { label, latlng } of markerPoints(this.route.points, this.units, this.zoom)) {
    const icon = L.divIcon({ iconSize: null, html: mapLabel(label) });
    L.marker(latlng, { icon }).addTo(this.markerLayer);
  }
}

function drawTurns() {
  this.turnLayer.clearLayers();
  for (const point of this.route.points) {
    if (!point.turn) {
      continue;
    }
    const icon = L.divIcon({ iconSize: null,
      html: `<div class="map-label map-label-turn"><div class="map-label-content">${point.turn}</div><div class="map-label-arrow" /></div></div>`
    });
    L.marker(latlng(point), { icon }).addTo(this.turnLayer);
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
