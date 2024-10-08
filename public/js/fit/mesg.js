import { types, encodedStrlen } from './types.js';

const mesgDefns = {
  file_id: {
    mesgNum: 0,
    fieldDefns: [
      { name: 'type', number: 0, type: 'enum_file' },
      { name: 'time_created', number: 4, type: 'date_time' }
    ]
  },
  lap: {
    mesgNum: 19,
    fieldDefns: [
      { name: 'timestamp', number: 253, type: 'date_time' },
      { name: 'start_time', number: 2, type: 'date_time' },
      { name: 'start_position_lat', number: 3, type: 'semicircles' },
      { name: 'start_position_long', number: 4, type: 'semicircles' },
      { name: 'end_position_lat', number: 5, type: 'semicircles' },
      { name: 'end_position_long', number: 6, type: 'semicircles' },
      { name: 'total_timer_time', number: 8, type: 'seconds' },
      { name: 'total_distance', number: 9, type: 'distance' },
      { name: 'total_ascent', number: 21, type: 'uint16' },
      { name: 'total_descent', number: 22, type: 'uint16' }
    ]
  },
  record: {
    mesgNum: 20,
    fieldDefns: [
      { name: 'timestamp', number: 253, type: 'date_time' },
      { name: 'position_lat', number: 0, type: 'semicircles' },
      { name: 'position_long', number: 1, type: 'semicircles' },
      { name: 'altitude', number: 2, type: 'altitude' },
      { name: 'distance', number: 5, type: 'distance' }
    ]
  },
  course_point: {
    mesgNum: 32,
    fieldDefns: [
      { name: 'timestamp', number: 1, type: 'date_time' },
      { name: 'position_lat', number: 2, type: 'semicircles' },
      { name: 'position_long', number: 3, type: 'semicircles' },
      { name: 'distance', number: 4, type: 'distance' }, // distance from the start of the course
      { name: 'type', number: 5, type: 'enum_course_point' },
      { name: 'name', number: 6, type: 'string' },
    ]
  },
  event: {
    mesgNum: 21,
    fieldDefns: [
      { name: 'timestamp', number: 253, type: 'date_time' },
      { name: 'event', number: 0, type: 'enum_event' },
      { name: 'event_type', number: 1, type: 'enum_event_type' },
      { name: 'event_group', number: 4, type: 'uint8' }
    ]
  },
  course: {
    mesgNum: 31,
    fieldDefns: [{ name: 'name', number: 5, type: 'string' }]
  }
};

const fields = (fieldDefns, fieldValues) => {
  return fieldDefns
    .map((fieldDefn) => ({ ...fieldDefn, value: fieldValues[fieldDefn.name] }))
    .filter(({ value }) => value !== undefined);
};

export class Mesg {
  static check(mesgName, mesgNum, fieldDefns, values) {
    if (mesgNum === undefined) {
      throw new Error(`Message '${mesgName}' not known`);
    }
    if (fieldDefns === undefined) {
      throw new Error(`Message '${mesgName}' has no field definitions`);
    }
    const fieldNames = fieldDefns.map((fieldDefn) => fieldDefn.name);
    const unknownFields = Object.keys(values).filter((fieldName) => !fieldNames.includes(fieldName));
    if (unknownFields.length) {
      throw new Error(`Message '${mesgName}' has no field definitions named '${unknownFields}'`);
    }
  }

  constructor(localNum, mesgName, values) {
    const { mesgNum, fieldDefns } = mesgDefns[mesgName];
    Mesg.check(mesgName, mesgNum, fieldDefns, values);
    this.localNum = localNum;
    this.mesgNum = mesgNum;
    this.fields = fields(fieldDefns, values);
  }

  get mesgDefn() {
    const fieldDefns = this.fields.map(({ number, type, value }) => {
      const { size, baseType } = types[type];
      if (type === 'string') {
        return { number, size: encodedStrlen(value), baseType };
      }
      return { number, size, baseType };
    });
    return {
      localNum: this.localNum,
      mesgNum: this.mesgNum,
      fieldDefns
    };
  }

  isSameDefn(mesgDefn) {
    const isSameFieldDefn = (defn1, defn2) =>
      defn1.number === defn2.number && defn1.size === defn2.size && defn1.baseType === defn2.baseType;
    const areSameFieldDefns = (defns1, defns2) =>
      defns1.length === defns2.length && defns1.every((defn1, i) => isSameFieldDefn(defn1, defns2[i]));

    const { localNum, mesgNum, fieldDefns } = this.mesgDefn;
    return (
      mesgNum === mesgDefn.mesgNum &&
      localNum === mesgDefn.localNum &&
      areSameFieldDefns(fieldDefns, mesgDefn.fieldDefns)
    );
  }

  get defnRecord() {
    const { localNum, mesgNum, fieldDefns } = this.mesgDefn;
    const recordLen = 6 + 3 * fieldDefns.length;
    const dv = new DataView(new ArrayBuffer(recordLen));

    dv.setUint8(0, 0x40 | localNum);
    dv.setUint8(2, 1); // big endian
    dv.setUint16(3, mesgNum);
    dv.setUint8(5, fieldDefns.length);

    let offset = 6;
    for (const fieldDefn of fieldDefns) {
      dv.setUint8(offset++, fieldDefn.number);
      dv.setUint8(offset++, fieldDefn.size);
      dv.setUint8(offset++, fieldDefn.baseType);
    }

    return dv.buffer;
  }

  get dataRecord() {
    const { localNum, fieldDefns } = this.mesgDefn;
    const recordLen = 1 + fieldDefns.reduce((len, { size }) => len + size, 0);
    const dv = new DataView(new ArrayBuffer(recordLen));

    dv.setUint8(0, localNum);
    let offset = 1;
    for (const { value, type } of this.fields) {
      const { size, mapValue, setValue } = types[type];
      setValue.call(dv, offset, mapValue ? mapValue(value) : value);
      offset += size;
    }

    return dv.buffer;
  }
}

// For Reading: Reverse Map of FIT-Global Mesg-Num => for us relevant
// fields.
// Non Mapped Mesgs & Fields are simply skipped
export const mesgMap = (() => {
    let res = {};
    for(const [mesgName, mesgDef] of Object.entries(mesgDefns)) {
	let newFields = {
	    _mesgName: mesgName
	};
	for(const fieldDef of Object.values(mesgDef.fieldDefns)) {
	    newFields[fieldDef.number] = fieldDef;
	}
	res[mesgDef.mesgNum] = newFields;
    }
    Object.seal(res);
    return res;
})();
