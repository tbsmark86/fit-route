const CRC_TABLE = [
  0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
  0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400
];

const update_nibble = (crc, nibble) => (crc >> 4) & 0x0FFF ^ CRC_TABLE[crc & 0xF] ^ CRC_TABLE[nibble];
const update_nibbles = (crc, lo, hi) => update_nibble(update_nibble(crc, lo), hi);
const update = (crc, byte) => update_nibbles(crc, byte & 0xF, (byte >> 4) & 0xF);

export function crc(buffer, initial = 0) {
  return new Uint8Array(buffer)
    .reduce((crc, byte) => update(crc, byte), initial);
}
