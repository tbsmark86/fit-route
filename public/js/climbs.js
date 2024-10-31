/* jshint esversion: 9*/
/** Helper to group stats about current stretch of points we're analysing.
 *  start/endPoint are index into the points array. */
class Segment {
    constructor(startPoint, distance, eleDelta) {
	this.startPoint = startPoint;
	this.endPoint = null;
	this.distance = distance;
	this.ascent = eleDelta > 0 ? eleDelta : 0;
	this.descent = eleDelta < 0 ? -eleDelta : 0;
    }
    /* Is this a climb or a descent */
    get isClimb() {
	return this.ascent > this.descent;
    }
    /* get Ascent or Descent value fitting segment type */
    get relevantHeight() {
	return this.isClimb ? this.ascent : this.descent;
    }
    get otherHeight() {
	return this.isClimb ? this.descent : this.ascent;
    }

    addPoint(distance, eleDelta)
    {
	this.distance += distance;
	this.ascent += eleDelta > 0 ? eleDelta : 0;
	this.descent += eleDelta < 0 ? -eleDelta: 0;
    }

    removePoint(distance, eleDelta)
    {
	this.distance -= distance;
	this.ascent -= eleDelta > 0 ? eleDelta : 0;
	this.descent -= eleDelta < 0 ? -eleDelta: 0;
    }

    addSegment(other)
    {
	this.distance += other.distance;
	this.ascent += other.ascent;
	this.descent += other.descent;
    }

    trimOppositeStart(points)
    {
	const isClimb = this.isClimb;
	let trimed = new Segment(this.startPoint, 0, 0);
	
	for(let idx = this.startPoint + 1; idx < this.endPoint; idx++) {
	    const point = points[idx];
	    const distance = point.deltaDistance;
	    const eleDelta = point.deltaEle;
	    if(
		eleDelta === 0 ||
		(isClimb && eleDelta < 0) ||
		(!isClimb && eleDelta > 0)
	    ) {
		// transfer this point
		trimed.addPoint(distance, eleDelta);
		trimed.endPoint = idx;
		this.startPoint = idx;
		this.removePoint(distance, eleDelta);
	    } else {
		break;
	    }
	}
	if(trimed.distance == 0) {
	    // nothing trimed
	    trimed = null;
	}
	return trimed;
    }

    trimAfterMax(points)
    {
	let val;
	let trimPoint = 0;
	if(this.isClimb) {
	    val = Number.MIN_SAFE_INTEGER;
	    for(let idx = this.startPoint + 1; idx <= this.endPoint; idx++) {
		const point = points[idx];
		if(point.ele > val) {
		    val = point.ele;
		    trimPoint = idx;
		}
	    }
	} else {
	    val = Number.MAX_SAFE_INTEGER;
	    for(let idx = this.startPoint + 1; idx <= this.endPoint; idx++) {
		const point = points[idx];
		if(point.ele < val) {
		    val = point.ele;
		    trimPoint = idx;
		}
	    }
	}
	let oldEnd = this.endPoint;
	this.endPoint = trimPoint;
	for(let idx = oldEnd +1; idx < this.endPoint; idx++) {
	    this.removePoint(points[idx].deltaDistance, points[idx].deltaEle);
	}
    }

    calcAvgGrade(points, config)
    {
	const isClimb = this.isClimb;
	const minGrade = config.minClimbGrade;

	// only consider real climb parts for average
	let filteredDistance = 0;
	let filteredHeight = 0;

	for(let idx = this.startPoint + 1; idx <= this.endPoint; idx++) {
	    const point = points[idx];

	    const eleDelta = point.deltaEle;
	    const distance = point.deltaDistance;
	    let grade = point.grade;

	    // Ignore opposite direction
	    if(
		(isClimb && grade < 0) ||
		(!isClimb && grade > 0)
	    ) {
		continue;
	    }
	    // limit effect of parts with absurd grade
	    // e.g. this happens for tracks trough short tunnels
	    grade = Math.max(25, Math.min(-25, grade));

	    // Ignore flat sections for average calculation
	    if(Math.abs(grade) > minGrade) {
		filteredDistance += distance;
		filteredHeight += eleDelta;
	    }
	}
	let avgGrade;
	if(filteredDistance) {
	    avgGrade = (filteredHeight / filteredDistance) * 100;
	} else {
	    // can happen on short segments
	    avgGrade = (this.relevantHeight / this.distance) * 100;
	}
	return avgGrade;
    }


}

