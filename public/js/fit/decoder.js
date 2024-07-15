/* global Blob */
import { Mesg, mesgMap } from './mesg.js';
import { types, HEADER_LEN, MAGIC } from './types.js';

/**
 * Simple FIT reader that matches data written by ourself.
 * 
 * Fit-Format: https://developer.garmin.com/fit/protocol/
 */
export class FITDecoder {
    constructor() {
    }

    /* Only read Route Data out of fit ignore everything else */
    readRoute(buffer) {
	// re-init all values
	this.recordDefs = {};
	this.name = "";
	this.points = [];
	this.turns = [];
	this.eleGain = 0;
	this.eleLoss = 0;
	this.activity = false;

	if (buffer.byteLength < 12) {
	    throw new Error('File to small to be a FIT file');
	}

	const bytes = new DataView(buffer);
	let offset = 0;

	const headerLen = bytes.getUint8(offset++);
	if (headerLen !== HEADER_LEN && headerLen !== 12) {
	    throw new Error(`Invalid Header Size: ${headerLen}`);
	}
	const protocol = bytes.getUint8(offset++);
	const profile = bytes.getUint16(offset++, true); offset++;
	console.debug(`Got fit: ${protocol}/${profile} (${protocol.toString(16)}/${profile.toString(16)})`);

	// Note: We could check Protocol and Profile Version here but we would need
	// to find some sort of history from which protocol/profile our required
	// versions fields are available.
	// Assuming that course is so basic it was always present and will not
	// change that much ... just try any file looking somewhat correct.

	const dataLen = bytes.getUint32(offset, true); offset += 4;
	const magic = bytes.getUint32(offset); offset += 4;
	if(magic !== MAGIC) {
	    throw new Error('Not a Fit-File (wrong magic)');
	}
	if(headerLen === 14) {
	    // don't validate CRC
	    offset += 2;
	}

	offset = this.readRecords(bytes, offset, offset + dataLen);
	offset += 2; // also don't validate final CRC
	if(offset > bytes.byteLength) {
	    throw new Error('Fit-File is incomplete!');
	} else if (offset < bytes.byteLength) {
	    // It is allowed to simply cat multiple files; for now keep it
	    // simple and hope that this does not happen!
	    throw new Error('Chained Fit-Files not supported!');
	}

	console.debug(`Fit Parsed got: ${this.points.length} Points and ${this.turns.length} Turns`);
	if(this.points.length) {
	    if(this.activity && !this.turns.length) {
		this.reduceActivity();
	    }
	    if(!this.name) {
		if(this.activity) {
		    this.name = 'Track';
		} else {
		    this.name = 'Route';
		}
	    }
	    this.mergeTurnsIntoPoints();
	    return {name: this.name, points: this.points, eleGain: this.eleGain, eleLoss: this.eleLoss};
	}
	return null;
    }

    readRecords(bytes, offset, endOffset) {
	while(offset < endOffset) {
	    const recordHeader = bytes.getUint8(offset++)
	    //console.debug(`Record: ${recordHeader}`);

	    if(recordHeader & 0x80) {
		// Compressed Timestamp Header: Seems to be not required for now and
		// reads complicated.
		throw new Error('Detail of Fit-Format not supported (Compresed Timestamp)');
	    } else if(recordHeader & 0x40) {
		// Definition Message
		offset = this.readDefinitionRecord(bytes, offset, recordHeader);
	    } else {
		// Data Message
		let mesg;
		[offset, mesg] = this.readDataRecord(bytes, offset, recordHeader);
		if(mesg) {
		    this.processMesg(mesg);
		}
	    }
	}
	return offset;
    }

    readDefinitionRecord(bytes, offset, recordHeader) {
	const localMsgNum = recordHeader & 0x0F;
	const hasDevFields = recordHeader & 0x20;

	if(bytes.getUint8(offset++) !== 0) {
	    throw new Error('Fit-File Invalid: Wrong Definition Message');
	}
	const littleEndian = bytes.getUint8(offset++) === 0;
	const globalMsgNum = bytes.getUint16(offset++, littleEndian); offset++;

	const recordDef = {
	    msgNum: globalMsgNum,
	    littleEndian,
	    sizeFields: 0,
	    fields: [],
	    sizeDevFields: 0,
	};

	const cntFields = bytes.getUint8(offset++);
	for(let i = 0; i < cntFields; i++) {
	    const fieldNum = bytes.getUint8(offset++);
	    const fieldSize = bytes.getUint8(offset++);
	    recordDef.sizeFields += fieldSize;
	    const fieldType = bytes.getUint8(offset++);
	    recordDef.fields.push([fieldNum, fieldSize, fieldType]);
	}
	if(hasDevFields) {
	    // we don't care about developer fields just get the size and be done with it
	    const cntDevFields = bytes.getUint8(offset++);
	    for(let i = 0; i < cntDevFields; i++) {
		offset++;
		recordDef.sizeDevFields += bytes.getUint8(offset++);
		offset++;
	    }
	}

	this.recordDefs[localMsgNum] = recordDef;

	//console.debug(`Got Definition as ${localMsgNum}`, recordDef);

	return offset;
    }

