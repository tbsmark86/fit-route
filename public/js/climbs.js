

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

    calcGrade(points, config)
    {
	const isClimb = this.isClimb;
	const minGrade = config.minClimbGrade;

	// only consider real climb parts for average
	let filteredDistance = 0;
	let filteredHeight = 0;

	let rollingDistance = 0;
	let rollingHeight = 0;

	let maxGrade = 0;


	for(let idx = this.startPoint + 1; idx < this.endPoint; idx++) {
	    const point = points[idx];
	    const lastPoint = points[idx - 1];

	    const eleDelta = point.deltaEle;
	    const distance = point.deltaDistance;
	    const grade = point.grade;

	    // Ignore opposite direction
	    if(
		(isClimb && grade < 0) ||
		(!isClimb && grade > 0)
	    ) {
		rollingDistance = 0;
		rollingHeight = 0;
		continue;

	    }

	    // Calculate maxGrade only over stretches of at least 20 meters
	    // to avoid Artifacts with very close points.
	    rollingDistance += distance;
	    rollingHeight += eleDelta;
	    if(rollingDistance > 20) {
		maxGrade = Math.max(maxGrade, Math.abs((rollingHeight / rollingDistance) * 100));
		rollingDistance = 0;
		rollingHeight = 0;
	    }

	    // Ignore flat sections for average calculation
	    if(Math.abs(grade) > minGrade) {
		filteredDistance += distance;
		filteredHeight += eleDelta;
	    }
	}
	if(!isClimb) {
	    maxGrade = -maxGrade;
	}
	const avgGrade = (filteredHeight / filteredDistance) * 100;
	return [avgGrade, maxGrade];
    }


}

/** Data shared between different steps while finding climbs */
class ClimbFinder
{
    static defaultConfig = {
	/* While not already into a conjected climb consider
	 * every gradient below that as flat */
	considerAsFlatTill: 1.5,

	/* Where to End a Climb ?
	 * - All condition for climbs are applyed anlog for descents 
	 */

	/* Once inside a climb required at least this grade to be
	 * still part of the climb */
	minClimbGrade: 1,
	/* End Mode a) now level after this distance */
	considerAsLeveledOfDistance: 1000,
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
	 * - All condition for climbs are applyed anlog for descents 
	 */
	useClimbs: true,
	useDescents: true,
	addEndpoint: true,
	/* total climb in meters */
	ignoreAscentLessThen: 80,
	/* average grade */
	ignoreAscentGradesLessThen: 4,
	/* max grade (at least 10m gain) */
	butKeepAscentMaxGrade: 10,
	
	/* Restore shallow climbs but with lots of climbing */
	butKeepAvgGradeLongAscent: 3,
	longAscentMin: 400,

	/* total descent in meters */
	ignoreDescentLessThen: 100,
	/* average grade  */
	ignoreDescentGradesLessThen: -5,
	/* max grade (at least 10m loss) */
	butKeepDescentMaxGrade: -8,
    };

    constructor(points, config)
    {
	this.config = config || ClimbFinder.defaultConfig;
    }

