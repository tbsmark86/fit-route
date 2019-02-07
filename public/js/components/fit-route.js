/* global URL */
import { parseGpx } from '../gpx.js';
import FileUpload from './file-upload.js';
import RouteMap from './route-map.js';
import { FITEncoder } from '../fit/encoder.js';

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

function onFitDownload() {
  try {
    const start = this.route.points[0];
    const finish = this.route.points[this.route.points.length - 1];

    const encoder = new FITEncoder();
    encoder.writeFileId({ type: 'course', time_created: Date.now() });
    encoder.writeCourse({ name: this.route.name });
    encoder.writeLap({
      timestamp: start.time,
      total_timer_time: (finish.time - start.time) / 1000,
      start_time: start.time,
      start_position_lat: start.lat,
      start_position_long: start.lon,
      end_position_lat: start.lat,
      end_position_long: finish.lon,
      total_distance: finish.distance,
      total_ascent: this.route.eleGain,
      total_descent: this.route.eleLoss
    });
    for (const { lat, lon, ele, time, distance } of this.route.points) {
      encoder.writeRecord({ timestamp: time, position_lat: lat, position_long: lon, altitude: ele, distance });
    }

    const url = URL.createObjectURL(encoder.blob);
    const anchorElement = this.$refs.downloadAnchor;
    anchorElement.download = `${this.route.name}.fit`;
    anchorElement.href = url;
    anchorElement.click();
    URL.revokeObjectURL(url);
  }
  catch (error) {
    console.error(error);
    this.$emit('error', `Unable to create FIT`);
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
    onFileUpload,
    onFitDownload
  },
  components: {
    FileUpload,
    RouteMap
  }
};

export default FitRoute;
