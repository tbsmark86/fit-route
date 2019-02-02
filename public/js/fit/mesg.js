import { types } from './types.js';

const mesgDefns = {
  file_id: {
    mesgNum: 0,
    fieldDefns: [
      { name: 'type', number: 0, type: 'enum_file' },
      { name: 'time_created', number: 4, type: 'date_time' }
    ]
  },
  record: {
    mesgNum: 20,
    fieldDefns: [
      { name: 'position_lat', number: 0, type: 'semicircles' },
      { name: 'position_long', number: 1, type: 'semicircles' }
    ]
  }
};

const fields = (fieldDefns, fieldValues) => {
  return fieldDefns
    .map((fieldDefn) => ({ ...fieldDefn, value: fieldValues[fieldDefn.name] }))
    .filter(({ value }) => value !== undefined);
};

export class Mesg {
  constructor(localNum, mesgName, values) {
    const { mesgNum, fieldDefns } = mesgDefns[mesgName];
    this.localNum = localNum;
    this.mesgNum = mesgNum;
    this.fields = fields(fieldDefns, values);
  }

  get mesgDefn() {
    const fieldDefns = this.fields.map(({ number, type }) => {
      const { size, baseType } = types[type];
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
      defn1.number === defn2.number &&
      defn1.size === defn2.size &&
      defn1.baseType === defn2.baseType;
    const areSameFieldDefns = (defns1, defns2) =>
      defns1.length === defns2.length &&
      defns1.every((defn1, i) => isSameFieldDefn(defn1, defns2[i]));

    const { localNum, mesgNum, fieldDefns } = this.mesgDefn;
    return mesgNum === mesgDefn.mesgNum &&
      localNum === mesgDefn.localNum &&
      areSameFieldDefns(fieldDefns, mesgDefn.fieldDefns);
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
