/* jshint esversion: 6 */
Number.prototype.toRad = function() {
   return this * Math.PI / 180;
};

Number.prototype.toDeg = function() {
   return this * 180 / Math.PI;
};

// Move point by angle for dist km
// src: https://stackoverflow.com/questions/2637023/how-to-calculate-the-latlng-of-a-point-a-certain-distance-away-from-another
function destinationPoint(point, brng, dist) {
    dist = dist / 6371;
    brng = brng.toRad(); 

    let lat1 = point.lat.toRad(), lon1 = point.lon.toRad();

    let lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + 
			Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));

    let lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) *
				Math.cos(lat1), 
				Math.cos(dist) - Math.sin(lat1) *
				Math.sin(lat2));

    if (isNaN(lat2) || isNaN(lon2)) return null;
    return {lat: lat2.toDeg(), lon: lon2.toDeg()};
}

function isInverseBearing(from, to, expected) {
    const bearing = L.GeometryUtil.bearing(L.latLng(from.lat, from.lon), L.latLng(to.lat, to.lon));
    return Math.abs(bearing - expected) > 120;
}

/**
 * Convert a Route into a "stream" of width distance*2 to get
 * a bounding box for poi searching
 */
export function getBoundingBox(points, distance) {
    let list1 = [];
    let list2 = [];
    distance = 0.2;
    // p1 is the 'northern' bound;  p2 is the 'southern' bound
    // of course if the track is north-south instead of east-west this
    // flips but the idea stays the same
    let lastP1 = null;
    let lastP2 = null;
    for(let i = 0; i < points.length - 1; i++) {
	const point = points[i];
	const nextPoint = points[i+1];
	const routeBearing = L.GeometryUtil.bearing(L.latLng(point.lat, point.lon), L.latLng(nextPoint.lat, nextPoint.lon));
	const p1 = destinationPoint(point, routeBearing - 90, distance);
	const p2 = destinationPoint(point, routeBearing + 90, distance);
	if(!p1 || !p2) {
	    console.warn('could not move point!', point);
	    continue;
	}

	// on hard turns the new point might be below the 'northern' border; we can
	// see this if the Bearing from the last point is inverse
	if(lastP1 && isInverseBearing(lastP1, p1, routeBearing)) {
	    // then simply skip point
	} else {
	    list1.push(p1);
	    lastP1 = p1;
	}

	if(lastP2 && isInverseBearing(lastP2, p2, routeBearing)) {
	    // ignore
	} else {
	    list2.push(p2);
	    lastP2 = p2;
	}
    }
    // the last point has no bearing add it 'solo'
    // list1.push({lat: points[points.length-1].lat, lon: points[points.length-1].lon});
    // add lower line to close loop
    list1.push.apply(list1, list2.reverse());

    return list1;
}
