define(['exports', 'net', './util'],
function(exports, Net, U) {

  
  // ## JSON Stream Server ##

  // A JSON server wraps connected streams as a JSON stream. It
  // otherwise behaves like a net.Server.

  exports.createServer = createServer;
  exports.Server = Server;

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
  // net.Stream. That is, .write() accepts objects and 'data' emits
  // objects. It otherwise behaves like a net.Stream.

  exports.createConnection = createConnection;
  exports.Stream = Stream;

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

    this.emit('data', obj);
    return this;
  };

  Stream.prototype.write = function(obj) {
    var err, data;

    try {
      data = JSON.stringify(obj);
    } catch (err) {
      this.emit('error', err);
      return true;
    }

    return this.stream.write(data + '\n');
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