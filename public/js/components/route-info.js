import { encodedStrlen } from '../fit/types.js';

function distance() {
  const round = (d) => d < 1000 ? d.toPrecision(3) : Math.round(d);
  const points = this.route.points;
  const km = points[points.length - 1].distance / 1000;
  return this.units === 'miles' ? round(km / 1.609344) : round(km);
}

function duration() {
  const points = this.route.points;
  const startTime = points[0].time;
  const finishTime = points[points.length - 1].time;
  return startTime && finishTime && finishTime - startTime;
}

function goalTime() {
  const divmod = (x, y) => [Math.floor(x / y), x % y];
  const pad = (n) => n.toString().padStart(2, '0');

  let days, hours, minutes, seconds;
  [seconds] = divmod(this.duration, 1000);
  [minutes, seconds] = divmod(seconds, 60);
  [hours, minutes] = divmod(minutes, 60);
  [days, hours] = divmod(hours, 24);

  return `${days ? days + '+' : ''}${hours}:${pad(minutes)}:${pad(seconds)}`;
}

const routeName = {
  get: function routeName() {
    return this.route.name;
  },
  set: function routeName(value) {
    this.$emit('name', value);
  }
};

function routeNameTooLong() {
  return encodedStrlen(this.routeName) > 16;
}

function avgSpeed() {
  const speed = this.distance / (this.duration / 3600000);
  return speed.toFixed(1);
}

function speedUnits() {
  return this.units === 'miles' ? 'mph' : `${this.units}/h`;
}

const RouteInfo = {
  template: '#route-info-template',
  props: {
    route: Object
  },
  data: () => ({
    units: 'km'
  }),
  computed: {
    routeName,
    routeNameTooLong,
    avgSpeed,
    speedUnits,
    distance,
    duration,
    goalTime
  }
};

export default RouteInfo;
