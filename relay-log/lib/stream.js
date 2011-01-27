define(['exports', 'net', 'relay-core/network', './api', './util'],
function(exports, Net, CoreNet, Api, U) {

  exports.createServer = createServer;
  exports.Server = Server;
  exports.persistentConnection = persistentConnection;
  exports.createConnection = createConnection;
  exports.Stream = Stream;

  
  // ## Server ##

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
      var link = new CoreNet.ApplicationSocketLink(stream, Api);
      link.on('channel', function(channel) {
        self.emit('connection', new Stream(channel));
      });
    });

    U.proxyEvents(['error', 'close'], this.server, this);
  }

  Server.prototype.listen = function(port, host) {
    this.server.listen(port, host);
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

  function persistentConnection(port, host) {
    var retry = RETRY_DEFAULT,
        stream = createConnection(port, host);

    function reconnect() {
      stream.useChannel(createChannel(port, host));
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

  function createChannel(port, host) {
    var stream = Net.createConnection(port, host),
        link = new CoreNet.ApplicationSocketLink(stream, Api);
    return link.newChannel();
  }

  
  // ## Client ##

  function createConnection(port, host) {
    return new Stream(createChannel(port, host));
  }

  U.inherits(Stream, U.EventEmitter);
  function Stream(channel) {
    U.EventEmitter.call(this);
    this.id = U.gensym();
    channel && this.useChannel(channel);
  }

  Object.defineProperty(Stream.prototype, 'readyState', {
    get: function() {
      return this.getSocket().readyState;
    }
  });

  Object.defineProperty(Stream.prototype, 'readable', {
    get: function() {
      return this.getSocket().readable;
    }
  });

  Object.defineProperty(Stream.prototype, 'writable', {
    get: function() {
      return this.getSocket().writable;
    }
  });

  Stream.prototype.getSocket = function() {
    return this.channel.getSocket();
  };

  Stream.prototype.useChannel = function(channel) {
    this.channel = channel;
    U.proxyEvents(['connect', 'end', 'error', 'close', 'data'], channel, this);
    routeRpcEvents(Api, channel, this);
    return this;
  };

  Stream.prototype.setKeepAlive = function() {
    this.getSocket().setKeepAlive();
    return this;
  };

  Stream.prototype.write = function(obj, callback) {
    return this.channel.write(obj, callback);
  };

  Stream.prototype.error = function(err, resp) {
    err = new Api.Error(err.toString());
    return resp ? resp.reply(err) : this.channel.write(err);
  };

  Stream.prototype.source = function(callback) {
    return this.write(new Api.Source(), callback);
  };

  Stream.prototype.ok = function(resp) {
    return resp.reply(new Api.OK());
  };

  Stream.prototype.push = function(point) {
    return this.write(new Api.Push(point));
  };

  Stream.prototype.subscribe = function(app, channel) {
    return this.write(new Api.Subscribe(app, channel));
  };

  Stream.prototype.update = function(entries) {
    return this.write(new Api.Update(entries));
  };

  Stream.prototype.cancel = function(app, channel) {
    return this.write(new Api.Cancel(app, channel));
  };

  
  // ## RPC Events ##

  // Create an RPC handler for an API that emits messages as Node
  // Events. If an event has no listener, raise an error.

  function routeRpcEvents(api, from, into) {
    var handler = {},
        route = messageRouter(into);

    for (var type in api)
      handler[type] = route;

    handler.Error = errorRouter(into);
    handler.InvalidMessage = invalidRouter(into);

    from.bindRpcHandler(handler);
    return from;
  }

  function messageRouter(stream) {
    return function routeMessage(mesg, resp) {
      var type = mesg.getType();
      if (!stream.emit(type, mesg, resp))
        stream.emit('error', 'Unexpected "' + mesg.type + '" message.');
    };
  }

  function errorRouter(stream) {
    return function routeError(mesg, resp) {
      if (!stream.emit(mesg.getType(), mesg, resp))
        stream.emit('error', mesg.getError());
    };
  }

  function invalidRouter(stream) {
    return function(mesg, resp) {
      console.log('## Invalid ##');
      console.dir(mesg);
    };
  }

});