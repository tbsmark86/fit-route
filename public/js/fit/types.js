const enum_maps = {
  file: { course: 6 },
  sport: { cycling: 2 },
  event: { timer: 0 },
  event_type: { start: 0, stop_disable_all: 9 },
  course_point: {
    generic: 0, // idea: offer those as custom markers!
    summit: 1,
    valley: 2,
    water: 3,
    food: 4,
    danger: 5,
    left: 6,
    right: 7,
    straight: 8,
    //first_aid: 9,
    //fourth_category: 10,
    //third_category: 11,
    //second_category: 12,
    //first_category: 13,
    //hors_category: 14,
    sprint: 15,
    left_fork: 16,
    right_fork: 17,
    middle_fork: 18,
    slight_left: 19,
    sharp_left: 20,
    slight_right: 21,
    sharp_right: 22,
    u_turn: 23,
    segment_start: 24,
    segment_end: 25
  }
};

const _enum = (name) => {
  const enum_map = enum_maps[name];
  return {
    size: 1,
    baseType: 0,
    mapValue: (value) => enum_map[value],
    setValue: DataView.prototype.setUint8
  };
};

const enum_file = _enum('file');

const enum_sport = _enum('sport');

const enum_event = _enum('event');

const enum_event_type = _enum('event_type');

const enum_course_point = _enum('course_point');

const sint8 = {
  size: 1,
  baseType: 1,
  setValue: DataView.prototype.setInt8
};

const uint8 = {
  size: 1,
  baseType: 2,
  setValue: DataView.prototype.setUint8
};

const sint16 = {
  size: 2,
  baseType: 0x83,
  setValue: DataView.prototype.setInt16
};

const uint16 = {
  size: 2,
  baseType: 0x84,
  setValue: DataView.prototype.setUint16
};

const sint32 = {
  size: 4,
  baseType: 0x85,
  setValue: DataView.prototype.setInt32
};

const uint32 = {
  size: 4,
  baseType: 0x86,
  setValue: DataView.prototype.setUint32
};

const string = {
  size: 0,
  baseType: 7,
  mapValue: (value) => Array.from(encodedStr(value)),
  setValue: dvSetUint8Array
};

const seconds = {
  ...uint32,
  mapValue: (value) => Math.round(value * 1000)
};

const distance = {
  ...uint32,
  mapValue: (value) => Math.round(value * 100)
};

const altitude = {
  ...uint16,
  mapValue: (value) => Math.round((value + 500) * 5)
};

const date_time = {
  ...uint32,
  mapValue: (value) => Math.round(value / 1000) - 631065600 // "1989-12-31T00:00"
};

const semicircles = {
  ...sint32,
  mapValue: (value) => Math.round((value / 180) * 0x80000000)
};

export const types = {
  enum_file,
  enum_sport,
  enum_event,
  enum_event_type,
  enum_course_point,
  sint8,
  uint8,
  sint16,
  uint16,
  sint32,
  uint32,
  string,
  seconds,
  distance,
  semicircles,
  altitude,
  date_time
};

export function encodedStrlen(str) {
  return Array.from(encodedStr(str)).length;
}

// Null terminated string encoded in UTF-8 format
function* encodedStr(s) {
  for (const codePoint of codePoints(s)) {
    if (codePoint < 0x80) {
      yield codePoint;
    } else {
      const bytes = [codePoint & 0x3f, (codePoint >> 6) & 0x3f, (codePoint >> 12) & 0x3f, codePoint >> 18];
      if (codePoint < 0x800) {
        yield 0xc0 | bytes[1];
        yield 0x80 | bytes[0];
      } else if (codePoint < 0x10000) {
        yield 0xe0 | bytes[2];
        yield 0x80 | bytes[1];
        yield 0x80 | bytes[0];
      } else {
        yield 0xf0 | bytes[3];
        yield 0x80 | bytes[2];
        yield 0x80 | bytes[1];
        yield 0x80 | bytes[0];
      }
    }
  }
  yield 0;
}

function* codePoints(s) {
  for (let i = 0; i < s.length; i++) {
    const codePoint = s.codePointAt(i);
    if (codePoint > 0xffff) {
      i++; // skip 2nd surrogate pair
    }
    yield codePoint;
  }
}

function dvSetUint8Array(offset, values) {
  const dv = this;
  for (const value of values) {
    dv.setUint8(offset++, value);
  }
}
