/* global Blob */
import { Mesg } from './mesg.js';
import { crc } from './crc.js';
import { HEADER_LEN, PROTOCOL_VERSION, PROFILE_VERSION, MAGIC } from './types.js';

export class FITEncoder {
  constructor() {
    this.localNum = {};
    this.mesgDefn = [];
    this.messages = [];
  }

  writeFileId(values) {
    this.writeMesg('file_id', values);
  }

  writeLap(values) {
    this.writeMesg('lap', values);
  }

  writeRecord(values) {
    this.writeMesg('record', values);
  }

  writeCourse(values) {
    this.writeMesg('course', values);
  }

  writeCoursePoint(values) {
    this.writeMesg('course_point', values);
  }

  writeEvent(values) {
    this.writeMesg('event', values);
  }

  writeMesg(mesgName, values) {
    let localNum = this.localNum[mesgName];
    if (localNum === undefined) {
      localNum = this.localNum[mesgName] = Object.keys(this.localNum).length;
    }

    const mesg = new Mesg(localNum, mesgName, values);

    const mesgDefn = this.mesgDefn[localNum];
    if (!mesgDefn || !mesg.isSameDefn(mesgDefn)) {
      this.messages.push(mesg.defnRecord);
      this.mesgDefn[localNum] = mesg.mesgDefn;
    }
    this.messages.push(mesg.dataRecord);
  }

  get blob() {
    const content = [this.header, ...this.messages, this.trailer];
    return new Blob(content, { type: 'application/octet-stream' });
  }

  get dataLen() {
    return this.messages.reduce((len, message) => len + message.byteLength, 0);
  }

  get dataCrc() {
    return this.messages.reduce((dataCrc, message) => crc(message, dataCrc), 0);
  }

  get header() {
    const dv = new DataView(new ArrayBuffer(HEADER_LEN));
    dv.setUint8(0, HEADER_LEN);
    dv.setUint8(1, PROTOCOL_VERSION);
    dv.setUint16(2, PROFILE_VERSION, true);
    dv.setUint32(4, this.dataLen, true);
    dv.setUint32(8, MAGIC);
    dv.setUint16(12, crc(dv.buffer.slice(0, 12)), true);

    return dv.buffer;
  }

  get trailer() {
    const dv = new DataView(new ArrayBuffer(2));
    dv.setUint16(0, this.dataCrc, true);

    return dv.buffer;
  }
}
