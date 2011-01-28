// # protocol.js #
//
// Concisely describe a Relay stream protocol and export it to an
// api-module format.

define(['exports', 'net', 'assert', 'relay-core/network', './util'],
function(exports, Net, Assert, CoreNet, U) {

  exports.protocol = protocol;
  exports.Prototol = Protocol;
  exports.message = message;
  exports.Message = Message;

  
  // ## Protocol ##

  // A Protocol defines a stream interface. Message types and Stream
  // methods can be declared. The `.api()` method can be used to
  // export the protocol as a set of methods. In this way, an
  // api-module can be defined concisely.

  function protocol(name) {
    return new Protocol(name);
  }

  function Protocol(name) {
    this.name = name;
    this._types = {};
    this._stream = {};
  }

  Protocol.prototype.toString = function() {
    return '#<Protocol ' + this.name + '>';
  };

  Protocol.prototype.type = function() {
    return U.access(this, this._types, arguments);
  };

  Protocol.prototype.stream = function() {
    return U.access(this, this._stream, arguments);
  };

  Protocol.prototype.api = function() {
    return new Api(this);
  };

  // An API is a set of methods for constructing messages, servers,
  // and streams.
  //
  // The interface contains any message constructors delcared by
  // Protocol.type() and:
  //
  // + message()              -- construct a Message
  // + inspectMessage()       -- load a message
  // + Stream()               -- Stream type with methods declared by Protocol.stream()
  // + createConnection()     -- Open a client stream
  // + persistentConnection() -- Open a client stream that automatically reconnects.
  // + createServer()         -- Make a new Server

  function Api(protocol) {
    this.name = protocol.name;
    U.extend(this, protocol._types);
    U.extend(this, makeStreamApi(this, protocol._stream));
  }

  Api.prototype.toString = function() {
    return '#<' + this.name + ' Api>';
  };

  Api.prototype.inspectMessage = inspect;
  Api.prototype.message = message;

  
  // ## Network ##

  // Create the stream portion of an API.
  function makeStreamApi(api, methods) {

    U.inherits(ApiStream, Stream);
    function ApiStream(channel, name, peer) {
      Stream.call(this, api, channel, name, peer);
    }
    U.extend(ApiStream.prototype, methods);

    return {
      Stream: ApiStream,

      createServer: function(name, listener) {
        return createServer(api, name, listener);
      },

      createConnection: function(port, host) {
        return createConnection(api, port, host);
      },

      persistentConnection: function(port, host) {
        return persistentConnection(api, port, host);
      }
    };
  }

  
  // ## Message ##

  // Construct and load messages. A Message instance is a jQuery-style
  // object with methods such as `.attr()`, `.body()`, and `.status()`
  // that can be used to incrementally add attributes or data. The
  // `dump()` method exports it to JSON.

  function message(type, attr, body) {
    attr = attr || {};
    attr.type = type;
    return new Message(attr, body);
  }


  function inspect(data) {
    return Message.load(data);
  }

  function Message(attr, body) {
    this._attr = attr || {};
    this._body = body || {};
  }

  U.proxyProps(Message, ['type', 'id', 'to', 'from'], function() {
    return this._attr;
  });

  Message.load = function(data) {
    return new Message(data, U.pop(data, 'body'));
  };

  Message.prototype.dump = function() {
    return U.extendDef({ type: this.type, body: this._body }, this._attr);
  };

  Message.prototype.toString = function() {
    return '#<' + this.type + '>';
  };

  Message.prototype.attr = function(key, val) {
    return U.access(this, this._attr, arguments);
  };

  Message.prototype.body = function(key, val) {
    return U.access(this, this._body, arguments);
  };

  Message.prototype.status = function(val) {
    return (arguments.length == 0) ? this.body('status') :
      this.body('status', val);
  };

  
  // ## Server ##

  function createServer(api, name, listener) {
    if (arguments.length == 1) {
      listener = name;
      name = undefined;
    }
    return new Server(api, name, listener);
  }

  U.inherits(Server, U.EventEmitter);
  function Server(api, name, listener) {
    U.EventEmitter.call(this);

    this.api = api;
    this.name = name || U.gensym();

    if (listener)
      this.on('connection', listener);

    var self = this;

    this.server = Net.createServer(function(stream) {
      var link = new CoreNet.ApplicationSocketLink(stream, api);
      link.on('channel', function(channel) {
        self.emit('connection', new api.Stream(channel, self.identity()));
      });
    });

    U.proxyEvents(['error', 'close'], this.server, this);
  }

  Server.prototype.toString = function() {
    return '#<' + this.api.name + ' Server ' + this.identity() + '>';
  };

  Server.prototype.identity = function(name) {
    if (arguments.length == 0)
      return this.name;
    this.name = name;
    return this;
  };

  Server.prototype.peer = function(name) {
    if (arguments.length == 0)
      return this.peerName;
    this.peerName = name;
    return this;
  };

  Server.prototype.listen = function(port, host) {
    var remote = U.hostname(port, host);
    this.server.listen(remote.port, remote.host);
    return this;
  };

  Server.prototype.close = function() {
    this.server.close();
    return this;
  };

  
  // ## Persistent Connection ##

  var RETRY_DEFAULT = 200,
      RETRY_MAX = 1 * 60 * 1000, // 1 minute.
      RETRY_MULTIPLE = 2;

  function persistentConnection(api, port, host) {
    var retry = RETRY_DEFAULT,
        remote = U.hostname(port, host),
        stream = createConnection(api, remote);

    function reconnect() {
      stream.useChannel(createChannel(api, remote));
    }

    return stream
      .on('connect', function() {
        retry = RETRY_DEFAULT;
        this.setKeepAlive(true);
      })
      .on('error', function() {
        // Noop: stop Node from triggering a top-level exception.
      })
      .on('close', function() {
        retry = Math.min(retry * RETRY_MULTIPLE, RETRY_MAX);
        stream.emit('disconnect', retry);
        setTimeout(reconnect, retry);
      });
  }

  function createChannel(api, port, host) {
    var remote = U.hostname(port, host),
        stream = Net.createConnection(remote.port, remote.host),
        link = new CoreNet.ApplicationSocketLink(stream, api);
    return link.newChannel();
  }

  
  // ## Client ##

  function createConnection(api, port, host) {
    var remote = U.hostname(port, host),
        channel = createChannel(api, remote);
    return new api.Stream(channel, null, remote.hostname());
  }

  U.inherits(Stream, U.EventEmitter);
  function Stream(api, channel, name, peer) {
    U.EventEmitter.call(this);
    this.api = api;
    this.name = name || U.gensym();
    this.peerName = peer || null;
    channel && this.useChannel(channel);
  }

  U.proxyProps(Stream, ['readyState', 'readable', 'writable'], function() {
    return this.getSocket();
  });

  Stream.prototype.getSocket = function() {
    return this.channel.getSocket();
  };

  Stream.prototype.useChannel = function(channel) {
    this.channel = channel;
    U.proxyEvents(['connect', 'end', 'error', 'close', 'data'], channel, this);
    emitMessages(this.api, channel, this);
    return this;
  };

  Stream.prototype.setKeepAlive = function() {
    this.getSocket().setKeepAlive();
    return this;
  };

  Stream.prototype.toString = function() {
    return '#<' + this.api.name + ' Stream ' + this.identity() + '>';
  };

  Stream.prototype.identity = function(name) {
    if (arguments.length == 0)
      return this.name;
    this.name = name;
    return this;
  };

  Stream.prototype.peer = function(name) {
    if (arguments.length == 0)
      return this.peerName;
    this.peerName = name;
    return this;
  };

  Stream.prototype.bounce = function(mesg) {
    return this.channel.send(mesg);
  };

  Stream.prototype.send = function(mesg, next) {
    Assert.ok(mesg.to, 'Missing `to` attribute.');
    Assert.ok(mesg.from, 'Missing `from` attribute.');
    return this.channel.send(mesg, next);
  };

  Stream.prototype.reply = function(orig, mesg, next) {
    if (orig)
      mesg.attr({ to: orig.from, from: this.identity(), id: orig.id });
    return this.send(mesg, next);
  };

  Stream.prototype.dm = function(mesg, next) {
    return this.send(mesg.attr({ from: this.identity(), to: this.peer() }), next);
  };

  
  // ## Message Handler ##

  // Create an message handler for an API that emits messages as Node
  // Events.

  function emitMessages(api, from, into) {
    var handler = {},
        emit = messageEmitter(into);

    for (var type in api)
      handler[type] = emit;

    handler.Error = errorHandler(into);

    from.bindMessageHandler(handler);
    return from;
  }

  function messageEmitter(stream) {
    return function emitMessage(mesg, resp) {
      var type = mesg.type;
      if (!stream.emit(type, mesg, resp) || stream.emit('data', mesg, resp)) {
        console.log('## Unexpected Message ##');
        console.dir(mesg);
        stream.emit('error', 'Unexpected "' + type + '" message.');
      }
    };
  }

  function errorHandler(stream) {
    return function emitError(mesg, resp) {
      if (!stream.emit(mesg.type, mesg, resp)) {
        console.log('## Received Unhandled Error ##');
        console.dir(mesg);
        stream.emit('error', mesg.body());
      }
    };
  }

});