/** Data shared between different steps while finding climbs */
class ClimbFinder
{
    static defaultConfig = {
	/* While not already into a suspected climb consider
	 * every gradient below that as flat */
	considerAsFlatTill: 1.5,

	/* Where to End a Climb ?
	 * - All condition for climbs are applied analog for descents 
	 */

	/* Once inside a climb required at least this grade to be
	 * still part of the climb */
	minClimbGrade: 1,
	/* End Mode a) now level after this distance */
	considerAsLeveledOfDistance: 500,
	/* Increase the minimum distance by this * totalAscent */
	considerAsLeveledOfFactor: 1.5,
	/* Up to this max value */
	considerAsLeveledOfFactorMax: 2000,

	/* End Mode b) max allowed Drop (meters) */
	considerAsPeakAfterDescent: 20,
	/* Increase allowed descent by this * totalAscent */
	considerAsPeakAfterDescentFactor: 0.1,
	/* Up to this; 150m Default because of Timmelsjoch! */
	considerAsPeakAfterDescentFactorMax: 150,

	/* Which climbs to Mark ?
	 * - All condition for climbs are applied analog for descents 
	 */
	useClimbs: true,
	useDescents: true,
	addEndpoint: true,
	/* total climb in meters */
	ignoreAscentLessThen: 80,
	/* average grade */
	ignoreAscentGradesLessThen: 4,
	
	/* Restore shallow climbs but with lots of climbing */
	butKeepAvgGradeLongAscent: 3,
	longAscentMin: 400,

	/* total descent in meters */
	ignoreDescentLessThen: 100,
	/* average grade  */
	ignoreDescentGradesLessThen: -5,

	/* Smooth? */
	smoothing: true,
    };
    /* Config changes */
    static presets = {
	climbs_all: {
	    considerAsFlatTill: 0.8,
	    ignoreAscentLessThen: 20,
	    ignoreAscentGradesLessThen: 2,
	},
	climbs_medium: {
	    considerAsFlatTill: 1,
	    ignoreAscentLessThen: 50,
	    ignoreAscentGradesLessThen: 3,
	},
	climbs_none: {
	    useClimbs: false
	},
	descents_all: {
	   considerAsFlatTill: 1,
	   ignoreAscentLessThen: 30,
	   ignoreAscentGradesLessThen: 2,
	},
	descents_medium: {
	   ignoreAscentLessThen: 50,
	   ignoreAscentGradesLessThen: 3,
	},
	descents_none: {
	    useDescents: false
	},
	end_short: {
	    considerAsLeveledOfDistance: 250,
	    considerAsLeveledOfFactor: 1,
	    considerAsLeveledOfFactorMax: 1000,

	    considerAsPeakAfterDescent: 10,
	    //considerAsPeakAfterDescentFactor: 0.1,
	    considerAsPeakAfterDescentFactorMax: 75,
	},
	end_long: {
	    considerAsLeveledOfDistance: 750,
	    considerAsLeveledOfFactor: 2,
	    considerAsLeveledOfFactorMax: 3000,

	    considerAsPeakAfterDescent: 30,
	    considerAsPeakAfterDescentFactor: 0.2,
	    considerAsPeakAfterDescentFactorMax: 200,
	}
    };

    constructor()
    {
	this.config = {...ClimbFinder.defaultConfig};
	this.created = 0;
    }
 
    applyPreset(preset) 
    {
	const presetData = ClimbFinder.presets[preset];
	if(presetData) {
	    this.config = {...this.config, ...presetData};
	}
    }

    applyPresets(presets)
    {
	if(presets.climbs) {
	    this.applyPreset(`climbs_${presets.climbs}`);
	}
	if(presets.descents) {
	    this.applyPreset(`descents_${presets.descents}`);
	}
	if(presets.end) {
	    this.applyPreset(`end_${presets.end}`);
	}
    }


