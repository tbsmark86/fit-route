const enum_maps = {
  file: { course: 6 },
  sport: { cycling: 2 }
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

const date_time = {
  ...uint32,
  mapValue: (value) => value - 631065600 // "1989-12-31T00:00"
};

const semicircles = {
  ...sint32,
  mapValue: (value) => Math.round(value / 180 * 0x80000000)
};

export const types = {
  enum_file,
  enum_sport,
  sint8,
  uint8,
  sint32,
  uint32,
  semicircles,
  date_time
};
