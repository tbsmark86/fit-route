/* jshint esversion: 11 */
/* global URL */
import { parseGpx, elevationChange } from '../gpx.js';
import FileUpload from './file-upload.js';
import RouteInfo from './route-info.js';
import RouteMap from './route-map.js';
import CoursePointDialog from './course-point-dialog.js';
import ClimbDialog from './climb-dialog.js';
import { FITEncoder } from '../fit/encoder.js';
import { getBool, setBoolWatchFunc, setBool, getString, setString } from '../localStorage.js';
import { improveInstructions } from '../improve-instructions.js';

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
  this.unsaved = false;
}

async function onFileUpload(gpxFile) {
  try {
    this.gpxFile = gpxFile;
    this.route = await parseGpx(gpxFile);
    if(this.improveTurns) {
	this.route = improveInstructions(this.route);
    }
    this.$emit('show-info', false);
    this.unsaved = true;
  } catch (error) {
    console.error(error);
    this.$emit('error', `Unable to process "${gpxFile.name}"`);
  }
}

function fitDownloadPart(points, postfix1 = '', postfix2 = '') {
  console.log('Download Fit', postfix1);
  const start = points[0];
  const finish = points[points.length - 1];
  const {eleGain, eleLoss} = elevationChange(points);
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
      total_ascent: eleGain,
      total_descent: eleLoss
    });

    encoder.writeEvent({
      timestamp: start.time,
      event: 'timer',
      event_type: 'start',
      event_group: 0
    });
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
        if (name === undefined && this.shortNotes && shortMapping[turn]) {
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
	    fitDownloadPart.call(this, slicePoints(points, curStart, realEnd), ` (${splitCount})`, `-${splitCount}`);
	    curStart = Math.max(i - 20, 0);
	}
    }
    if(splitCount > 0) {
	splitCount++;
	fitDownloadPart.call(this, slicePoints(points, curStart, points.length), ` (${splitCount})`, `-${splitCount}`);
    } else {
        fitDownloadPart.call(this, points);
    }
}

async function onSearchClimbs() {
    try {
	const choice = await this.$refs.dialog_climbs.show();
	if(choice.climbs === 'none' && choice.descents === 'none') {
	    return;
	}
	const climbs = await import('../climbs.js');
	const created = climbs.findClimbs(this.route.points,
	    choice,
	    () => this.$refs.map.drawTurns()
	);
	if(!created) {
	    alert('No Climbs found.');
	    return;
	}
    } catch(e) {
	alert('Unexpected Problem :/');
	throw e;
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
  await this.$refs.dialog_point.edit(point);
  if(this.improve_turns) {
    this.route = improveInstructions(this.route, true);
  }
  this.$refs.map.drawTurns();
  this.unsaved = true;
}

const FitRoute = {
  template: '#fit-route-template',
  data: () => ({
    gpxFile: null,
    route: null,
    shortNotes: getBool('shortNotes', true),
    improveTurns: getBool('improveTurns', false),
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
    onSelectPoint,
    onBeforeUnload
  },
  components: {
    FileUpload,
    RouteInfo,
    RouteMap,
    CoursePointDialog,
    ClimbDialog
  },
  watch: {
    shortNotes: setBoolWatchFunc('shortNotes'),
    improveTurns: function(val) {
	setBool('improveTurns', val);
	console.log('hey!!!');
	if(val) {
	    console.log('do improve!!!');
	    this.route = improveInstructions(this.route);
	    this.$refs.map.drawTurns();
	}
    },
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
    },
  },
  created: function () {
    if(window.location.hash.indexOf('debug') === -1) {
	window.addEventListener('beforeunload', this.onBeforeUnload);
    }
  },
  destroyed: function () {
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }
};

export default FitRoute;
