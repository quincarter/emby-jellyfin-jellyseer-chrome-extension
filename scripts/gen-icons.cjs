const fs = require('fs');
const zlib = require('zlib');

const createPNG = (size) => {
  const width = size,
    height = size;
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;

  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      rawData.push(0x7b, 0x2f, 0xbe);
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(rawData));

  const makeChunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = zlib.crc32(typeAndData);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeAndData, crcBuf]);
  };

  return Buffer.concat([
    pngSig,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
};

[16, 32, 48, 128].forEach((s) => {
  fs.writeFileSync(`public/icons/icon-${s}.png`, createPNG(s));
});
console.log('Icons created');