    hasLeveledOf(cur, curEnd, idx)
    {
	const config = this.config;
	if(curEnd.distance > cur.distance * 0.5) {
	    // if the flat distance after the climb is almost the
	    // length of the climb itself it certainly has level of
	    // This is primarily intended to cut of very short climbs
	    // early
	    return true;
	} else if(curEnd.distance < config.considerAsLeveledOfDistance) {
	    // No: below absolute minimum distance
	    return false;
	}
	const scaledLimit = Math.min(config.considerAsLeveledOfDistance +
		(config.considerAsLeveledOfFactor * cur.relevantHeight),
		config.considerAsLeveledOfFactorMax);
	if(curEnd.distance < scaledLimit) {
	    // No: below scaled minimum distance
	    // (aka the higher the climb the more short drop/stop is allowed)
	    return false;
	}
	this.debug.log('endClimbLeveldOf', idx, curEnd, scaledLimit);
	return true;
    }

    hasPeaked(cur, curEnd, idx)
    {
	const config = this.config;
	const eleDelta = cur.isClimb ? curEnd.descent : curEnd.ascent;
	if(eleDelta > cur.relevantHeight * 0.5) {
	    // already descended half of the ascent: thats clearly after the peak
	    // This is important for very flat terrain we're all climbs stay 
	    // below the considerAsPeakAfterDescent value.
	    return true;
	} else if(eleDelta < config.considerAsPeakAfterDescent) {
	    // No: below absolute minimum drop/climb after climb/drop
	    return false;
	}
	const scaledLimit = Math.min(config.considerAsPeakAfterDescent +
	    (config.considerAsPeakAfterDescentFactor * cur.relevantHeight),
	    config.considerAsPeakAfterDescentFactorMax);

	if(eleDelta < scaledLimit) {
	    // No: below scaled minimum drop/climb
	    // (aka the higher the climb the more short drop/stop is allowed)
	    return false;
	}
	this.debug.log('endClimbPeak', idx, curEnd, scaledLimit);
	return true;
    }

    findClimbs()
    {
	if(this.points.length < 1) {
	    // sanity check
	    return;
	}

	// Currently considered climb(segment)
	let cur = null;
	// The _possible_ end point of the cur climb; if it turns out
	// not to be the end we need to still keep track of stats to copy
	// them over
	let curEnd = null;
	let stickToEnd;

	// faster local 'copy'
	const points = this.points;
	const config = this.config;
	for(let idx = 1; idx < points.length; idx++) {
	    const point = points[idx];

	    this.debug.mapNote(idx);

	    const eleDelta = point.deltaEle;
	    if(eleDelta === 0 && cur === null) {
		continue;
	    }
	    const distance = point.deltaDistance;
	    const grade = point.grade;

	    if(cur === null) {
		if(Math.abs(grade) < config.considerAsFlatTill) {
		    // skip over very slow changes; even if they lead into a real climb.
		    continue;
		}
		cur = new Segment(idx - 1, distance, eleDelta);
		this.debug.point(idx, 'start');
		curEnd = null;
		continue;
	    }

	    // Check if the climb has ended
	    let checkForClimbEnd = false;
	    if(cur.isClimb) {
		// this also includes descent
		if(grade < config.minClimbGrade) {
		    checkForClimbEnd = true;
		}
	    } else {
		if(Math.abs(grade) < config.minClimbGrade || grade > 0) {
		    checkForClimbEnd = true;
		}
	    }
	    if(checkForClimbEnd && !curEnd && cur.distance < 50) {
		this.debug.point(cur.startPoint, 'bump');
		// require at least 2 consecutive points of climb/drop
		// to do any detailed investigation unless this first
		// point is unusually long
		//
		// This should filter out many small bumps from the calculation
		cur = null;
		continue;
	    }

	    if(checkForClimbEnd) {
		if(!curEnd) {
		    curEnd = new Segment(idx - 1, distance, eleDelta);
		    this.debug.point(idx - 1, 'check-end');
		} else {
		    curEnd.addPoint(distance, eleDelta);
		}
		// like the segment that does not end instantly also allow
		// the end segment up to 2 points of slack.
		stickToEnd = 2;

		if(
		    this.hasLeveledOf(cur, curEnd, idx)  ||
		    this.hasPeaked(cur, curEnd, idx)
		) {
		    cur.endPoint = curEnd.startPoint - 1;
		    if(!this.tryInsertClimb(cur)) {
			this.debug.point(idx, 'do-end');
		    } else {
			this.debug.point(cur.startPoint, 'used-start');
			this.debug.point(cur.endPoint, 'used-end');
		    }
		    // Consider everything after the final tested Segment again
		    // for a new Segment.
		    // But be careful with edge case of climb consisting only of
		    // two points - don't create endless loops!
		    idx = Math.max(cur.endPoint - 1, cur.startPoint + 1);

		    // reset current climb
		    cur = curEnd = null;
		}
		continue;
	    } else if(curEnd) {
		if(stickToEnd) {
		    stickToEnd--;
		    curEnd.addPoint(distance, eleDelta);
		    continue;
		}

		// continue climb after short shallow/descent stretch
		cur.addSegment(curEnd);
		curEnd = null;
		this.debug.point(idx, 'no-end');
	    }
	    cur.addPoint(distance, eleDelta);
	}

	if(cur !== null) {
	    cur.endPoint = points.length - 1;
	    this.tryInsertClimb(cur);
	}
    }

