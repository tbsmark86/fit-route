import { parseGpx } from '../gpx.js';
import FileUpload from './file-upload.js';
import RouteMap from './route-map.js';

function distance() {
  const points = this.route.points;
  const km = points[points.length - 1].distance / 1000;
  return km < 1000 ? km.toPrecision(3) : Math.round(km);
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

function avgSpeed() {
  const speed = this.distance / (this.duration / 3600000);
  return speed.toFixed(1);
}

async function onFileUpload(gpxFile) {
  try {
    this.gpxFile = gpxFile;
    this.route = await parseGpx(gpxFile);
  }
  catch (error) {
    console.error(error);
    this.$emit('error', `Unable to process "${gpxFile.name}"`);
  }
}

const FitRoute = {
  template: '#fit-route-template',
  data: () => ({
    gpxFile: null,
    route: null
  }),
  computed: {
    avgSpeed,
    distance,
    duration,
    goalTime
  },
  methods: {
    onFileUpload
  },
  components: {
    FileUpload,
    RouteMap
  }
};

export default FitRoute;
