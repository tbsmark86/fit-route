/* jshint esversion: 6 */
/* global URL */
import { parseGpx } from '../gpx.js';
import FileUpload from './file-upload.js';
import RouteInfo from './route-info.js';
import RouteMap from './route-map.js';
import CoursePointDialog from './course-point-dialog.js';
import { FITEncoder } from '../fit/encoder.js';
import { getBool, setBoolWatchFunc, setBool, getString, setString } from '../localStorage.js';

import { getPoiAsGPX } from '../poi.js';

let unsaved = false;

function setName(name) {
  this.route.name = name;
}

function setDuration(duration) {
  const points = this.route.points;
  const [{ time: startTime = Date.now() }, { distance: totalDistance }] = [points[0], points[points.length - 1]];
  for (const point of points) {
    point.time = startTime + Math.round(duration * (point.distance / totalDistance));
  }
}

function onClear() {
  this.gpxFile = this.route = null;
  this.$emit('show-info', true);
  unsaved = false;
}

async function onFileUpload(gpxFile) {
  try {
    this.gpxFile = gpxFile;
    this.route = await parseGpx(gpxFile);
    this.$emit('show-info', false);
    unsaved = true;
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
    for (const { lat, lon, ele, time, distance, turn, name } of this.route.points) {
      encoder.writeRecord({ timestamp: time, position_lat: lat, position_long: lon, altitude: ele, distance });

      if(turn !== undefined) {
	// There is also the messageIndex - unclear what its for and if it's required
	encoder.writeCoursePoint(
	  { timestamp: time, position_lat: lat, position_long: lon, type: turn, name, distance }
	);
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
    URL.revokeObjectURL(url);
    unsaved = false;
  } catch (error) {
    console.error(error);
    this.$emit('error', `Unable to create FIT`);
  }
}

function onPoiDownload() {

    const downloadGPX = (content, type) => {
	const filename = `${this.route.name}-${type}.gpx`;
	const url = URL.createObjectURL(new File([content], filename, {type: 'application/gpx+xml'}));
	const anchorElement = this.$refs.downloadAnchor;
	anchorElement.download = filename;
	anchorElement.href = url;
	anchorElement.click();
	URL.revokeObjectURL(url);
    };

	console.debug('loading start');
    this.poi_loading = true;
    const enqueJob = (type, distance) => {
	return getPoiAsGPX(this.route.points, type, distance).then((gpx) => {
	    console.info(`${type} loaded start download`, gpx);
	    downloadGPX(gpx, type);
	}).catch((err) => {
	    console.error(err);
	    this.$emit('error', `Unable to create ${type} GPX`);
	});
    };
    Promise.all([
	enqueJob('water', 3)
    ]).finally(() => {
	console.debug('loading done');
	this.poi_loading = false;
    });
}

async function onSelectPoint(point) {
    await this.$refs.dialog.edit(point);
    this.$refs.map.drawTurns();
    unsaved = true;
}

// simple 'forgot to save' question
window.addEventListener('beforeunload', function (e) {
  if(unsaved) {
      /* XXX
    e.preventDefault();
    e.returnValue = '';
    */
  }
});

const FitRoute = {
  template: '#fit-route-template',
  data: () => ({
    gpxFile: null,
    route: null,
    units: 'km',
    show_marker: getBool('show-marker', true),
    show_turns: getBool('show-turns', true),
    show_water: false,
    map_url: getString('map-url', ''),
    map_url_active: getBool('map-url-active', true),
    layer: getBool('map-url-active', true) && getString('map-url', ''),
    poi_loading: false,
  }),
  methods: {
    onClear,
    onFileUpload,
    onFitDownload,
    onPoiDownload,
    setName,
    setDuration,
    onSelectPoint
  },
  components: {
    FileUpload,
    RouteInfo,
    RouteMap,
    CoursePointDialog
  },
  watch: {
    show_marker: setBoolWatchFunc('show-marker'),
    show_turns: setBoolWatchFunc('show-turns'),
    map_url: function(val) {
      setString('map-url', val);
      if(this.map_url_active) {
	this.layer = this.map_url;
      }
    },
    map_url_active: function(val) {
      setBool('map-url-active', val);
      this.layer = val ? this.map_url : '';
    }
  }
};

export default FitRoute;