    tryInsertClimb(segment)
    {
	while(segment.endPoint - segment.startPoint > 1) {
	    if(this._tryInsertClimb(segment)) {
		return true;
	    }
	    // Trim of first point and try again if the Segment matches
	    // required conditions (because the avgGrade may now be higher)
	    const toRemove = this.points[segment.startPoint + 1];
	    segment.removePoint(toRemove.deltaDistance, toRemove.deltaEle);
	    segment.startPoint++;
	}
	return false;
    }

    _tryInsertClimb(segment)
    {
	const points = this.points;

	let ignoreClimb = false;
	if(segment.isClimb) {
	    ignoreClimb = !this.config.useClimbs ||
		segment.ascent < this.config.ignoreAscentLessThen;
	} else {
	    ignoreClimb = !this.config.useDescents ||
		segment.descent < this.config.ignoreDescentLessThen;
	}

	let avgGrade;
	if(!ignoreClimb) {
	    // This is the opposite of the hasLeveldOf/hasPeaked test to end a climb: 
	    // If a change started with short descent (or ascent) but has then switched
	    // split of this initial part as a separate Segment.
	    const trimed = segment.trimOppositeStart(points);
	    if(trimed) {
		this._tryInsertClimb(trimed);
	    }
	    // Let the segment end at the highest/lowest point; this should
	    // be the default of course but due to unclean data and findClimbs end-overshoot
	    // sometimes there is extra stuff
	    segment.trimAfterMax(points);

	    // Note: getting the MaxGrade would also be very interesting but the route
	    // data is often very unclean on this due to problems with the used height map
	    // for the earth surface (the resolution).
	    // In tight valley there are often extrem jumps on some points due to this
	    // which would result in absurd values for max grade.
	    // For example the test track on the 'Klausen pass' has grades up to 150%
	    // => Solution: Don't output values that can't be trusted.
	    avgGrade = segment.calcAvgGrade(points, this.config);

	    if(segment.isClimb) {
		ignoreClimb = avgGrade < this.config.ignoreAscentGradesLessThen;

		if(ignoreClimb && 
		    segment.ascent > this.config.longAscentMin &&
		    avgGrade > this.config.butKeepAvgGradeLongAscent
		) {
		    ignoreClimb = false;
		}
	    } else {
		// less then in this context means shallower then
		ignoreClimb = avgGrade > this.config.ignoreDescentGradesLessThen;
	    }
	}

	if(ignoreClimb) {
	    this.debug.log('ignoreClimb', segment, avgGrade);
	    return false;

	}

	this.debug.log('useClimb', segment, avgGrade);
	this.insertClimb(segment, avgGrade);
	return true;
    }

    findFreePoint(points, start, searchDistance, direction, skipMore)
    {
	let sumDistance = 0;
	let foundPoint = null;
	if(direction === 'forward') {
	    // forward means earlier in the track
	    for(let idx = start - 1; idx >= 0; idx--) {
		const point = points[idx];
		const prevPoint = points[idx + 1];
		if(point.turn) {
		    // damn another nearby hint
		    if(skipMore <= 0) {
			return null;
		    }
		    skipMore--;
		    sumDistance = 0;
		    continue;
		}
		sumDistance += prevPoint.deltaDistance;
		if(sumDistance > searchDistance) {
		    return point;
		}
	    }
	} else {
	    for(let idx = start + 1; idx < points.length; idx++) {
		const point = points[idx];
		if(point.turn) {
		    // damn another nearby hint
		    if(skipMore <= 0) {
			return null;
		    }
		    skipMore--;
		    sumDistance = 0;
		    continue;
		}
		sumDistance += point.deltaDistance;
		if(sumDistance > searchDistance) {
		    return point;
		}
	    }

	}
	return null;
    }

