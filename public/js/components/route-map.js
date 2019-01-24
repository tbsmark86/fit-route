/* global L */

function mounted() {
  this.map = L.map('route-map', { fullscreenControl: { position: 'topright' } });

  this.tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(this.map);

  const latlngs = this.route.points.map(({ lat, lon }) => [lat, lon]);
  this.routeLayer = L.polyline(latlngs, { color: 'blue' }).addTo(this.map);
  this.map.fitBounds(this.routeLayer.getBounds());
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
