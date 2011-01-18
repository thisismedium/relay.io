// # stream.js #
//
// A wrapper around the built-in `net` module that assumes stream
// traffic will be JSON objects.

define(['exports', 'net', './util'], function(exports, Net, U) {

  exports.createServer = createServer;
  exports.Server = Server;
  exports.createConnection = createConnection;
  exports.Stream = Stream;

  
  // ## JSON Stream Server ##

  // A JSON server wraps connected streams as a JSON stream. It
  // otherwise behaves like a net.Server.

  function createServer(listener) {
    return new Server(listener);
  }

  U.inherits(Server, U.EventEmitter);
  function Server(listener) {
    U.EventEmitter.call(this);

    if (listener)
      this.on('connection', listener);

    var self = this;

    this.server = Net.createServer(function(stream) {
      self.emit('connection', new Stream(stream));
    });

    U.proxyEvents(['close', 'error'], this.server, this);
  }

  Server.prototype.listen = function() {
    this.server.listen.apply(this.server, arguments);
    return this;
  };

  Server.prototype.close = function() {
    this.server.close();
    return this;
  };

  
  // ## JSON Stream ##

  // A JSON stream parses and stringifies data passing through a
  // net.Stream. That is, `write()` accepts objects and `data` emits
  // objects.
  //
  // The `data` event is extended to emit objects instead of a buffer
  // or string. The second argument emitted from the `data` event is
  // the length of the serialized object in bytes.
  //
  // Likewise, a new `write` event is emitted on each write. The first
  // argument is the object written and the second argument is the
  // length of the serialized object in bytes.
  //
  // For example:
  //
  //   createConnection(...)
  //     .on('data', function(obj, len) {
  //       console.log('recv %d bytes: %j', len, obj);
  //     })
  //     .on('write', function(obj, len) {
  //       console.log('sent %d bytes: %j', len, obj);
  //     });
  //
  // Otherwise, this behaves like a net.Stream.

  function createConnection(port, host) {
    return new Stream(Net.createConnection(port, host));
  }

  U.inherits(Stream, U.EventEmitter);
  function Stream(stream) {
    U.EventEmitter.call(this);
    stream.setEncoding('utf-8');

    var self = this;

    this.stream = stream;

    U.readlines(this.stream, function(line) {
      self.read(line);
    });

    U.proxyEvents(
      ['connect', 'secure', 'end', 'timeout', 'drain', 'error', 'close'],
      stream,
      this);
  }

  Stream.prototype.connect = function(port, host) {
    this.stream.connect(port, host);
    return this;
  };

  Stream.prototype.read = function(data) {
    var err, obj;

    try {
      obj = JSON.parse(data);
    } catch (err) {
      this.emit('error', err);
      return this;
    }

    // The `+1` accounts for the terminal character stripped by
    // `U.readlines()`.
    this.emit('data', obj, Buffer.byteLength(data) + 1);
    return this;
  };

  Stream.prototype.write = function(obj) {
    var err, data;

    try {
      data = JSON.stringify(obj) + '\n';
    } catch (err) {
      this.emit('error', err);
      return true;
    }

    this.emit('write', obj, Buffer.byteLength(data));
    return this.stream.write(data);
  };

  Stream.prototype.end = function(obj) {
    if (obj !== undefined)
      this.write(obj);
    this.stream.end();
    return this;
  };

  Stream.prototype.destroy = function() {
    this.stream.destroy();
    return this;
  };

});