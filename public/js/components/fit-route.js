/* jshint esversion: 6 */
/* global URL */
import { parseGpx } from '../gpx.js';
import FileUpload from './file-upload.js';
import RouteInfo from './route-info.js';
import RouteMap from './route-map.js';
import CoursePointDialog from './course-point-dialog.js';
import { FITEncoder } from '../fit/encoder.js';
import { getBool, setBoolWatchFunc, setBool, getString, setString } from '../localStorage.js';

function setName(name) {
  this.route.name = name;
}

function setShortNotes(shortNotes) {
  this.route.shortNotes = shortNotes;
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
  this.unsaved = false;
}

async function onFileUpload(gpxFile) {
  try {
    this.gpxFile = gpxFile;
    this.route = await parseGpx(gpxFile);
    // default save option
    this.route.shortNotes = true;
    this.$emit('show-info', false);
    this.unsaved = true;
  } catch (error) {
    console.error(error);
    this.$emit('error', `Unable to process "${gpxFile.name}"`);
  }
}

function fitDownloadPart(points, start, finish, postfix1, postfix2) {
  console.log('Download Fit', postfix1);
  try {
    const encoder = new FITEncoder();
    encoder.writeFileId({ type: 'course', time_created: Date.now() });
    encoder.writeCourse({ name: `${this.route.name}${postfix1}` });
    encoder.writeLap({
      timestamp: start.time,
      total_timer_time: (finish.time - start.time) / 1000,
      start_time: start.time,
      start_position_lat: start.lat,
      start_position_long: start.lon,
      end_position_lat: start.lat,
      end_position_long: finish.lon,
      total_distance: finish.distance,
      // TODO: These values are invalid on split
      total_ascent: this.route.eleGain,
      total_descent: this.route.eleLoss
    });

    encoder.writeEvent({
      timestamp: start.time,
      event: 'timer',
      event_type: 'start',
      event_group: 0
    });
    const shortNotes = this.route.shortNotes;
    const shortMapping = {
      u_turn: 'U',
      sharp_left: 'LL',
      left: 'L',
      slight_left: 'l',
      left_fork: 'fork L',
      straight: '-',
      right_fork: 'fork R',
      slight_right: 'r',
      right: 'R',
      sharp_right: 'RR'
    };

    for (let { lat, lon, ele, time, distance, turn, name } of points) {
      encoder.writeRecord({ timestamp: time, position_lat: lat, position_long: lon, altitude: ele, distance });

      if (turn !== undefined) {
	if (turn === 'split') {
	    turn = 'generic';
	    if (!name) {
		name = 'Track Split';
	    }
	}
        if (name === undefined && shortNotes && shortMapping[turn]) {
          // Store an almost empty Description for the turn.
          // The Idea is to override any Default (long word) default Text of
          // the device e.g. 'l' instead 'turn slight left' this way manual
          // notes can gab more attention.
          name = shortMapping[turn];
        }
        // There is also the messageIndex - unclear what its for and if it's required
        encoder.writeCoursePoint({
          timestamp: time,
          position_lat: lat,
          position_long: lon,
          type: turn,
          name,
          distance
        });
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
    anchorElement.download = `${this.route.name}${postfix2}.fit`;
    anchorElement.href = url;
    anchorElement.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
    this.unsaved = false;
  } catch (error) {
    console.error(error);
    this.$emit('error', `Unable to create FIT`);
  }
}

function slicePoints(points, start, end)
{
    const substract = points[start].distance;
    return points.slice(start, end).map((point) => {
	let { lat, lon, ele, time, distance, turn, name } = point;
	distance -= substract;
	return { lat, lon, ele, time, distance, turn, name };
    });
}

function onFitDownload() {
    const points = this.route.points;

    // check for splits
    let splitCount = 0;
    let curStart = 0;
    for(let i = 0; i < points.length; i++) {
	const point = points[i];
	if(point.turn === 'split') {
	    splitCount++;
	    // always do split +/- 20 points to create minimal overlap.
	    let realEnd = Math.min(i + 20, points.length);
	    fitDownloadPart.call(this, slicePoints(points, curStart, realEnd), points[curStart], points[realEnd], ` (${splitCount})`, `-${splitCount}`);
	    curStart = Math.max(i - 20, 0);
	}
    }
    if(splitCount > 0) {
	splitCount++;
	fitDownloadPart.call(this, slicePoints(points, curStart, points.length), points[curStart], points[points.length -1], ` (${splitCount})`, `-${splitCount}`);
    } else {
        fitDownloadPart.call(this, points, points[0], points[points.length - 1], '', '');
    }
}

async function onSearchClimbs() {
    try {
	const climbs = await import('../climbs.js');
	const created = climbs.findClimbs(this.route.points);
	if(!created) {
	    alert('No Climbs found.');
	    return;
	}
    } catch(e) {
	console.error(e);
	alert('Failed :/');
	return;
    }
    // enable turn display to avoid confusion
    this.show_turns = true;
    this.$refs.map.drawTurns();
}

function onBeforeUnload(event) {
  // simple 'forgot to save' question
  if (this.unsaved) {
    event.preventDefault();
  }
}

async function onSelectPoint(point) {
  await this.$refs.dialog.edit(point);
  this.$refs.map.drawTurns();
  this.unsaved = true;
}

const FitRoute = {
  template: '#fit-route-template',
  data: () => ({
    gpxFile: null,
    route: null,
    units: 'km',
    show_marker: getBool('show-marker', true),
    show_turns: getBool('show-turns', true),
    show_water: false,
    show_toilet: false,
    show_gas: false,
    map_url: getString('map-url', ''),
    map_url_active: getBool('map-url-active', true),
    layer: getBool('map-url-active', true) && getString('map-url', ''),
    unsaved: false
  }),
  methods: {
    onClear,
    onFileUpload,
    onFitDownload,
    onSearchClimbs,
    setName,
    setDuration,
    setShortNotes,
    onSelectPoint,
    onBeforeUnload
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
    map_url: function (val) {
      setString('map-url', val);
      if (this.map_url_active) {
        this.layer = this.map_url;
      }
    },
    map_url_active: function (val) {
      setBool('map-url-active', val);
      this.layer = val ? this.map_url : '';
    }
  },
  created: function () {
    window.addEventListener('beforeunload', this.onBeforeUnload);
  },
  destroyed: function () {
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }
};

export default FitRoute;