    insertClimb(segment, avgGrade)
    {
	const originalPoints = this.originalPoints;

	const startPointIndex = this.points[segment.startPoint].origIndex;
	const endPointIndex = this.points[segment.endPoint].origIndex;

	let targetPoint = originalPoints[startPointIndex];
	if(targetPoint.turn) {
	    // There is already something here :/
	    targetPoint = this.findFreePoint(originalPoints, startPointIndex, 60, 'forward', 0);
	    if(targetPoint === null) {
		targetPoint = this.findFreePoint(originalPoints, startPointIndex, 60, 'backward', 0);
	    }
	    if(targetPoint === null) {
		targetPoint = this.findFreePoint(originalPoints, startPointIndex, 50, 'forward', 1);
	    }
	    if(targetPoint === null) {
		targetPoint = this.findFreePoint(originalPoints, startPointIndex, 50, 'backward', 1);
	    }
	    if(targetPoint === null) {
		targetPoint = this.findFreePoint(originalPoints, startPointIndex, 40, 'forward', 2);
	    }
	    if(targetPoint === null) {
		console.warn('cant find free pont to insert climb info', segment);
		return;
	    }
	}

	let meterFormat = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'meter', maximumFractionDigits: 0, unitDisplay: 'narrow', useGrouping: false });
	let kmFormat = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'kilometer', maximumFractionDigits: 1, unitDisplay: 'narrow', useGrouping: false });
	let percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', useGrouping: false });

	// Climb Point similar to tdf but increase the scale a bit
	// Tdf should be more like 600/300/150/75
	const eleDelta = segment.relevantHeight;
	if(segment.isClimb) {
	    const climbPoints = (segment.distance / 1000) * Math.pow(avgGrade, 2);
	    if(climbPoints > 800) {
		targetPoint.turn = 'hors_category';
	    } else if(climbPoints > 400) {
		targetPoint.turn = 'first_category';
	    } else if(climbPoints > 200) {
		targetPoint.turn = 'second_category';
	    } else if(climbPoints > 100) {
		targetPoint.turn = 'third_category';
	    } else {
		targetPoint.turn = 'fourth_category';
	    }
	} else {
	    targetPoint.turn = 'danger';
	}
	targetPoint._climb = true;
	const endHeight = originalPoints[endPointIndex].ele;
	const symbol = segment.isClimb ? '↑' : '↓';
	// not all locals 'narrow' are without space but we are heavily limited 
	// on space here so cut everything out.
	const endHeightStr = meterFormat.format(endHeight).replace(/\s/, '');
	const relevantHeightStr = meterFormat.format(segment.relevantHeight).replace(/\s/g, '');
	const distanceStr = kmFormat.format(segment.distance / 1000).replace(/\s/g, '');
	const avgGradeStr = percentFormat.format(avgGrade / 100).replace(/\s/g, '');
	targetPoint.name = `${endHeightStr}:${symbol}${relevantHeightStr} ${distanceStr} ${avgGradeStr}`;
	this.debug.log(targetPoint.turn, targetPoint.name);
	this.debug.log(startPointIndex);

	this.created++;

	if(segment.distance < 2000) {
	    // no end marker for short climbs
	    return;
	}

	targetPoint = originalPoints[endPointIndex];
	if(targetPoint.turn) {
	    // There is already something here :/
	    targetPoint = this.findFreePoint(originalPoints, endPointIndex, 60, 'forward', 0);
	    if(targetPoint === null) {
		targetPoint = this.findFreePoint(originalPoints, endPointIndex, 60, 'backward', 0);
	    }
	    // don't search so much for final point the user should probably get it himself :)
	    if(targetPoint === null) {
		console.warn('cant find free pont to insert climb-finish info', segment);
		return;
	    }
	}
	targetPoint.turn = segment.isClimb ? 'summit' : 'valley';
	targetPoint.name = 'Done!';
	targetPoint._climb = true;
    }

    loadPointsBasic(inputPoints)
    {
	this.originalPoints = inputPoints;

	this.points = inputPoints;
	this.points = [];

	// Just pass input points through ensuring every point can be used
	// in calculations
	let lastEle = NaN;
	let lastDistance = 0;
	inputPoints.forEach((point, idx) => {
	    if(point._climb) {
		// Clear previous run
		delete point.turn;
		delete point._climb;
	    }
	    if(lastDistance == point.distance) {
		// ignore duplicate points
		return;
	    }
	    lastDistance = point.distance;
	    let ele = point.ele;
	    if(isNaN(ele)) {
		// avoid missing ele by simply copying the last one
		ele = lastEle;
	    } else if(isNaN(lastEle)) {
		// special case: already first value was missing
		// fixup all missing ele up to this
		this.points.forEach((p) => p.ele = ele);
	    }
	    lastEle = ele;
	    this.points.push({
		origIndex: idx,
		distance: point.distance,
		ele: ele,
	    });
	});
	this.calcPointInfo();
    }

    calcPointInfo()
    {
	const points = this.points;
	this.points[0].deltaDistance = 0;
	this.points[0].deltaEle = 0;
	this.points[0].grade = 0;
	for(let idx = 1; idx < this.points.length; idx++) {
	    const point = points[idx];
	    const lastPoint = points[idx - 1];

	    // Not sure if the distance here also includes the climbing
	    // (triangle and so on) but it should really matte that much to
	    // we just need to be close enough
	    point.deltaDistance = point.distance - lastPoint.distance;
	    point.deltaEle = point.ele - lastPoint.ele;
	    point.grade = (point.deltaEle / point.deltaDistance) * 100;
	}
    }

    smoothPoints()
    {
	if(!this.config.smoothing) {
	    return;
	}
	let newPoints;
	let points = this.points;

	this.points = newPoints = [];
	for(let idx = 1; idx < points.length; idx++) {
	    const point = points[idx];
	    const prevPoint = points[idx - 1];

	    // combine a points with very short distance with it's predecessor
	    // in a hope to smooth out gradients created by elevation over very
	    // short distances
	    if(
		((prevPoint.deltaDistance + point.deltaDistance) < 25) ||
		// sum is already above target but keep joining extremely short
		// segments
		(point.deltaDistance < 2) || (prevPoint.deltaDistance < 2)

	    ) {
		if(
		    // only merge if prev point has elevation change in same direction
		    (point.deltaEle >= 0 && prevPoint.deltaEle > 0) ||
		    (point.deltaEle == 0 && prevPoint.deltaEle == 0) ||
		    (point.deltaEle <= 0 && prevPoint.deltaEle < 0)
		) {
		    newPoints.pop();
		    point.deltaDistance += prevPoint.deltaDistance;
		    newPoints.push(point);
		    this.debug.point(newPoints.length - 1, 'joined');
		    continue;
		}
	    }
	    newPoints.push(point);
	}

	this.debug.log('joined', points.length, 'down to', newPoints.length);

	this.points = points = newPoints;
	// update Info
	this.calcPointInfo();

	// Smooth out oscillating elevation
	// The Idea is to check for 'waves' in the points and to flatten
	// those out. Because likely those are just rounding errors in the
	// height calculation of the track.
	//
	// The effect for findClimbs() is that those small changes in climbing
	// direction won't constantly interrupt the search for stretches.
	function allow_smooth(point1, point2, point3, deltaEle, deltaDistance) {
	    return Math.abs(point1.ele - point3.ele) < deltaEle &&
		(
		    (point2.ele > point1.ele && point2.ele > point3.ele) ||
		    (point2.ele < point1.ele && point2.ele < point3.ele)
		) &&
		point2.deltaDistance < deltaDistance &&  point3.deltaDistance < deltaDistance;
	}
	//
	let smoothed = 0;
	for(let idx = 2; idx < points.length; idx++) {
	    const point1 = points[idx - 2];
	    const point2 = points[idx - 1];
	    const point3 = points[idx];
	    if(allow_smooth(point1, point2, point3, 0.5, 20) ||
	      allow_smooth(point1, point2, point3, 3, 10)
	    ) {
		point2.ele = (point1.ele + point3.ele) / 2.0;
		smoothed++;
		this.debug.point(idx - 1, 'smoothed');
	    }
	}
	this.debug.log('flattend peaks/valleys', smoothed);

	// update Info
	this.calcPointInfo();
    }
}

