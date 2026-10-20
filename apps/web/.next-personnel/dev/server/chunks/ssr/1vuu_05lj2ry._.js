module.exports = [
"[project]/wt-personnel/node_modules/pend/index.js [app-rsc] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = Pend;
function Pend() {
    this.pending = 0;
    this.max = Infinity;
    this.listeners = [];
    this.waiting = [];
    this.error = null;
}
Pend.prototype.go = function(fn) {
    if (this.pending < this.max) {
        pendGo(this, fn);
    } else {
        this.waiting.push(fn);
    }
};
Pend.prototype.wait = function(cb) {
    if (this.pending === 0) {
        cb(this.error);
    } else {
        this.listeners.push(cb);
    }
};
Pend.prototype.hold = function() {
    return pendHold(this);
};
function pendHold(self) {
    self.pending += 1;
    var called = false;
    return onCb;
    //TURBOPACK unreachable
    ;
    function onCb(err) {
        if (called) throw new Error("callback called twice");
        called = true;
        self.error = self.error || err;
        self.pending -= 1;
        if (self.waiting.length > 0 && self.pending < self.max) {
            pendGo(self, self.waiting.shift());
        } else if (self.pending === 0) {
            var listeners = self.listeners;
            self.listeners = [];
            listeners.forEach(cbListener);
        }
    }
    function cbListener(listener) {
        listener(self.error);
    }
}
function pendGo(self, fn) {
    fn(pendHold(self));
}
}),
"[project]/wt-personnel/node_modules/yauzl/crc32.js [app-rsc] (ecmascript)", ((__turbopack_context__, module, exports) => {

// Adapted from https://github.com/brianloveswords/buffer-crc32/blob/v0.2.13/index.js
const CRC_TABLE = new Int32Array([
    0x00000000,
    0x77073096,
    0xee0e612c,
    0x990951ba,
    0x076dc419,
    0x706af48f,
    0xe963a535,
    0x9e6495a3,
    0x0edb8832,
    0x79dcb8a4,
    0xe0d5e91e,
    0x97d2d988,
    0x09b64c2b,
    0x7eb17cbd,
    0xe7b82d07,
    0x90bf1d91,
    0x1db71064,
    0x6ab020f2,
    0xf3b97148,
    0x84be41de,
    0x1adad47d,
    0x6ddde4eb,
    0xf4d4b551,
    0x83d385c7,
    0x136c9856,
    0x646ba8c0,
    0xfd62f97a,
    0x8a65c9ec,
    0x14015c4f,
    0x63066cd9,
    0xfa0f3d63,
    0x8d080df5,
    0x3b6e20c8,
    0x4c69105e,
    0xd56041e4,
    0xa2677172,
    0x3c03e4d1,
    0x4b04d447,
    0xd20d85fd,
    0xa50ab56b,
    0x35b5a8fa,
    0x42b2986c,
    0xdbbbc9d6,
    0xacbcf940,
    0x32d86ce3,
    0x45df5c75,
    0xdcd60dcf,
    0xabd13d59,
    0x26d930ac,
    0x51de003a,
    0xc8d75180,
    0xbfd06116,
    0x21b4f4b5,
    0x56b3c423,
    0xcfba9599,
    0xb8bda50f,
    0x2802b89e,
    0x5f058808,
    0xc60cd9b2,
    0xb10be924,
    0x2f6f7c87,
    0x58684c11,
    0xc1611dab,
    0xb6662d3d,
    0x76dc4190,
    0x01db7106,
    0x98d220bc,
    0xefd5102a,
    0x71b18589,
    0x06b6b51f,
    0x9fbfe4a5,
    0xe8b8d433,
    0x7807c9a2,
    0x0f00f934,
    0x9609a88e,
    0xe10e9818,
    0x7f6a0dbb,
    0x086d3d2d,
    0x91646c97,
    0xe6635c01,
    0x6b6b51f4,
    0x1c6c6162,
    0x856530d8,
    0xf262004e,
    0x6c0695ed,
    0x1b01a57b,
    0x8208f4c1,
    0xf50fc457,
    0x65b0d9c6,
    0x12b7e950,
    0x8bbeb8ea,
    0xfcb9887c,
    0x62dd1ddf,
    0x15da2d49,
    0x8cd37cf3,
    0xfbd44c65,
    0x4db26158,
    0x3ab551ce,
    0xa3bc0074,
    0xd4bb30e2,
    0x4adfa541,
    0x3dd895d7,
    0xa4d1c46d,
    0xd3d6f4fb,
    0x4369e96a,
    0x346ed9fc,
    0xad678846,
    0xda60b8d0,
    0x44042d73,
    0x33031de5,
    0xaa0a4c5f,
    0xdd0d7cc9,
    0x5005713c,
    0x270241aa,
    0xbe0b1010,
    0xc90c2086,
    0x5768b525,
    0x206f85b3,
    0xb966d409,
    0xce61e49f,
    0x5edef90e,
    0x29d9c998,
    0xb0d09822,
    0xc7d7a8b4,
    0x59b33d17,
    0x2eb40d81,
    0xb7bd5c3b,
    0xc0ba6cad,
    0xedb88320,
    0x9abfb3b6,
    0x03b6e20c,
    0x74b1d29a,
    0xead54739,
    0x9dd277af,
    0x04db2615,
    0x73dc1683,
    0xe3630b12,
    0x94643b84,
    0x0d6d6a3e,
    0x7a6a5aa8,
    0xe40ecf0b,
    0x9309ff9d,
    0x0a00ae27,
    0x7d079eb1,
    0xf00f9344,
    0x8708a3d2,
    0x1e01f268,
    0x6906c2fe,
    0xf762575d,
    0x806567cb,
    0x196c3671,
    0x6e6b06e7,
    0xfed41b76,
    0x89d32be0,
    0x10da7a5a,
    0x67dd4acc,
    0xf9b9df6f,
    0x8ebeeff9,
    0x17b7be43,
    0x60b08ed5,
    0xd6d6a3e8,
    0xa1d1937e,
    0x38d8c2c4,
    0x4fdff252,
    0xd1bb67f1,
    0xa6bc5767,
    0x3fb506dd,
    0x48b2364b,
    0xd80d2bda,
    0xaf0a1b4c,
    0x36034af6,
    0x41047a60,
    0xdf60efc3,
    0xa867df55,
    0x316e8eef,
    0x4669be79,
    0xcb61b38c,
    0xbc66831a,
    0x256fd2a0,
    0x5268e236,
    0xcc0c7795,
    0xbb0b4703,
    0x220216b9,
    0x5505262f,
    0xc5ba3bbe,
    0xb2bd0b28,
    0x2bb45a92,
    0x5cb36a04,
    0xc2d7ffa7,
    0xb5d0cf31,
    0x2cd99e8b,
    0x5bdeae1d,
    0x9b64c2b0,
    0xec63f226,
    0x756aa39c,
    0x026d930a,
    0x9c0906a9,
    0xeb0e363f,
    0x72076785,
    0x05005713,
    0x95bf4a82,
    0xe2b87a14,
    0x7bb12bae,
    0x0cb61b38,
    0x92d28e9b,
    0xe5d5be0d,
    0x7cdcefb7,
    0x0bdbdf21,
    0x86d3d2d4,
    0xf1d4e242,
    0x68ddb3f8,
    0x1fda836e,
    0x81be16cd,
    0xf6b9265b,
    0x6fb077e1,
    0x18b74777,
    0x88085ae6,
    0xff0f6a70,
    0x66063bca,
    0x11010b5c,
    0x8f659eff,
    0xf862ae69,
    0x616bffd3,
    0x166ccf45,
    0xa00ae278,
    0xd70dd2ee,
    0x4e048354,
    0x3903b3c2,
    0xa7672661,
    0xd06016f7,
    0x4969474d,
    0x3e6e77db,
    0xaed16a4a,
    0xd9d65adc,
    0x40df0b66,
    0x37d83bf0,
    0xa9bcae53,
    0xdebb9ec5,
    0x47b2cf7f,
    0x30b5ffe9,
    0xbdbdf21c,
    0xcabac28a,
    0x53b39330,
    0x24b4a3a6,
    0xbad03605,
    0xcdd70693,
    0x54de5729,
    0x23d967bf,
    0xb3667a2e,
    0xc4614ab8,
    0x5d681b02,
    0x2a6f2b94,
    0xb40bbe37,
    0xc30c8ea1,
    0x5a05df1b,
    0x2d02ef8d
]);
function crc32(buf) {
    let crc = -1;
    for (let x of buf){
        crc = CRC_TABLE[(crc ^ x) & 0xff] ^ crc >>> 8;
    }
    return (crc ^ -1) >>> 0;
}
module.exports = crc32;
}),
"[project]/wt-personnel/node_modules/yauzl/fd-slicer.js [app-rsc] (ecmascript)", ((__turbopack_context__, module, exports) => {

// This was adapted from https://github.com/andrewrk/node-fd-slicer by Andrew Kelley under the MIT License.
var fs = __turbopack_context__.r("[externals]/fs [external] (fs, cjs)");
var util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
var stream = __turbopack_context__.r("[externals]/stream [external] (stream, cjs)");
var Readable = stream.Readable;
var PassThrough = stream.PassThrough;
var Pend = __turbopack_context__.r("[project]/wt-personnel/node_modules/pend/index.js [app-rsc] (ecmascript)");
var EventEmitter = __turbopack_context__.r("[externals]/events [external] (events, cjs)").EventEmitter;
exports.BufferSlicer = BufferSlicer;
exports.FdSlicer = FdSlicer;
util.inherits(FdSlicer, EventEmitter);
function FdSlicer(fd) {
    EventEmitter.call(this);
    this.fd = fd;
    this.pend = new Pend();
    this.pend.max = 1;
    this.refCount = 0;
}
FdSlicer.prototype.read = function(buffer, offset, length, position, callback) {
    var self = this;
    self.pend.go(function(cb) {
        fs.read(self.fd, buffer, offset, length, position, function(err, bytesRead, buffer) {
            cb();
            callback(err, bytesRead, buffer);
        });
    });
};
FdSlicer.prototype.createReadStream = function(options) {
    return new ReadStream(this, options);
};
FdSlicer.prototype.ref = function() {
    this.refCount += 1;
};
FdSlicer.prototype.unref = function() {
    var self = this;
    self.refCount -= 1;
    if (self.refCount < 0) throw new Error("invalid unref");
    if (self.refCount > 0) return;
    fs.close(self.fd, onCloseDone);
    function onCloseDone(err) {
        if (err) {
            self.emit('error', err);
        } else {
            self.emit('close');
        }
    }
};
util.inherits(ReadStream, Readable);
function ReadStream(context, options) {
    options = options || {};
    Readable.call(this, options);
    this.context = context;
    this.context.ref();
    this.start = options.start || 0;
    this.endOffset = options.end;
    this.pos = this.start;
}
ReadStream.prototype._read = function(n) {
    var self = this;
    var toRead = Math.min(self._readableState.highWaterMark, n);
    if (self.endOffset != null) {
        toRead = Math.min(toRead, self.endOffset - self.pos);
    }
    if (toRead <= 0) {
        self.push(null);
        this._cleanup();
        return;
    }
    self.context.pend.go(function(cb) {
        var buffer = Buffer.allocUnsafe(toRead);
        fs.read(self.context.fd, buffer, 0, toRead, self.pos, function(err, bytesRead) {
            if (err) {
                self.destroy(err);
            } else if (bytesRead === 0) {
                self.push(null);
                self._cleanup();
            } else {
                self.pos += bytesRead;
                self.push(buffer.slice(0, bytesRead));
            }
            cb();
        });
    });
};
ReadStream.prototype._destroy = function(err, cb) {
    // Node 14+ calls this automatically at EOF.
    this._cleanup();
    cb(err);
};
ReadStream.prototype._cleanup = function() {
    if (this.context != null) {
        this.context.unref();
        this.context = null;
    }
};
util.inherits(BufferSlicer, EventEmitter);
function BufferSlicer(buffer) {
    EventEmitter.call(this);
    this.refCount = 0;
    this.buffer = buffer;
}
BufferSlicer.prototype.read = function(buffer, offset, length, position, callback) {
    if (!(0 <= offset && offset <= buffer.length)) throw new RangeError("offset outside buffer: 0 <= " + offset + " <= " + buffer.length);
    if (position < 0) throw new RangeError("position is negative: " + position);
    if (offset + length > buffer.length) {
        // The caller's buffer can't hold all the bytes they're trying to read.
        // Clamp the length instead of giving an error.
        // The callback will be informed of fewer than expected bytes written.
        length = buffer.length - offset;
    }
    if (position + length > this.buffer.length) {
        // Clamp any attempt to read past the end of the source buffer.
        length = this.buffer.length - position;
    }
    if (length <= 0) {
        // After any clamping, we're fully out of bounds or otherwise have nothing to do.
        // This isn't an error; it's just zero bytes written.
        setImmediate(function() {
            callback(null, 0);
        });
        return;
    }
    this.buffer.copy(buffer, offset, position, position + length);
    setImmediate(function() {
        callback(null, length);
    });
};
BufferSlicer.prototype.createReadStream = function(options) {
    options = options || {};
    var readStream = new PassThrough(options);
    readStream.start = options.start || 0;
    readStream.endOffset = options.end;
    // by the time this function returns, we'll be done.
    readStream.pos = readStream.endOffset || this.buffer.length;
    var entireSlice = this.buffer.slice(readStream.start, readStream.pos);
    // Cut the buffer into smaller slices for better memory usage when streaming into a zlib inflate stream.
    // See https://github.com/thejoshwolfe/yauzl/issues/87
    var maxChunkSize = 0x10000;
    var offset = 0;
    while(true){
        var nextOffset = offset + maxChunkSize;
        if (nextOffset >= entireSlice.length) {
            // last chunk
            if (offset < entireSlice.length) {
                readStream.write(entireSlice.slice(offset, entireSlice.length));
            }
            break;
        }
        readStream.write(entireSlice.slice(offset, nextOffset));
        offset = nextOffset;
    }
    readStream.end();
    return readStream;
};
BufferSlicer.prototype.ref = function() {
    this.refCount += 1;
};
BufferSlicer.prototype.unref = function() {
    this.refCount -= 1;
    if (this.refCount < 0) {
        throw new Error("invalid unref");
    }
};
}),
"[project]/wt-personnel/node_modules/yauzl/index.js [app-rsc] (ecmascript)", ((__turbopack_context__, module, exports) => {

var fs = __turbopack_context__.r("[externals]/fs [external] (fs, cjs)");
var zlib = __turbopack_context__.r("[externals]/zlib [external] (zlib, cjs)");
var fd_slicer = __turbopack_context__.r("[project]/wt-personnel/node_modules/yauzl/fd-slicer.js [app-rsc] (ecmascript)");
var util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
var EventEmitter = __turbopack_context__.r("[externals]/events [external] (events, cjs)").EventEmitter;
var Transform = __turbopack_context__.r("[externals]/stream [external] (stream, cjs)").Transform;
var PassThrough = __turbopack_context__.r("[externals]/stream [external] (stream, cjs)").PassThrough;
var Writable = __turbopack_context__.r("[externals]/stream [external] (stream, cjs)").Writable;
// Node 20 added zlib.crc32.
const crc32 = typeof zlib.crc32 === "function" ? zlib.crc32 : __turbopack_context__.r("[project]/wt-personnel/node_modules/yauzl/crc32.js [app-rsc] (ecmascript)");
exports.open = open;
exports.fromFd = fromFd;
exports.fromBuffer = fromBuffer;
exports.fromRandomAccessReader = fromRandomAccessReader;
exports.openPromise = openPromise;
exports.fromFdPromise = fromFdPromise;
exports.fromBufferPromise = fromBufferPromise;
exports.fromRandomAccessReaderPromise = fromRandomAccessReaderPromise;
exports.dosDateTimeToDate = dosDateTimeToDate;
exports.getFileNameLowLevel = getFileNameLowLevel;
exports.validateFileName = validateFileName;
exports.parseExtraFields = parseExtraFields;
exports.ZipFile = ZipFile;
exports.Entry = Entry;
exports.LocalFileHeader = LocalFileHeader;
exports.RandomAccessReader = RandomAccessReader;
function openPromise(path, options1) {
    return new Promise((resolve, reject)=>{
        open(path, {
            ...options1,
            lazyEntries: true
        }, function(err, zipfile) {
            if (err) return reject(err);
            resolve(zipfile);
        });
    });
}
function fromFdPromise(fd, options1) {
    return new Promise((resolve, reject)=>{
        fromFd(fd, {
            ...options1,
            lazyEntries: true
        }, function(err, zipfile) {
            if (err) return reject(err);
            resolve(zipfile);
        });
    });
}
function fromBufferPromise(buffer, options1) {
    return new Promise((resolve, reject)=>{
        fromBuffer(buffer, {
            ...options1,
            lazyEntries: true
        }, function(err, zipfile) {
            if (err) return reject(err);
            resolve(zipfile);
        });
    });
}
function fromRandomAccessReaderPromise(reader, totalSize, options1) {
    return new Promise((resolve, reject)=>{
        fromRandomAccessReader(reader, totalSize, {
            ...options1,
            lazyEntries: true
        }, function(err, zipfile) {
            if (err) return reject(err);
            resolve(zipfile);
        });
    });
}
function open(path, options1, callback) {
    if (typeof options1 === "function") {
        callback = options1;
        options1 = null;
    }
    if (options1 == null) options1 = {};
    if (options1.autoClose == null) options1.autoClose = true;
    if (options1.lazyEntries == null) options1.lazyEntries = false;
    if (options1.decodeStrings == null) options1.decodeStrings = true;
    if (options1.validateEntrySizes == null) options1.validateEntrySizes = true;
    if (options1.strictFileNames == null) options1.strictFileNames = false;
    if (callback == null) callback = defaultCallback;
    fs.open(path, "r", function(err, fd) {
        if (err) return callback(err);
        fromFd(fd, options1, function(err, zipfile) {
            if (err) fs.close(fd, defaultCallback);
            callback(err, zipfile);
        });
    });
}
function fromFd(fd, options1, callback) {
    if (typeof options1 === "function") {
        callback = options1;
        options1 = null;
    }
    if (options1 == null) options1 = {};
    if (options1.autoClose == null) options1.autoClose = false;
    if (options1.lazyEntries == null) options1.lazyEntries = false;
    if (options1.decodeStrings == null) options1.decodeStrings = true;
    if (options1.validateEntrySizes == null) options1.validateEntrySizes = true;
    if (options1.strictFileNames == null) options1.strictFileNames = false;
    if (callback == null) callback = defaultCallback;
    fs.fstat(fd, function(err, stats) {
        if (err) return callback(err);
        var reader = new fd_slicer.FdSlicer(fd);
        fromRandomAccessReader(reader, stats.size, options1, callback);
    });
}
function fromBuffer(buffer, options1, callback) {
    if (typeof options1 === "function") {
        callback = options1;
        options1 = null;
    }
    if (options1 == null) options1 = {};
    options1.autoClose = false;
    if (options1.lazyEntries == null) options1.lazyEntries = false;
    if (options1.decodeStrings == null) options1.decodeStrings = true;
    if (options1.validateEntrySizes == null) options1.validateEntrySizes = true;
    if (options1.strictFileNames == null) options1.strictFileNames = false;
    var reader = new fd_slicer.BufferSlicer(buffer);
    fromRandomAccessReader(reader, buffer.length, options1, callback);
}
function fromRandomAccessReader(reader, totalSize, options1, callback) {
    if (typeof options1 === "function") {
        callback = options1;
        options1 = null;
    }
    if (options1 == null) options1 = {};
    if (options1.autoClose == null) options1.autoClose = true;
    if (options1.lazyEntries == null) options1.lazyEntries = false;
    if (options1.decodeStrings == null) options1.decodeStrings = true;
    var decodeStrings = !!options1.decodeStrings;
    if (options1.validateEntrySizes == null) options1.validateEntrySizes = true;
    if (options1.strictFileNames == null) options1.strictFileNames = false;
    if (callback == null) callback = defaultCallback;
    if (typeof totalSize !== "number") throw new Error("expected totalSize parameter to be a number");
    if (totalSize > Number.MAX_SAFE_INTEGER) {
        throw new Error("zip file too large. only file sizes up to 2^52 are supported due to JavaScript's Number type being an IEEE 754 double.");
    }
    // the matching unref() call is in zipfile.close()
    reader.ref();
    // eocdr means End of Central Directory Record.
    // search backwards for the eocdr signature.
    // the last field of the eocdr is a variable-length comment.
    // the comment size is encoded in a 2-byte field in the eocdr, which we can't find without trudging backwards through the comment to find it.
    // as a consequence of this design decision, it's possible to have ambiguous zip file metadata if a coherent eocdr was in the comment.
    // we search backwards for a eocdr signature, and hope that whoever made the zip file was smart enough to forbid the eocdr signature in the comment.
    var eocdrWithoutCommentSize = 22;
    var zip64EocdlSize = 20; // Zip64 end of central directory locator
    var maxCommentSize = 0xffff; // 2-byte size
    var bufferSize = Math.min(zip64EocdlSize + eocdrWithoutCommentSize + maxCommentSize, totalSize);
    var buffer = newBuffer(bufferSize);
    var bufferReadStart = totalSize - buffer.length;
    readAndAssertNoEof(reader, buffer, 0, bufferSize, bufferReadStart, function(err) {
        if (err) return callback(err);
        for(var i = bufferSize - eocdrWithoutCommentSize; i >= 0; i -= 1){
            if (buffer.readUInt32LE(i) !== 0x06054b50) continue;
            // found eocdr
            var eocdrBuffer = buffer.subarray(i);
            // 0 - End of central directory signature = 0x06054b50
            // 4 - Number of this disk
            var diskNumber = eocdrBuffer.readUInt16LE(4);
            // 6 - Disk where central directory starts
            // 8 - Number of central directory records on this disk
            // 10 - Total number of central directory records
            var entryCount = eocdrBuffer.readUInt16LE(10);
            // 12 - Size of central directory (bytes)
            // 16 - Offset of start of central directory, relative to start of archive
            var centralDirectoryOffset = eocdrBuffer.readUInt32LE(16);
            // 20 - Comment length
            var commentLength = eocdrBuffer.readUInt16LE(20);
            var expectedCommentLength = eocdrBuffer.length - eocdrWithoutCommentSize;
            if (commentLength !== expectedCommentLength) {
                return callback(new Error("Invalid comment length. Expected: " + expectedCommentLength + ". Found: " + commentLength + ". Are there extra bytes at the end of the file? Or is the end of central dir signature `PK☺☻` in the comment?"));
            }
            // 22 - Comment
            // the encoding is always cp437.
            var comment = decodeStrings ? decodeBuffer(eocdrBuffer.subarray(22), false) : eocdrBuffer.subarray(22);
            // Look for a Zip64 end of central directory locator
            if (i - zip64EocdlSize >= 0 && buffer.readUInt32LE(i - zip64EocdlSize) === 0x07064b50) {
                // ZIP64 format
                var zip64EocdlBuffer = buffer.subarray(i - zip64EocdlSize, i - zip64EocdlSize + zip64EocdlSize);
                // 0 - zip64 end of central dir locator signature = 0x07064b50
                // 4 - number of the disk with the start of the zip64 end of central directory
                // 8 - relative offset of the zip64 end of central directory record
                var zip64EocdrOffset = readUInt64LE(zip64EocdlBuffer, 8);
                // 16 - total number of disks
                // ZIP64 end of central directory record
                var zip64EocdrBuffer = newBuffer(56);
                return readAndAssertNoEof(reader, zip64EocdrBuffer, 0, zip64EocdrBuffer.length, zip64EocdrOffset, function(err) {
                    if (err) return callback(err);
                    // 0 - zip64 end of central dir signature                           4 bytes  (0x06064b50)
                    if (zip64EocdrBuffer.readUInt32LE(0) !== 0x06064b50) {
                        return callback(new Error("invalid zip64 end of central directory record signature"));
                    }
                    // 4 - size of zip64 end of central directory record                8 bytes
                    // 12 - version made by                                             2 bytes
                    // 14 - version needed to extract                                   2 bytes
                    // 16 - number of this disk                                         4 bytes
                    diskNumber = zip64EocdrBuffer.readUInt32LE(16);
                    if (diskNumber !== 0) {
                        // Check this only after zip64 overrides. See #118.
                        return callback(new Error("multi-disk zip files are not supported: found disk number: " + diskNumber));
                    }
                    // 20 - number of the disk with the start of the central directory  4 bytes
                    // 24 - total number of entries in the central directory on this disk         8 bytes
                    // 32 - total number of entries in the central directory            8 bytes
                    entryCount = readUInt64LE(zip64EocdrBuffer, 32);
                    // 40 - size of the central directory                               8 bytes
                    // 48 - offset of start of central directory with respect to the starting disk number     8 bytes
                    centralDirectoryOffset = readUInt64LE(zip64EocdrBuffer, 48);
                    // 56 - zip64 extensible data sector                                (variable size)
                    return callback(null, new ZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options1.autoClose, options1.lazyEntries, decodeStrings, options1.validateEntrySizes, options1.strictFileNames));
                });
            }
            // Not ZIP64 format
            if (diskNumber !== 0) {
                return callback(new Error("multi-disk zip files are not supported: found disk number: " + diskNumber));
            }
            return callback(null, new ZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options1.autoClose, options1.lazyEntries, decodeStrings, options1.validateEntrySizes, options1.strictFileNames));
        }
        // Not a zip file.
        callback(new Error("End of central directory record signature not found. Either not a zip file, or file is truncated."));
    });
}
util.inherits(ZipFile, EventEmitter);
function ZipFile(reader, centralDirectoryOffset, fileSize, entryCount, comment, autoClose, lazyEntries, decodeStrings, validateEntrySizes, strictFileNames) {
    var self = this;
    EventEmitter.call(self);
    self.reader = reader;
    // forward close events
    self.reader.on("error", function(err) {
        // error closing the fd
        emitError(self, err);
    });
    self.reader.once("close", function() {
        self.emit("close");
    });
    self.readEntryCursor = centralDirectoryOffset;
    self.fileSize = fileSize;
    self.entryCount = entryCount;
    self.comment = comment;
    self.entriesRead = 0;
    self.autoClose = !!autoClose;
    self.lazyEntries = !!lazyEntries;
    self.decodeStrings = !!decodeStrings;
    self.validateEntrySizes = !!validateEntrySizes;
    self.strictFileNames = !!strictFileNames;
    self.isOpen = true;
    self.emittedError = false;
    self.hasEachEntryBeenCalled = false;
    if (!self.lazyEntries) self._readEntry();
}
ZipFile.prototype.close = function() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.reader.unref();
};
function emitErrorAndAutoClose(self, err) {
    if (self.autoClose) self.close();
    emitError(self, err);
}
function emitError(self, err) {
    if (self.emittedError) return;
    self.emittedError = true;
    self.emit("error", err);
}
ZipFile.prototype.readEntry = function() {
    if (!this.lazyEntries) throw new Error("readEntry() called without lazyEntries:true");
    this._readEntry();
};
ZipFile.prototype._readEntry = function() {
    var self = this;
    if (self.entryCount === self.entriesRead) {
        // done with metadata
        setImmediate(function() {
            if (self.autoClose) self.close();
            if (self.emittedError) return;
            self.emit("end");
        });
        return;
    }
    if (self.emittedError) return;
    var buffer = newBuffer(46);
    readAndAssertNoEof(self.reader, buffer, 0, buffer.length, self.readEntryCursor, function(err) {
        if (err) return emitErrorAndAutoClose(self, err);
        if (self.emittedError) return;
        var entry = new Entry();
        // 0 - Central directory file header signature
        var signature = buffer.readUInt32LE(0);
        if (signature !== 0x02014b50) return emitErrorAndAutoClose(self, new Error("invalid central directory file header signature: 0x" + signature.toString(16)));
        // 4 - Version made by
        entry.versionMadeBy = buffer.readUInt16LE(4);
        // 6 - Version needed to extract (minimum)
        entry.versionNeededToExtract = buffer.readUInt16LE(6);
        // 8 - General purpose bit flag
        entry.generalPurposeBitFlag = buffer.readUInt16LE(8);
        // 10 - Compression method
        entry.compressionMethod = buffer.readUInt16LE(10);
        // 12 - File last modification time
        entry.lastModFileTime = buffer.readUInt16LE(12);
        // 14 - File last modification date
        entry.lastModFileDate = buffer.readUInt16LE(14);
        // 16 - CRC-32
        entry.crc32 = buffer.readUInt32LE(16);
        // 20 - Compressed size
        entry.compressedSize = buffer.readUInt32LE(20);
        // 24 - Uncompressed size
        entry.uncompressedSize = buffer.readUInt32LE(24);
        // 28 - File name length (n)
        entry.fileNameLength = buffer.readUInt16LE(28);
        // 30 - Extra field length (m)
        entry.extraFieldLength = buffer.readUInt16LE(30);
        // 32 - File comment length (k)
        entry.fileCommentLength = buffer.readUInt16LE(32);
        // 34 - Disk number where file starts
        // 36 - Internal file attributes
        entry.internalFileAttributes = buffer.readUInt16LE(36);
        // 38 - External file attributes
        entry.externalFileAttributes = buffer.readUInt32LE(38);
        // 42 - Relative offset of local file header
        entry.relativeOffsetOfLocalHeader = buffer.readUInt32LE(42);
        if (entry.generalPurposeBitFlag & 0x40) return emitErrorAndAutoClose(self, new Error("strong encryption is not supported"));
        self.readEntryCursor += 46;
        buffer = newBuffer(entry.fileNameLength + entry.extraFieldLength + entry.fileCommentLength);
        readAndAssertNoEof(self.reader, buffer, 0, buffer.length, self.readEntryCursor, function(err) {
            if (err) return emitErrorAndAutoClose(self, err);
            if (self.emittedError) return;
            // 46 - File name
            entry.fileNameRaw = buffer.subarray(0, entry.fileNameLength);
            // 46+n - Extra field
            var fileCommentStart = entry.fileNameLength + entry.extraFieldLength;
            entry.extraFieldRaw = buffer.subarray(entry.fileNameLength, fileCommentStart);
            // 46+n+m - File comment
            entry.fileCommentRaw = buffer.subarray(fileCommentStart, fileCommentStart + entry.fileCommentLength);
            // Parse the extra fields, which we need for processing other fields.
            try {
                entry.extraFields = parseExtraFields(entry.extraFieldRaw);
            } catch (err) {
                return emitErrorAndAutoClose(self, err);
            }
            // Interpret strings according to bit flags, extra fields, and options.
            if (self.decodeStrings) {
                var isUtf8 = (entry.generalPurposeBitFlag & 0x800) !== 0;
                entry.fileComment = decodeBuffer(entry.fileCommentRaw, isUtf8);
                entry.fileName = getFileNameLowLevel(entry.generalPurposeBitFlag, entry.fileNameRaw, entry.extraFields, self.strictFileNames);
                var errorMessage = validateFileName(entry.fileName);
                if (errorMessage != null) return emitErrorAndAutoClose(self, new Error(errorMessage));
            } else {
                entry.fileComment = entry.fileCommentRaw;
                entry.fileName = entry.fileNameRaw;
            }
            // Maintain API compatibility. See https://github.com/thejoshwolfe/yauzl/issues/47
            entry.comment = entry.fileComment;
            self.readEntryCursor += buffer.length;
            self.entriesRead += 1;
            // Check for the Zip64 Extended Information Extra Field.
            for(var i = 0; i < entry.extraFields.length; i++){
                var extraField = entry.extraFields[i];
                if (extraField.id !== 0x0001) continue;
                // Found it.
                var zip64EiefBuffer = extraField.data;
                var index = 0;
                // 0 - Original Size          8 bytes
                if (entry.uncompressedSize === 0xffffffff) {
                    if (index + 8 > zip64EiefBuffer.length) {
                        return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include uncompressed size"));
                    }
                    entry.uncompressedSize = readUInt64LE(zip64EiefBuffer, index);
                    index += 8;
                }
                // 8 - Compressed Size        8 bytes
                if (entry.compressedSize === 0xffffffff) {
                    if (index + 8 > zip64EiefBuffer.length) {
                        return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include compressed size"));
                    }
                    entry.compressedSize = readUInt64LE(zip64EiefBuffer, index);
                    index += 8;
                }
                // 16 - Relative Header Offset 8 bytes
                if (entry.relativeOffsetOfLocalHeader === 0xffffffff) {
                    if (index + 8 > zip64EiefBuffer.length) {
                        return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include relative header offset"));
                    }
                    entry.relativeOffsetOfLocalHeader = readUInt64LE(zip64EiefBuffer, index);
                    index += 8;
                }
                break;
            }
            // validate file size
            if (self.validateEntrySizes && entry.compressionMethod === 0) {
                var expectedCompressedSize = entry.uncompressedSize;
                if (entry.isEncrypted()) {
                    // traditional encryption prefixes the file data with a header
                    expectedCompressedSize += 12;
                }
                if (entry.compressedSize !== expectedCompressedSize) {
                    var msg = "compressed/uncompressed size mismatch for stored file: " + entry.compressedSize + " != " + entry.uncompressedSize;
                    return emitErrorAndAutoClose(self, new Error(msg));
                }
            }
            self.emit("entry", entry);
            if (!self.lazyEntries) self._readEntry();
        });
    });
};
ZipFile.prototype.eachEntry = function() {
    const self = this;
    if (!self.lazyEntries) throw new Error("eachEntry() requires lazyEntries: true");
    if (self.hasEachEntryBeenCalled) throw new Error("eachEntry() must only be called once per ZipFile");
    self.hasEachEntryBeenCalled = true;
    let pendingResolveReject = null;
    self.on("entry", onEntry);
    self.on("end", onEnd);
    self.on("error", onError);
    function cleanup() {
        self.removeListener("entry", onEntry);
        self.removeListener("end", onEnd);
        self.removeListener("error", onError);
        if (self.autoClose) self.close();
    }
    function onEntry(entry) {
        let { resolve } = pendingResolveReject;
        pendingResolveReject = null;
        resolve({
            value: entry
        });
    }
    function onEnd() {
        let { resolve } = pendingResolveReject;
        pendingResolveReject = null;
        cleanup();
        resolve({
            done: true
        });
    }
    function onError(err) {
        let { reject } = pendingResolveReject;
        pendingResolveReject = null;
        cleanup();
        reject(err);
    }
    return {
        [Symbol.asyncIterator] () {
            // Called once by `for await...of`.
            return this;
        },
        next () {
            // Called on each iteration in a `for await...of`.
            const promise = new Promise((resolve, reject)=>{
                if (pendingResolveReject != null) throw new Error("next() called before previous Promise was resolved.");
                pendingResolveReject = {
                    resolve,
                    reject
                };
            });
            self.readEntry();
            return promise;
        },
        return (value) {
            // Called when breaking, returning, throwing out of a `for await...of`.
            cleanup();
            return Promise.resolve({
                done: true,
                value
            });
        },
        throw (value) {
            // Almost never called. Something about `yield*` maybe?
            cleanup();
            return Promise.reject(value);
        }
    };
};
ZipFile.prototype.openReadStream = function(entry, options1, callback) {
    var self = this;
    // parameter validation
    var relativeStart = 0;
    var relativeEnd = entry.compressedSize;
    if (callback == null) {
        callback = options1;
        options1 = null;
    }
    if (options1 == null) {
        options1 = {};
    } else {
        if (options1.decodeFileData === false) {
            // new, simple option
            if (options1.decrypt != null) {
                throw new Error("cannot use options.decrypt when options.decodeFileData === false");
            }
            if (options1.decompress != null) {
                throw new Error("cannot use options.decompress when options.decodeFileData === false");
            }
        // start and end are allowed
        } else {
            // old, complicated options
            if (options1.decrypt != null) {
                if (!entry.isEncrypted()) {
                    throw new Error("options.decrypt can only be specified for encrypted entries. See also option decodeFileData.");
                }
                if (options1.decrypt !== false) throw new Error("invalid options.decrypt value: " + options1.decrypt);
                if (entry.isCompressed()) {
                    if (options1.decompress !== false) throw new Error("entry is encrypted and compressed, and options.decompress !== false. See also option decodeFileData.");
                }
            }
            if (options1.decompress != null) {
                if (!entry.isCompressed()) {
                    throw new Error("options.decompress can only be specified for compressed entries. See also option decodeFileData.");
                }
                if (!(options1.decompress === false || options1.decompress === true)) {
                    throw new Error("invalid options.decompress value: " + options1.decompress);
                }
                decompress = options1.decompress;
            }
        }
        if (options1.start != null) {
            relativeStart = options1.start;
            if (relativeStart < 0) throw new Error("options.start < 0");
            if (relativeStart > entry.compressedSize) throw new Error("options.start > entry.compressedSize");
        }
        if (options1.end != null) {
            relativeEnd = options1.end;
            if (relativeEnd < 0) throw new Error("options.end < 0");
            if (relativeEnd > entry.compressedSize) throw new Error("options.end > entry.compressedSize");
            if (relativeEnd < relativeStart) throw new Error("options.end < options.start");
        }
    }
    var rawMode = options1.decodeFileData === false || (entry.compressionMethod === 0 || entry.compressionMethod === 8 && options1.decompress === false // Deprecated compression bypass option.
    ) && (!entry.isEncrypted() || // Naturally without encryption.
    options1.decrypt === false // Deprecated encryption bypass option.
    );
    if (options1.start != null || options1.end != null) {
        // Ensure slicing deals with raw data.
        if (!rawMode) throw new Error("start/end range require options.decodeFileData === false for non-trivial encoded entries.");
    }
    // any further errors can either be caused by the zipfile,
    // or were introduced in a minor version of yauzl,
    // so should be passed to the client rather than thrown.
    if (!self.isOpen) return callback(new Error("closed"));
    if (entry.isEncrypted() && !rawMode) {
        if (options1.decrypt !== false) return callback(new Error("entry is encrypted, and options.decodeFileData !== false"));
    }
    var decompress;
    if (rawMode) {
        decompress = false;
    } else if (entry.compressionMethod === 8) {
        // 8 - The file is Deflated
        decompress = options1.decodeFileData !== true;
    } else {
        return callback(new Error("unsupported compression method: " + entry.compressionMethod));
    }
    self.readLocalFileHeader(entry, {
        minimal: true
    }, function(err, localFileHeader) {
        if (err) return callback(err);
        self.openReadStreamLowLevel(localFileHeader.fileDataStart, entry.compressedSize, relativeStart, relativeEnd, decompress, entry.uncompressedSize, callback);
    });
};
ZipFile.prototype.openReadStreamLowLevel = function(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize, callback) {
    var self = this;
    var fileDataEnd = fileDataStart + compressedSize;
    var readStream = self.reader.createReadStream({
        start: fileDataStart + relativeStart,
        end: fileDataStart + relativeEnd
    });
    var endpointStream = readStream;
    if (decompress) {
        var destroyed = false;
        var inflateFilter = zlib.createInflateRaw();
        readStream.on("error", function(err) {
            // setImmediate here because errors can be emitted during the first call to pipe()
            setImmediate(function() {
                if (!destroyed) inflateFilter.emit("error", err);
            });
        });
        readStream.pipe(inflateFilter);
        if (self.validateEntrySizes) {
            endpointStream = new AssertByteCountStream(uncompressedSize);
            inflateFilter.on("error", function(err) {
                // forward zlib errors to the client-visible stream
                setImmediate(function() {
                    if (!destroyed) endpointStream.emit("error", err);
                });
            });
            inflateFilter.pipe(endpointStream);
        } else {
            // the zlib filter is the client-visible stream
            endpointStream = inflateFilter;
        }
        // this is part of yauzl's API, so implement this function on the client-visible stream
        installDestroyFn(endpointStream, function() {
            destroyed = true;
            if (inflateFilter !== endpointStream) inflateFilter.unpipe(endpointStream);
            readStream.unpipe(inflateFilter);
            // TODO: the inflateFilter may cause a memory leak. see Issue #27.
            readStream.destroy();
        });
    }
    callback(null, endpointStream);
};
ZipFile.prototype.readLocalFileHeader = function(entry, options1, callback) {
    var self = this;
    if (callback == null) {
        callback = options1;
        options1 = null;
    }
    if (options1 == null) options1 = {};
    self.reader.ref();
    var buffer = newBuffer(30);
    readAndAssertNoEof(self.reader, buffer, 0, buffer.length, entry.relativeOffsetOfLocalHeader, function(err) {
        try {
            if (err) return callback(err);
            // 0 - Local file header signature = 0x04034b50
            var signature = buffer.readUInt32LE(0);
            if (signature !== 0x04034b50) {
                return callback(new Error("invalid local file header signature: 0x" + signature.toString(16)));
            }
            var fileNameLength = buffer.readUInt16LE(26);
            var extraFieldLength = buffer.readUInt16LE(28);
            var fileDataStart = entry.relativeOffsetOfLocalHeader + 30 + fileNameLength + extraFieldLength;
            // We now have enough information to do this bounds check.
            if (fileDataStart + entry.compressedSize > self.fileSize) {
                return callback(new Error("file data overflows file bounds: " + fileDataStart + " + " + entry.compressedSize + " > " + self.fileSize));
            }
            if (options1.minimal) {
                return callback(null, {
                    fileDataStart: fileDataStart
                });
            }
            var localFileHeader = new LocalFileHeader();
            localFileHeader.fileDataStart = fileDataStart;
            // 4 - Version needed to extract (minimum)
            localFileHeader.versionNeededToExtract = buffer.readUInt16LE(4);
            // 6 - General purpose bit flag
            localFileHeader.generalPurposeBitFlag = buffer.readUInt16LE(6);
            // 8 - Compression method
            localFileHeader.compressionMethod = buffer.readUInt16LE(8);
            // 10 - File last modification time
            localFileHeader.lastModFileTime = buffer.readUInt16LE(10);
            // 12 - File last modification date
            localFileHeader.lastModFileDate = buffer.readUInt16LE(12);
            // 14 - CRC-32
            localFileHeader.crc32 = buffer.readUInt32LE(14);
            // 18 - Compressed size
            localFileHeader.compressedSize = buffer.readUInt32LE(18);
            // 22 - Uncompressed size
            localFileHeader.uncompressedSize = buffer.readUInt32LE(22);
            // 26 - File name length (n)
            localFileHeader.fileNameLength = fileNameLength;
            // 28 - Extra field length (m)
            localFileHeader.extraFieldLength = extraFieldLength;
            // 30 - File name
            // 30+n - Extra field
            buffer = newBuffer(fileNameLength + extraFieldLength);
            self.reader.ref();
            readAndAssertNoEof(self.reader, buffer, 0, buffer.length, entry.relativeOffsetOfLocalHeader + 30, function(err) {
                try {
                    if (err) return callback(err);
                    localFileHeader.fileName = buffer.subarray(0, fileNameLength);
                    localFileHeader.extraField = buffer.subarray(fileNameLength);
                    return callback(null, localFileHeader);
                } finally{
                    self.reader.unref();
                }
            });
        } finally{
            self.reader.unref();
        }
    });
};
ZipFile.prototype.openReadStreamPromise = function(entry, options1) {
    return new Promise((resolve, reject)=>{
        this.openReadStream(entry, options1, function(err, readStream) {
            if (err) return reject(err);
            resolve(readStream);
        });
    });
};
ZipFile.prototype.openReadStreamLowLevelPromise = function(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize) {
    return new Promise((resolve, reject)=>{
        this.openReadStream(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize, function(err, readStream) {
            if (err) return reject(err);
            resolve(readStream);
        });
    });
};
ZipFile.prototype.readLocalFileHeaderPromise = function(entry, options1) {
    return new Promise((resolve, reject)=>{
        this.readLocalFileHeader(entry, options1, function(err, localFileHeader) {
            if (err) return reject(err);
            resolve(localFileHeader);
        });
    });
};
function Entry() {}
Entry.prototype.getLastModDate = function(options1) {
    if (options1 == null) options1 = {};
    if (!options1.forceDosFormat) {
        // Check extended fields.
        for(var i = 0; i < this.extraFields.length; i++){
            var extraField = this.extraFields[i];
            if (extraField.id === 0x5455) {
                // Info-ZIP "universal timestamp" extended field (`0x5455` aka `"UT"`).
                // See the Info-ZIP source code unix/unix.c:set_extra_field() and zipfile.c:ef_scan_ut_time().
                var data = extraField.data;
                if (data.length < 5) continue; // Too short.
                // The flags define which of the three fields are present: mtime, atime, ctime.
                // We only care about mtime.
                // Also, ctime is never included in practice.
                // And also, atime is only included in the local file header for some reason
                // despite the flags lying about its inclusion in the central header.
                var flags = data[0];
                var HAS_MTIME = 1;
                if (!(flags & HAS_MTIME)) continue; // This will realistically never happen.
                // Although the positions of all of the fields shift around depending on the presence of other fields,
                // mtime is always first if present, and that's the only one we care about.
                var posixTimestamp = data.readInt32LE(1);
                return new Date(posixTimestamp * 1000);
            } else if (extraField.id === 0x000a) {
                var data = extraField.data;
                if (data.length !== 32) continue; // The length is always the same.
                // 4 bytes reserved
                // 2 bytes Tag
                if (data.readUInt16LE(4) !== 1) continue; // Tag1 is actually the only defined Tag.
                // 2 bytes Size
                if (data.readUInt16LE(6) !== 24) continue; // Size is always 24.
                // 8 bytes Mtime
                var hundredNanoSecondsSince1601 = data.readUInt32LE(8) + 4294967296 * data.readInt32LE(12);
                // Convert from NTFS to POSIX milliseconds.
                // The big number below is the milliseconds between year 1601 and year 1970
                // (i.e. the negative POSIX timestamp of 1601-01-01 00:00:00Z)
                var millisecondsSince1970 = hundredNanoSecondsSince1601 / 10000 - 11644473600000;
                // Note on numeric precision: JavaScript Number objects lose precision above Number.MAX_SAFE_INTEGER,
                // and NTFS timestamps are typically much bigger than that limit.
                // (MAX_SAFE_INTEGER would represent 1629-07-17T23:58:45.475Z.)
                // However, we're losing precision in the conversion from 100nanosecond units to millisecond units anyway,
                // and the time at which we also lose 1-millisecond precision is year 275760, the JavaScript Date limit (by design).
                // Up through the year 2057, this conversion only drops 4 bits of precision,
                // which is well under the 13-14 bits ratio between the milliseconds and 100nanoseconds.
                return new Date(millisecondsSince1970);
            }
        }
    }
    // Fallback to non-extended encoding.
    return dosDateTimeToDate(this.lastModFileDate, this.lastModFileTime, options1.timezone);
};
Entry.prototype.canDecodeFileData = function() {
    return !this.isEncrypted() && (this.compressionMethod === 0 || this.compressionMethod === 8);
};
Entry.prototype.isEncrypted = function() {
    return (this.generalPurposeBitFlag & 0x1) !== 0;
};
Entry.prototype.isCompressed = function() {
    return this.compressionMethod === 8;
};
function LocalFileHeader() {}
function dosDateTimeToDate(date, time, timezone) {
    var day = date & 0x1f; // 1-31
    var month = (date >> 5 & 0xf) - 1; // 1-12, 0-11
    var year = (date >> 9 & 0x7f) + 1980; // 0-128, 1980-2108
    var millisecond = 0;
    var second = (time & 0x1f) * 2; // 0-29, 0-58 (even numbers)
    var minute = time >> 5 & 0x3f; // 0-59
    var hour = time >> 11 & 0x1f; // 0-23
    if (timezone == null || timezone === "local") {
        return new Date(year, month, day, hour, minute, second, millisecond);
    } else if (timezone === "UTC") {
        return new Date(Date.UTC(year, month, day, hour, minute, second, millisecond));
    } else {
        throw new Error("unrecognized options.timezone: " + options.timezone);
    }
}
function getFileNameLowLevel(generalPurposeBitFlag, fileNameBuffer, extraFields, strictFileNames) {
    var fileName = null;
    // check for Info-ZIP Unicode Path Extra Field (0x7075)
    // see https://github.com/thejoshwolfe/yauzl/issues/33
    for(var i = 0; i < extraFields.length; i++){
        var extraField = extraFields[i];
        if (extraField.id === 0x7075) {
            if (extraField.data.length < 6) {
                continue;
            }
            // Version       1 byte      version of this extra field, currently 1
            if (extraField.data.readUInt8(0) !== 1) {
                continue;
            }
            // NameCRC32     4 bytes     File Name Field CRC32 Checksum
            var oldNameCrc32 = extraField.data.readUInt32LE(1);
            if (crc32(fileNameBuffer) !== oldNameCrc32) {
                continue;
            }
            // UnicodeName   Variable    UTF-8 version of the entry File Name
            fileName = decodeBuffer(extraField.data.subarray(5), true);
            break;
        }
    }
    if (fileName == null) {
        // The typical case.
        var isUtf8 = (generalPurposeBitFlag & 0x800) !== 0;
        fileName = decodeBuffer(fileNameBuffer, isUtf8);
    }
    if (!strictFileNames) {
        // Allow backslash.
        fileName = fileName.replace(/\\/g, "/");
    }
    return fileName;
}
function validateFileName(fileName) {
    if (fileName.indexOf("\\") !== -1) {
        return "invalid characters in fileName: " + fileName;
    }
    if (/^[a-zA-Z]:/.test(fileName) || /^\//.test(fileName)) {
        return "absolute path: " + fileName;
    }
    if (fileName.split("/").indexOf("..") !== -1) {
        return "invalid relative path: " + fileName;
    }
    // all good
    return null;
}
function parseExtraFields(extraFieldBuffer) {
    var extraFields = [];
    var i = 0;
    while(i < extraFieldBuffer.length - 3){
        var headerId = extraFieldBuffer.readUInt16LE(i + 0);
        var dataSize = extraFieldBuffer.readUInt16LE(i + 2);
        var dataStart = i + 4;
        var dataEnd = dataStart + dataSize;
        if (dataEnd > extraFieldBuffer.length) throw new Error("extra field length exceeds extra field buffer size");
        var dataBuffer = extraFieldBuffer.subarray(dataStart, dataEnd);
        extraFields.push({
            id: headerId,
            data: dataBuffer
        });
        i = dataEnd;
    }
    return extraFields;
}
function readAndAssertNoEof(reader, buffer, offset, length, position, callback) {
    if (length === 0) {
        // fs.read will throw an out-of-bounds error if you try to read 0 bytes from a 0 byte file
        return setImmediate(function() {
            callback(null, newBuffer(0));
        });
    }
    reader.read(buffer, offset, length, position, function(err, bytesRead) {
        if (err) return callback(err);
        if (bytesRead < length) {
            return callback(new Error("unexpected EOF"));
        }
        callback();
    });
}
util.inherits(AssertByteCountStream, Transform);
function AssertByteCountStream(byteCount) {
    Transform.call(this);
    this.actualByteCount = 0;
    this.expectedByteCount = byteCount;
}
AssertByteCountStream.prototype._transform = function(chunk, encoding, cb) {
    this.actualByteCount += chunk.length;
    if (this.actualByteCount > this.expectedByteCount) {
        var msg = "too many bytes in the stream. expected " + this.expectedByteCount + ". got at least " + this.actualByteCount;
        return cb(new Error(msg));
    }
    cb(null, chunk);
};
AssertByteCountStream.prototype._flush = function(cb) {
    if (this.actualByteCount < this.expectedByteCount) {
        var msg = "not enough bytes in the stream. expected " + this.expectedByteCount + ". got only " + this.actualByteCount;
        return cb(new Error(msg));
    }
    cb();
};
util.inherits(RandomAccessReader, EventEmitter);
function RandomAccessReader() {
    EventEmitter.call(this);
    this.refCount = 0;
}
RandomAccessReader.prototype.ref = function() {
    this.refCount += 1;
};
RandomAccessReader.prototype.unref = function() {
    var self = this;
    self.refCount -= 1;
    if (self.refCount > 0) return;
    if (self.refCount < 0) throw new Error("invalid unref");
    self.close(onCloseDone);
    function onCloseDone(err) {
        if (err) return self.emit('error', err);
        self.emit('close');
    }
};
RandomAccessReader.prototype.createReadStream = function(options1) {
    if (options1 == null) options1 = {};
    var start = options1.start;
    var end = options1.end;
    if (start === end) {
        var emptyStream = new PassThrough();
        setImmediate(function() {
            emptyStream.end();
        });
        return emptyStream;
    }
    var stream = this._readStreamForRange(start, end);
    var destroyed = false;
    var refUnrefFilter = new RefUnrefFilter(this);
    stream.on("error", function(err) {
        setImmediate(function() {
            if (!destroyed) refUnrefFilter.emit("error", err);
        });
    });
    installDestroyFn(refUnrefFilter, function() {
        stream.unpipe(refUnrefFilter);
        refUnrefFilter.unref();
        stream.destroy();
    });
    var byteCounter = new AssertByteCountStream(end - start);
    refUnrefFilter.on("error", function(err) {
        setImmediate(function() {
            if (!destroyed) byteCounter.emit("error", err);
        });
    });
    installDestroyFn(byteCounter, function() {
        destroyed = true;
        refUnrefFilter.unpipe(byteCounter);
        refUnrefFilter.destroy();
    });
    return stream.pipe(refUnrefFilter).pipe(byteCounter);
};
RandomAccessReader.prototype._readStreamForRange = function(start, end) {
    throw new Error("not implemented");
};
RandomAccessReader.prototype.read = function(buffer, offset, length, position, callback) {
    var readStream = this.createReadStream({
        start: position,
        end: position + length
    });
    var writeStream = new Writable();
    var written = 0;
    writeStream._write = function(chunk, encoding, cb) {
        chunk.copy(buffer, offset + written, 0, chunk.length);
        written += chunk.length;
        cb();
    };
    writeStream.on("finish", callback);
    readStream.on("error", function(error) {
        callback(error);
    });
    readStream.pipe(writeStream);
};
RandomAccessReader.prototype.close = function(callback) {
    setImmediate(callback);
};
util.inherits(RefUnrefFilter, PassThrough);
function RefUnrefFilter(context) {
    PassThrough.call(this);
    this.context = context;
    this.context.ref();
    this.unreffedYet = false;
}
RefUnrefFilter.prototype._flush = function(cb) {
    this.unref();
    cb();
};
RefUnrefFilter.prototype.unref = function(cb) {
    if (this.unreffedYet) return;
    this.unreffedYet = true;
    this.context.unref();
};
var cp437 = '\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
function decodeBuffer(buffer, isUtf8) {
    if (isUtf8) {
        return buffer.toString("utf8");
    } else {
        var result = "";
        for(var i = 0; i < buffer.length; i++){
            result += cp437[buffer[i]];
        }
        return result;
    }
}
function readUInt64LE(buffer, offset) {
    // There is no native function for this, because we can't actually store 64-bit integers precisely.
    // after 53 bits, JavaScript's Number type (IEEE 754 double) can't store individual integers anymore.
    // but since 53 bits is a whole lot more than 32 bits, we do our best anyway.
    // As of 2020, Node has added support for BigInt, which obviates this whole function,
    // but yauzl hasn't been updated to depend on BigInt (yet?).
    var lower32 = buffer.readUInt32LE(offset);
    var upper32 = buffer.readUInt32LE(offset + 4);
    // we can't use bitshifting here, because JavaScript bitshifting only works on 32-bit integers.
    return upper32 * 0x100000000 + lower32;
// as long as we're bounds checking the result of this function against the total file size,
// we'll catch any overflow errors, because we already made sure the total file size was within reason.
}
// Node 10 deprecated new Buffer().
var newBuffer;
if (typeof Buffer.allocUnsafe === "function") {
    newBuffer = function(len) {
        return Buffer.allocUnsafe(len);
    };
} else {
    newBuffer = function(len) {
        return new Buffer(len);
    };
}
// Node 8 introduced a proper destroy() implementation on writable streams.
function installDestroyFn(stream, fn) {
    if (typeof stream.destroy === "function") {
        // New API.
        stream._destroy = function(err, cb) {
            fn();
            if (cb != null) cb(err);
        };
    } else {
        // Old API.
        stream.destroy = fn;
    }
}
function defaultCallback(err) {
    if (err) throw err;
}
}),
];

//# sourceMappingURL=1vuu_05lj2ry._.js.map