    readDataRecord(bytes, offset, recordHeader) {
	const localMsgNum = recordHeader & 0x0F;
	const localDef = this.recordDefs[localMsgNum];
	if(!localDef) {
	    throw new Error('Fit-File Invalid: Unknown Data Message');
	}
	//console.debug(`Found record ${localMsgNum} mapping to ${localDef.msgNum}`);

	// Only fully read fields we are actually interested in
	const globalDef = mesgMap[localDef.msgNum];
	if(!globalDef) {
	    //console.debug('Ignore unhandled record');
	    offset += localDef.sizeFields + localDef.sizeDevFields;
	    return [offset, null];
	}

	let data = {
	    _mesgName: globalDef._mesgName
	};

	for(const localFieldDef of localDef.fields) {
	    const globalFieldDef = globalDef[localFieldDef[0]];
	    if(!globalFieldDef) {
		offset += localFieldDef[1];
		continue;
	    }
	    const typeDef = types[globalFieldDef.type];
	    if(
		typeDef.baseType !== localFieldDef[2] ||
		(typeDef !== types.string && typeDef.size !== localFieldDef[1])
	    ) {
		// you could ignore it ... but we do need all fields
		let msg = `(Expected baseType ${typeDef.baseType} found ${localFieldDef[2]}`;
		msg += `With size ${typeDef.size} found ${localFieldDef[1]})`
		throw new Error(`Fit-File Entry not in expected format! ${msg}`);
	    }
	    let rawValue;
	    if(typeDef === types.string) {
		// Note: Yes, the string length is fixed in the record Definition.
		// AND NULL-Terminated. So the encoder can decide to create a large
		// default size and include extra NULLs or re-define the message
		// for every str-length
		rawValue = typeDef.getValue.call(bytes, offset, localFieldDef[1]);
	    } else {
		rawValue = typeDef.getValue.call(bytes, offset, localDef.littleEndian);
	    }

	    data[globalFieldDef.name] = 
		typeDef.unmapValue ? typeDef.unmapValue(rawValue)
				   : rawValue;

	    offset += localFieldDef[1];
	}
	//console.debug(`Read record ${globalDef._mesgName}:`, data);

	offset += localDef.sizeDevFields;
	return [offset, data];
    }

    processMesg(mesg) {
	switch(mesg._mesgName) {
	    case 'file_id':
		if(mesg.type !== 'course' && mesg.type !== 4) {
		    // 4 - activity file
		    throw new Error(`Only Fit-Course-File supported (Found: ${mesg.type})`);
		}
		this.activity = mesg.type === 4;
		console.debug('Got correct file type');
		break;
	    case 'course':
		this.name = mesg.name || '';
		//console.debug(`Got Course Name: ${this.name}`);
		break;
	    case 'lap':
		this.eleGain = mesg.total_ascent || 0;
		this.eleLoss = mesg.total_descent || 0;
		//console.debug(`Got Gain/Loss: ${this.eleGain}/${this.eleLoss}`);
		break;
	    case 'event':
		// not required
		break;
	    case 'record':
		// records without lat/long might happen on activity files
		// especially for indoor workouts!
		if(mesg.position_lat && mesg.position_long) {
		    let point = {
			lat: mesg.position_lat,
			lon: mesg.position_long,
			ele: mesg.altitude,
			time: mesg.timestamp,
			distance: mesg.distance
		    };
		    this.points.push(point);
		}
		break;
	    case 'course_point':
		this.turns.push(mesg);
		break;
	    default:
		throw new Error(`Internal Error: Unhandled Mesg ${mesg._mesgName}`);
	}
    }

    mergeTurnsIntoPoints() {
	if(this.turns.length === 0) {
	    return;
	}
	let turnsMap = {};
	for(const turn of this.turns) {
	    turnsMap[`${turn.position_lat};${turn.position_long}`] = turn;
	}
	for(let point of this.points) {
	    let turn = turnsMap[`${point.lat};${point.lon}`];
	    if(turn) {
		point.name = turn.name;
		point.turn = turn.type;
		// in case a point is duplicate don't duplicate the turn
		// instruction
		turnsMap[`${point.lat};${point.lon}`] = null;
	    }
	}
    }

    reduceActivity() {
	/* Activity Files typically have way more points then need for navigation.
	 * Perform a very minor reduction with Douglas-Pecker to keep file size
	 * in check */
	let newPoints = this.points;
	newPoints.forEach((p) => {
	    p.x = p.lat;
	    p.y = p.lon;
	});
	let reducedPoints = L.LineUtil.simplify(newPoints, 0.000002);
	reducedPoints.forEach((p) => {
	    p.lat = p.x;
	    p.lon = p.y;
	});
	this.points = reducedPoints;
	console.debug(`Compresed to: ${this.points.length} Points`);
    }
}

async function readFile(file) {
    const getData = new Promise((resolve, reject) => {
	const reader = new FileReader();
	reader.onload = ({ target: { result } }) => resolve(result);
	reader.onerror = (error) => reject(error);
	reader.readAsArrayBuffer(file, 'UTF-8');
    });
    let decoder = new FITDecoder();
    decoder.readRoute(await getData);
}

