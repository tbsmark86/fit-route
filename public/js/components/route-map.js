/* global L */
/* jshint esversion: 6 */

import { getBoundingBox } from '../poi.js';
import { findClimbs } from '../climbs.js';
import * as Overpass from '../overpass.js';

const latlng = ({ lat, lon }) => [lat, lon];

function getLayerUrl() {
  return this.layer || 'https://tile.openstreetmap.org/{z}/{x}/{y}{r}.png';
}

function mounted() {
  this.map = L.map('route-map', {
    zoomControl: false,
    fullscreenControl: { position: 'topright' },
    almostOnMouseMove: false,
    almostDistance: 10
  });
  L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

  const attributions = ['&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'];
  this.tileLayer = L.tileLayer(this.getLayerUrl(), {
    attribution: attributions.join(' | '),
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(this.map);

  const points = this.route.points;

  this.routeLayer = L.polyline(points.map(latlng), { color: 'blue' }).addTo(this.map);
  this.distanceLayer = L.layerGroup().addTo(this.map);

  // almostOver to allow approximate clicking for;
  // Note: The layer must be added twice to keep it visible despite of
  // of example code for almostOver :/
  this.map.almostOver.addLayer(this.routeLayer);
  // allow clicking the route to add new instruction
  this.map.on('almost:click', (event, layer) => {
    // very stupid way to find the nearest point on the route
    let max = Number.MAX_SAFE_INTEGER;
    let found = this.route.points[0];
    this.route.points.forEach((point) => {
      const distance = event.latlng.distanceTo(point);
      if (distance < max) {
        max = distance;
        found = point;
      }
    });
    this.$emit('select_point', found);
  });
  this.markerLayer = L.layerGroup().addTo(this.map);
  this.turnLayer = L.layerGroup().addTo(this.map);
  this.waterLayer = L.layerGroup().addTo(this.map);
  this.toiletLayer = L.layerGroup().addTo(this.map);
  this.gasLayer = L.layerGroup().addTo(this.map);

  const [start, finish] = [points[0], points[points.length - 1]];
  L.circleMarker(latlng(start), { radius: 8, weight: 0, color: 'green', fillOpacity: 0.6 }).addTo(this.map);
  L.circleMarker(latlng(finish), { radius: 8, weight: 0, color: 'red', fillOpacity: 0.6 }).addTo(this.map);

  this.map.on('zoomend', ({ target: map }) => {
    this.zoom = map.getZoom();
  });

  this.map.fitBounds(this.routeLayer.getBounds());

    // TODO: just a tech demo - need gui!
    findClimbs(points);

  drawTurns.call(this);
  drawWater.call(this);

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

function drawMarkers() {
  this.distanceLayer.clearLayers();
  for (const distanceMarker of distanceMarkers(this.route.points, this.units, this.zoom)) {
    distanceMarker.addTo(this.distanceLayer);
  }
}

function drawTurns() {
  this.turnLayer.clearLayers();
  if (!this.show_turns) {
    return;
  }
  for (const point of this.route.points) {
    if (!point.turn) {
      continue;
    }
    const text = point.name || '';
    const icon = L.divIcon({
      iconSize: null,
      html: `<div class="map-turn"><div class="map-turn-content map-turn-${point.turn}" data-turn=${point.turn}>${text}</div><div class="map-turn-arrow" /></div></div>`
    });
    L.marker(latlng(point), { icon }).addTo(this.turnLayer).on('click', this.$emit.bind(this, 'select_point', point));
  }
}

const RouteMap = {
  template: '#route-map-template',
  props: {
    route: Object,
    units: String,
    show_marker: Boolean,
    show_turns: Boolean,
    show_water: Boolean,
    show_toilet: Boolean,
    show_gas: Boolean,
    layer: String
  },
  mounted,
  data: () => ({
    zoom: null
  }),
  methods: {
    drawTurns,
    drawWater,
    getLayerUrl
  },
  watch: {
    units: drawMarkers,
    zoom: drawMarkers,
    show_marker: drawMarkers,
    show_turns: drawTurns,
    show_water: drawWater,
    show_toilet: drawToilet,
    show_gas: drawGas,
    layer: function () {
      this.tileLayer.setUrl(this.getLayerUrl());
    }
  }
};

function addPoiLayer(data, layer) {
  const mapLabel = (label) =>
    `<div class="map-label"><div class="map-label-content">${label}</div><div class="map-label-arrow" /></div></div>`;
  const infoFunc = function () {
    alert(`OSM Attributes:\n\n${this.options.title}`);
  };
  for (const i of data) {
    const icon = L.divIcon({ iconSize: null, html: mapLabel(i.name) });
    L.marker([i.lat, i.lon], { icon, title: i.text }).addTo(layer).on('click', infoFunc);
  }
}

async function drawWater() {
  this.waterLayer.clearLayers();
  if (!this.show_water) {
    return;
  }
  addPoiLayer(await Overpass.findWater(getBoundingBox(this.route.points, 1.5)), this.waterLayer);
}

async function drawToilet() {
  this.toiletLayer.clearLayers();
  if (!this.show_toilet) {
    return;
  }
  addPoiLayer(await Overpass.findToilet(getBoundingBox(this.route.points, 1.5)), this.toiletLayer);
}

async function drawGas() {
  this.gasLayer.clearLayers();
  if (!this.show_gas) {
    return;
  }
  addPoiLayer(await Overpass.findGas(getBoundingBox(this.route.points, 1.5)), this.gasLayer);
}

export default RouteMap;