    hasLeveledOf(cur, curEnd, idx)
    {
	const config = this.config;
	if(curEnd.distance < config.considerAsLeveledOfDistance) {
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
	//console.debug('endClimbLeveldOf', idx, curEnd, scaledLimit);
	return true;
    }

    hasPeaked(cur, curEnd, idx)
    {
	const config = this.config;
	const eleDelta = cur.isClimb ? curEnd.descent : curEnd.ascent;
	if(eleDelta < config.considerAsPeakAfterDescent) {
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
	//console.debug('endClimbPeak', idx, curEnd, scaledLimit);
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

	// faster local 'copy'
	const points = this.points;
	const config = this.config;
	for(let idx = 1; idx < points.length; idx++) {
	    const point = points[idx];

	    const eleDelta = point.deltaEle;
	    if(eleDelta === 0 && cur === null) {
		continue;
	    }
	    const distance = point.deltaDistance;
	    const grade = point.grade

	    if(cur === null) {
		if(Math.abs(grade) < config.considerAsFlatTill) {
		    // skip over very slow changes; even if they lead into a real climb.
		    continue;
		}
		cur = new Segment(idx - 1, distance, eleDelta);
		curEnd = null;
		continue;
	    }

	    // Check if the climb is ended
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
		// require at least 2 consecutive points of climb/drop
		// to do any detailed investigation unless this first
		// point is unusually long
		//
		// This should filter out many small bumbs from the cacluation
		cur = null;
		continue;
	    }

	    if(checkForClimbEnd) {
		if(!curEnd) {
		    curEnd = new Segment(idx - 1, distance, eleDelta);
		} else {
		    curEnd.addPoint(distance, eleDelta);
		}

		if(
		    this.hasLeveledOf(cur, curEnd, idx)  ||
		    this.hasPeaked(cur, curEnd, idx)
		) {
		    cur.endPoint = curEnd.startPoint;
		    this.processClimb(cur);

		    // Consider the ignored part again; could be something
		    // on its own.
		    // But be careful with edge case of climb consisting only of
		    // two points - don't create endless loops!
		    idx = Math.max(cur.endPoint - 1, cur.startPoint + 1);

		    // reset current climb
		    cur = null;
		}
		continue;
	    } else if(curEnd) {
		// continue climb after short shallow/descent stretch
		cur.addSegment(curEnd);
		curEnd = null;
	    }
	    cur.addPoint(distance, eleDelta);
	}

	if(cur !== null) {
	    cur.endPoint = points.length - 1;
	    this.processClimb(cur);
	}
    }

    processClimb(segment)
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

	let avgGrade, maxGrade;
	if(!ignoreClimb) {
	    // This is the opposite of the hasLeveldOf/hasPeaked test to end a climb: 
	    // If a change started with short descent (or ascent) but has then switched
	    // split of this initial part as a separate Segment.
	    const trimed = segment.trimOppositeStart(points);
	    if(trimed) {
		this.processClimb(trimed);
	    }

	    [avgGrade, maxGrade] = segment.calcGrade(points, this.config);
	    
	    if(segment.isClimb) {
		ignoreClimb =
		    avgGrade < this.config.ignoreAscentGradesLessThen &&
		    maxGrade < this.config.butKeepAscentMaxGrade;

		if(ignoreClimb && 
		    segment.ascent > this.config.longAscentMin &&
		    avgGrade > this.config.butKeepAvgGradeLongAscent
		) {
		    ignoreClimb = false;
		}
	    } else {
		// less then in this context means shallower then
		ignoreClimb =
		    avgGrade > this.config.ignoreDescentGradesLessThen &&
		    maxGrade > this.config.butKeepDescentMaxGrade;
	    }
	}

	if(ignoreClimb) {
	    //console.debug('ignoreClimb', segment, avgGrade, maxGrade);
	    return;
	}

	//console.debug('useClimb', segment, avgGrade, maxGrade);
	this.insertClimb(segment, avgGrade, maxGrade);
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

    insertClimb(segment, avgGrade, maxGrade)
    {
	const originalPoints = this.originalPoints;

	const startPointIndex = this.points[segment.startPoint].origIndex;
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

	let meterFormat = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'meter', maximumFractionDigits: 0, unitDisplay: 'narrow' });
	let kmFormat = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'kilometer', maximumFractionDigits: 1, unitDisplay: 'narrow' });
	let percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 });

	// Climb Point similar to tdf but increase the scale a bit
	// Tdf should be more like 600/300/150/75
	const eleDelta = segment.relevantHeight;
	if(segment.isClimb) {
	    const climbPoints = (segment.distance / 1000) * Math.pow(avgGrade);
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
	targetPoint.name = `${meterFormat.format(segment.relevantHeight)}/${kmFormat.format(segment.distance / 1000)} ⌀:${percentFormat.format(avgGrade/100)} Max:${percentFormat.format(maxGrade/100)}`;
	console.warn(targetPoint.turn, targetPoint.name);

	if(segment.distance < 2000) {
	    // no end marker for short climbs
	    return;
	}

	const endPointIndex = this.points[segment.endPoint].origIndex;
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
	targetPoint.turn = 'summit';
	targetPoint.name = 'Done!';
    }

    loadPointsBasic(inputPoints)
    {
	this.originalPoints = inputPoints;

	this.points = [];

	// Just pass input points through ensuring every point can be used
	// in calculations
	let lastEle = NaN;
	let lastDistance = 0;
	inputPoints.forEach((point, idx) => {
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
	this.calcPointInfo()
    }

    calcPointInfo()
    {
	const points = this.points;
	this.points.deltaDistance = 0;
	this.points.deltaEle = 0;
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
	let newPoints;
	let points = this.points;

	newPoints = [];
	for(let idx = 1; idx < points.length; idx++) {
	    const point = points[idx];
	    const prevPoint = points[idx - 1];

	    // combine a points with very short distance with it's predecessor
	    // in a hope to smooth out gradients created by elevation over very
	    // short distances
	    if(
		((prevPoint.deltaDistance + point.deltaDistance) < 15) ||
		// sum is already above target but keep join in extremely short
		// segments
		(point.deltaDistance < 1) || (prevPoint.deltaDistance < 1)

	    ) {
		if(
		    // only merge if prev point has elevation change in same direction
		    (point.deltaEle > 0 && prevPoint.deltaEle > 0) ||
		    (point.deltaEle == 0 && prevPoint.deltaEle == 0) ||
		    (point.deltaEle < 0 && prevPoint.deltaEle < 0)
		) {
		    newPoints.pop();
		    point.deltaDistance += prevPoint.deltaDistance;
		    newPoints.push(point);
		    continue;
		}
	    }
	    newPoints.push(point);
	}

	console.log('joined', points.length, 'down to', newPoints.length);

	this.points = points = newPoints;
	// update Info
	this.calcPointInfo();

	// Smooth out oscillating elevation
	// The Idea is to check all groups of points the idea is that
	// an actually wavy road (in the mater of a few meters) is rather rare
	// and more likely some rounding errors on height calculation.
	//
	// The effect for findClimbs() is that those small changes in climbing
	// direction won't constantly interrupt the search for stretches.
	let smoothed = 0;
	for(let idx = 2; idx < points.length; idx++) {
	    const point1 = points[idx - 2];
	    const point2 = points[idx - 1];
	    const point3 = points[idx];
	    if(Math.abs(point1.ele - point3.ele) < 0.5 &&
		(
		    (point2.ele > point1.ele && point2.ele > point3.ele) ||
		    (point2.ele < point1.ele && point2.ele < point3.ele)
		) &&
		point2.deltaDistance < 20 &&  point3.deltaDistance < 20
	    ) {
		point2.ele = (point1.ele + point3.ele) / 2.0;
		smoothed++;
	    }
	}
	console.log('flattend peaks/valleys', smoothed);

	// update Info
	this.calcPointInfo();


	/*
	// TODO howto flatten surreal grades?
	for(let idx = 0; idx < points.length; idx++) {
	    const point = points[idx];
	    if(Math.abs(point.grade) > 30) {
		console.log(points[idx-1], point, points[idx+1]);
	    }
	}*/

    }
}


/** Analyse Track and create "turn"-hints with info about
 *  upcoming climbs. A poor-mans-climb-pro feature. */
export function findClimbs(points, config)
{
    const processor = new ClimbFinder(config);
    processor.loadPointsBasic(points);
    processor.smoothPoints();
    processor.findClimbs();
}
