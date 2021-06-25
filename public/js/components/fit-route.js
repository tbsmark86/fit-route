/* global URL */
import { parseGpx } from '../gpx.js';
import FileUpload from './file-upload.js';
import RouteInfo from './route-info.js';
import RouteMap from './route-map.js';
import { FITEncoder } from '../fit/encoder.js';

function setName(name) {
  this.route.name = name;
}

function setDuration(duration) {
  const points = this.route.points;
  const [{ time: startTime = Date.now() }, { distance: totalDistance }] = [points[0], points[points.length - 1]];
  for (const point of points) {
    point.time = startTime + Math.round(duration * (point.distance / totalDistance));
  }
  for (const turn of this.route.turns) {
    turn.time = startTime + Math.round(duration * (turn.distance / totalDistance));
  }
}

function onClear() {
  this.gpxFile = this.route = null;
  this.$emit('show-info', true);
}

async function onFileUpload(gpxFile) {
  try {
    this.gpxFile = gpxFile;
    this.route = await parseGpx(gpxFile);
    this.$emit('show-info', false);
  } catch (error) {
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
    encoder.writeEvent({
      timestamp: start.time,
      event: 'timer',
      event_type: 'start',
      event_group: 0
    });

    const points = this.route.points;
    if (includeTurns) {
      points.push(...this.route.turns);
      const tweakedDistance = ({ distance, turn }) => distance - 50 * (turn !== undefined);
      points.sort((a, b) => tweakedDistance(a) - tweakedDistance(b));
    }

    for (const { lat, lon, distance, time, ele, turn } of points) {
      if (turn === undefined) {
        encoder.writeRecord({ timestamp: time, position_lat: lat, position_long: lon, distance, altitude: ele });
      } else {
        encoder.writeCoursePoint({ timestamp: time, position_lat: lat, position_long: lon, distance, type: turn });
      }
    }

    encoder.writeEvent({
      timestamp: finish.time,
      event: 'timer',
      event_type: 'stop_disable_all',
      event_group: 0
    });

    const url = URL.createObjectURL(encoder.blob);
    const anchorElement = this.$refs.downloadAnchor;
    anchorElement.download = `${this.route.name}.fit`;
    anchorElement.href = url;
    anchorElement.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error(error);
    this.$emit('error', `Unable to create FIT`);
  }
}

const FitRoute = {
  template: '#fit-route-template',
  data: () => ({
    gpxFile: null,
    route: null,
    units: 'km',
    includeTurns: false
  }),
  methods: {
    onClear,
    onFileUpload,
    onFitDownload,
    setName,
    setDuration
  },
  components: {
    FileUpload,
    RouteInfo,
    RouteMap
  }
};

export default FitRoute;
