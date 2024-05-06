/* jshint esversion: 6 */

import * as Overpass from './overpass.js';

Number.prototype.toRad = function () {
  return (this * Math.PI) / 180;
};

Number.prototype.toDeg = function () {
  return (this * 180) / Math.PI;
};

// Move point by angle for dist km
// src: https://stackoverflow.com/questions/2637023/how-to-calculate-the-latlng-of-a-point-a-certain-distance-away-from-another
function destinationPoint(point, brng, dist) {
  dist = dist / 6371;
  brng = brng.toRad();

  let lat1 = point.lat.toRad(),
    lon1 = point.lon.toRad();

  let lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));

  let lon2 =
    lon1 +
    Math.atan2(Math.sin(brng) * Math.sin(dist) * Math.cos(lat1), Math.cos(dist) - Math.sin(lat1) * Math.sin(lat2));

  if (isNaN(lat2) || isNaN(lon2)) return null;
  return { lat: lat2.toDeg(), lon: lon2.toDeg() };
}

function isInverseBearing(from, to, expected) {
  const bearing = L.GeometryUtil.bearing(L.latLng(from.lat, from.lon), L.latLng(to.lat, to.lon));
  return Math.abs(bearing - expected) > 120;
}

// douglas-pecker simplification of input route
function doSimplify(points, distance) {
  // convert format
  let xy = points.map((p) => {
    return { x: p.lat, y: p.lon };
  });
  let simple = L.LineUtil.simplify(xy, 0.0001);
  // convert back
  return simple.map((p) => {
    return { lat: p.x, lon: p.y };
  });
}

function ccw(A, B, C) {
  return (C.lon - A.lon) * (B.lat - A.lat) > (B.lon - A.lon) * (C.lat - A.lat);
}

//Return true if line segments AB and CD intersect
// Source: https://stackoverflow.com/questions/3838329/how-can-i-check-if-two-segments-intersect
function intersect(A, B, C, D) {
  return ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);
}

/**
 * turns tend to create loops inside the simple offset logic; While
 * inverseBearing() filter some it can't catch all.
 *
 * So simply search for points where the line intersects itself and cut
 * those.
 */
function removeLoops(points, distance) {
  const distanceLimit = 4 * distance * 1000; // meters
  for (let pos = 0; pos < points.length - 2; pos++) {
    // select a segment
    let start = points[pos];
    let startLatLng = L.latLng(start.lat, start.lon);
    let next = points[pos + 1];
    let previous = next;
    // now search for loops
    for (let i = pos + 2, cnt = 0; i < points.length; i++, cnt++) {
      let current = points[i];
      // stop loop once we far away from starting point
      if (cnt > 15 || startLatLng.distanceTo([current.lat, current.lon]) > distanceLimit) {
        break;
      }
      if (intersect(start, next, current, previous)) {
        // remove all points involved in the loop
        points.splice(pos + 1, cnt + 1);
        // restart this search for nested loops
        pos--;
        break;
      }
      previous = current;
    }
  }
  return points;
}

/**
 * Search for strange spikes in the route; Reason are like the loop
 * problem but less extrem.
 *
 */
function removeSpikes(points, distance) {
  const distanceLimit = 4 * distance * 1000; // meters
  for (let pos = 0; pos < points.length - 2; pos++) {
    // select two points
    let start = points[pos];
    let startLatLng = L.latLng(start.lat, start.lon);
    let next = points[pos + 1];
    let startDistance = startLatLng.distanceTo([next.lat, next.lon]);
    // now search for a point that is nearer then next
    for (let i = pos + 2, cnt = 0; i < points.length; i++, cnt++) {
      let current = points[i];
      // stop loop once we far away from starting point
      // or many edges because spike are 95% only 3 points
      if (cnt > 4 || startLatLng.distanceTo([current.lat, current.lon]) > distanceLimit) {
        break;
      }
      if (startLatLng.distanceTo([current.lat, current.lon]) < startDistance) {
        // remove all points involved in this spike
        points.splice(pos + 1, cnt + 1);
        break;
      }
    }
  }
  return points;
}

/**
 * Convert a Route into a "stream" of width distance*2 to get
 * a bounding box for poi searching
 */
export function getBoundingBox(points, distance) {
  let list1 = [];
  let list2 = [];
  // doing simplification first removes problems on turns
  // with overlapping results
  points = doSimplify(points);

  // p1 is the 'northern' bound;  p2 is the 'southern' bound
  // of course if the track is north-south instead of east-west this
  // flips but the idea stays the same
  let lastP1 = null;
  let lastP2 = null;
  for (let i = 0; i < points.length - 1; i++) {
    const point = points[i];
    const nextPoint = points[i + 1];
    const routeBearing = L.GeometryUtil.bearing(L.latLng(point.lat, point.lon), L.latLng(nextPoint.lat, nextPoint.lon));
    const p1 = destinationPoint(point, routeBearing - 90, distance);
    const p2 = destinationPoint(point, routeBearing + 90, distance);
    if (!p1 || !p2) {
      console.warn('could not move point!', point);
      continue;
    }

    // on hard turns the new point might be below the 'northern' border; we can
    // see this if the Bearing from the last point is inverse
    if (lastP1 && isInverseBearing(lastP1, p1, routeBearing)) {
      // then simply skip point
    } else {
      list1.push(p1);
      lastP1 = p1;
    }

    if (lastP2 && isInverseBearing(lastP2, p2, routeBearing)) {
      // ignore
    } else {
      list2.push(p2);
      lastP2 = p2;
    }
  }
  list1 = removeSpikes(removeLoops(list1, distance), distance);
  list2 = removeSpikes(removeLoops(list2, distance), distance);
  // the last point has no bearing add it 'solo'
  list1.push({ lat: points[points.length - 1].lat, lon: points[points.length - 1].lon });
  // add lower line to close loop
  list1.push.apply(list1, list2.reverse());

  // the merge might create a final loop
  list1 = removeLoops(list1, distance);

  return list1;
}
