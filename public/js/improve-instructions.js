
/**
 * Search alle turn instructions to include additional notes that make
 * them more useable on the road.
 *
 * Actions taken:
 * - if a L and R (or R and L) follow within a short distance
 *   add a note about the upcoming second turn on the first one.
 *   Note: This is purely based on personal preference and trying out if
 *   this function is actually useful.
 *
 * Argument: incremental: Only apply actions that make sense after the
 * user edited some turn
 */
export function improveInstructions(route, incremental) {
    console.info('call insertDoubleTurnNote');
    insertDoubleTurnNote(route);
    if(!incremental) {
	// currently nothing to filter out
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
