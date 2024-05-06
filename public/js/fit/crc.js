// prettier-ignore
const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400
];

const update_nibble = (crc, nibble) => ((crc >> 4) & 0x0fff) ^ CRC_TABLE[crc & 0xf] ^ CRC_TABLE[nibble];
const update_nibbles = (crc, lo, hi) => update_nibble(update_nibble(crc, lo), hi);
const update = (crc, byte) => update_nibbles(crc, byte & 0xf, (byte >> 4) & 0xf);

export function crc(buffer, initial = 0) {
  return new Uint8Array(buffer).reduce((crc, byte) => update(crc, byte), initial);
}
