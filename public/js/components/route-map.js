/* global L */

function mounted() {
  this.map = L.map('route-map', { zoomControl: false, fullscreenControl: { position: 'topright' } });

  L.control.zoom({ position: 'bottomright' }).addTo(this.map);

  this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(this.map);

  const latlngs = this.route.points.map(({ lat, lon }) => [lat, lon]);

  this.routeLayer = L.polyline(latlngs, { color: 'blue' }).addTo(this.map);
  this.map.fitBounds(this.routeLayer.getBounds());

  L.circleMarker(latlngs[latlngs.length - 1], { radius: 8, weight: 0, color: 'red', fillOpacity: 0.6 }).addTo(this.map);
  L.circleMarker(latlngs[0], { radius: 8, weight: 0, color: 'green', fillOpacity: 0.6 }).addTo(this.map);
}

const RouteMap = {
  template: '#route-map-template',
  props: {
    route: Object
  },
  mounted,
  data: () => ({
    map: null,
    tileLayer: null,
    routeLayer: null
  })
};

export default RouteMap;
