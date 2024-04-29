import { encodedStrlen } from '../fit/types.js';

function mounted() {
  // Set default speed if no timing on route
  if (isNaN(this.duration) || this.duration <= 0) {
    const speed = this.units == 'miles' ? 10 : 16.2;
    this.$emit('duration', (this.distance * 3600000) / speed);
  }
}

function distance() {
  const round = (d) => (d < 1000 ? d.toPrecision(3) : Math.round(d));
  const points = this.route.points;
  const km = points[points.length - 1].distance / 1000;
  return this.units === 'miles' ? round(km / 1.609344) : round(km);
}

function duration() {
  const points = this.route.points;
  const [{ time: startTime }, { time: finishTime }] = [points[0], points[points.length - 1]];
  return finishTime - startTime;
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

const shortNotes = {
  get: function shortNotes() {
    return this.route.shortNotes;
  },
  set: function shortNotes(value) {
    this.$emit('shortNotes', value);
  }
};

function routeNameTooLong() {
  return encodedStrlen(this.routeName) > 16;
}

function avgSpeed() {
  return this.distance / (this.duration / 3600000);
}

function speedUnits() {
  return this.units === 'miles' ? 'mph' : `${this.units}/h`;
}

const RouteInfo = {
  template: '#route-info-template',
  mounted,
  props: {
    route: Object,
    units: String,
  },
  data: () => ({
    avgSpeedField: null
  }),
  computed: {
    routeName,
    routeNameTooLong,
    avgSpeed,
    speedUnits,
    distance,
    duration,
    goalTime,
    shortNotes
  },
  watch: {
    avgSpeed: {
      immediate: true,
      handler: function avgSpeed(newValue, oldValue) {
        // Don't set field value if it was due to field value changing
        if (!isFinite(oldValue) || Math.abs(oldValue - this.avgSpeedField) < 0.05) {
          this.avgSpeedField = newValue.toFixed(1);
        }
      }
    },
    avgSpeedField: {
      handler: function avgSpeedField(newValue, oldValue) {
        if (!newValue.match(/^\d*\.?\d?$/)) {
          this.avgSpeedField = oldValue;
        } else {
          // Ignore changes due to switching units, or no change in numeric value
          if (newValue > 0 && Math.abs(newValue - oldValue) >= 0.05 && Math.abs(newValue - this.avgSpeed) >= 0.05) {
            this.$emit('duration', (this.distance * 3600000) / newValue);
          }
        }
      }
    }
  }
};

export default RouteInfo;