class DebugNone {
    point() {}
    mapNote() {}
    log() {}
}

/* Helper for Debug: Show Profile in extra window with Detail info */
class DebugActive {
    constructor(processor) {
	this.processor = processor;
    }

    point(idx, info) {
	const point = this.processor.points[idx];
	if(!point.debugInfo) {
	    point.debugInfo = new Set();
	}
	point.debugInfo.add(info);
    }

    mapNote(idx) {
	if((idx % 10) == 0) {
	    let point = this.processor.points[idx];
	    let origPoint = this.processor.originalPoints[point.origIndex];
	    origPoint.turn = 'danger';
	    origPoint.name = idx;
	}
    }

    log(...args) {
	console.debug('[Climbs]', ...args);
    }

    async display(name) {
	let title = 'Debug';
	if(name === 'initial') {
	    title = 'Raw Data';
	} else if(name === 'smooth') {
	    title = 'Smootehd Data';
	    if(!this.processor.config.smoothing) {
		return;
	    }
	} else if(name === 'climbs') {
	    title = 'Find Info';
	}

	const points = this.processor.points;

	const minEle = points.reduce((minCur, point) => Math.min(minCur, point.ele || minCur), 100000);
	const maxEle = points.reduce((maxCur, point) => Math.max(maxCur, point.ele || maxCur), -100000);
	const deltaEle = maxEle - minEle;
	this.log(`Display ${name} Min/Max`, minEle, maxEle);

	const win = window.open('about:blank', name || 'points');
	await (new Promise((done) => {
	    win.onload = done;
	}));
	DebugActive.registerCleanup(win);

	win.document.documentElement.innerHTML = `
	    <head>
		<title>${title}</title>
		<style>
		    body { font: 12px/1.0 monospace; }
		    .bar { border: 1px solid black; text-wrap: nowrap; }
		</style>
	    </head>
	    <body></body>`;
	const cont = win.document.body;

	const pxPerEle = (document.body.offsetWidth - 50) / deltaEle;
	let format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2, useGrouping: true });

	let i = 0;
	for(const point of points) {
	    i++;
	    const div = win.document.createElement('div');
	    div.classList.add('bar');
	    div.style.width = `${(point.ele - minEle) * pxPerEle}px`;
	    div.style.minHeight = `${point.deltaDistance * 0.1}px`;
	    let text = `${point.origIndex || i}: ${format.format(point.ele)} | ${format.format(point.deltaDistance)} | ${format.format(point.grade)}`;
	    if(point.debugInfo) {
		text += ' | ' + Array.from(point.debugInfo.values()).join(', ');
		// don't display this debug data again
		delete point.debugInfo;
	    }
	    div.innerText = text;
	    cont.appendChild(div);
	}
    }

    static activeWindows = [];
    static registerCleanup(win) {
	if(DebugActive.activeWindows.length === 0) {
	    window.addEventListener('pagehide', () => {
		DebugActive.activeWindows.forEach((w) => w.close());
		DebugActive.activeWindows = [];
	    });
	}
	DebugActive.activeWindows.push(win);
    }
}

/** Analyse Track and create "turn"-hints with info about
 *  upcoming climbs. A poor-mans-climb-pro feature. */
export function findClimbs(points, presets, debugRedraw)
{
    const processor = new ClimbFinder(points);
    processor.applyPresets(presets);
    processor.loadPointsBasic(points);
    if(window.location.hash.indexOf('debug_climbs') !== -1) {
	processor.debug = new DebugActive(processor);
	new Promise(async (done) => {
	    await processor.debug.display('initial');
	    processor.smoothPoints();
	    await processor.debug.display('smooth');
	    processor.findClimbs();
	    await processor.debug.display('climbs');
	    done();
	    debugRedraw();
	});
	return 1; /* fake result */
    }
    processor.debug = new DebugNone();
    processor.smoothPoints();
    processor.findClimbs();
    return processor.created;
}
