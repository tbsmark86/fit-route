
/**
 * Search alle turn instructions to include additional notes that make
 * them more useable on the road.
 *
 * Actions taken:
 * - if a L and R (or R and L) follow within a short distance
 *   add a note about the upcoming second turn on the first one.
 *   Note: This is purely based on personal preference and trying out if
 *   this function is actually useful.
 * - Brouter creates Danger and "Exit X" for roundabouts.
 *   Try to read the actual turn direction and change the danger sign
 *
 * Argument: incremental: Only apply actions that make sense after the
 * user edited some turn
 */
export function improveInstructions(route, incremental) {
    insertDoubleTurnNote(route);
    if(!incremental) {
	convertBrouterRoundabout(route);
    }
    return route;
}

function insertDoubleTurnNote(route) {
    // We could add an option for this but for now: KISS
    const shortDistanceTreshold = 50;

    // Only consider real turns for now
    const leftTurns = ['sharp_left', 'left', /*'slight_left', 'left_fork'*/];
    const rightTurns = ['sharp_right', 'right', /*'slight_right', 'right_fork'*/];

    let lastTurn = null;
    for(let point of route.points) {
	if(!point.turn) {
	    continue;
	}
	if(lastTurn && !lastTurn.name &&
		(point.distance - lastTurn.distance) <= shortDistanceTreshold
	) {
	    if(leftTurns.includes(lastTurn.turn) && rightTurns.includes(point.turn)) {
		lastTurn.name = 'L/R';
	    } else if(rightTurns.includes(lastTurn.turn) && leftTurns.includes(point.turn)) {
		lastTurn.name = 'R/L';
	    }
	}
	lastTurn = point;
    }
}

const toDegrees = (radians) => ((radians * 180) / Math.PI + 360) % 360;

function azimuth({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return toDegrees(θ);
}


function turnMapping(angle) {
  const [slight, regular, sharp, reverse] = [30, 45, 160, 175];

  if (angle >= slight && angle <= 360 - slight) {
    if (angle < regular) {
      return 'slight_right';
    } else if (angle < sharp) {
      return 'right';
    } else if (angle < reverse) {
      return 'sharp_right';
    } else if (angle <= 360 - reverse) {
      return 'u_turn';
    } else if (angle <= 360 - sharp) {
      return 'sharp_left';
    } else if (angle <= 360 - regular) {
      return 'left';
    } else {
      return 'slight_left';
    }
  }
  return 'straight';
}
	
function convertBrouterRoundabout(route) {
    if(!route.points.length) {
	return;
    }
    const points = route.points;
    let startOfRoundabout = 0;
    let lastBearing = 0;
    let lastAngle = 0;
    // to keep it simple assume that first and last point are not part
    // of a roundabout
    for(let i = 1; i < points.length - 1; i++) {
	let point = points[i];
	// Bearing is the compass direction the route is traveling
	// 0° - north; 90° - east; 180° - south; 270° - west
	let bearing = azimuth(point, points[i+1]);
	if(point.turn === 'danger' && point.name && point.name.match(/^Exit -?[0-9]+$/)) {
	    startOfRoundabout = i;
	} else if(startOfRoundabout) {
	    const bearingChange = bearing - lastBearing;

	    // this should be a roundabout. Assuming a reasonably detailed point
	    // list any part inside the circle should have a rather low change 
	    // in bearing. But a abrupt strong bearing change indicates 
	    // leaving the Roundabout.
	    // Known Weakness: If the Roundabout start&ends with kind of an Y-Design
	    // of the road (e.g. https://bikerouter.de/#map=19/45.52688/9.00976/standard)
	    // This detection fails and also may lead to invalid direction
	    if(Math.abs(bearingChange) > 35  && Math.abs(bearingChange) < 355 /*degree*/) {
		const preBearing = azimuth(points[startOfRoundabout-1], points[startOfRoundabout]);
		const afterBearing = azimuth(point, points[i+1]);
		const angle = (afterBearing - preBearing + 360) % 360;
		points[startOfRoundabout].turn = turnMapping(angle);
		startOfRoundabout = 0;
	    } else if(point.turn || (point.distance - points[startOfRoundabout].distance) > 250) {
		// Limit the search to a reasonable circle radius or until
		// (or the next existing note)
		startOfRoundabout = 0;
	    }
	}
	lastBearing = bearing;
    }

}
