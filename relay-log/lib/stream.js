define(['exports', 'net', 'assert', 'relay-core/network', './api', './util'],
function(exports, Net, Assert, CoreNet, Api, U) {

  exports.createServer = createServer;
  exports.Server = Server;
  exports.persistentConnection = persistentConnection;
  exports.createConnection = createConnection;
  exports.Stream = Stream;

  
  // ## Server ##

  function createServer(name, listener) {
    if (arguments.length == 1) {
      listener = name;
      name = undefined;
    }
    return new Server(name, listener);
  }

  U.inherits(Server, U.EventEmitter);
  function Server(name, listener) {
    U.EventEmitter.call(this);

    this.name = name || U.gensym();

    if (listener)
      this.on('connection', listener);

    var self = this;

    this.server = Net.createServer(function(stream) {
      var link = new CoreNet.ApplicationSocketLink(stream, Api);
      link.on('channel', function(channel) {
        self.emit('connection', new Stream(channel, self.identity()));
      });
    });

    U.proxyEvents(['error', 'close'], this.server, this);
  }

  Server.prototype.toString = function() {
    return '#<Server ' + this.identity() + '>';
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

  function persistentConnection(port, host) {
    var retry = RETRY_DEFAULT,
        remote = U.hostname(port, host),
        stream = createConnection(remote);

    function reconnect() {
      stream.useChannel(createChannel(remote));
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
    var remote = U.hostname(port, host),
        stream = Net.createConnection(remote.port, remote.host),
        link = new CoreNet.ApplicationSocketLink(stream, Api);
    return link.newChannel();
  }

  
  // ## Client ##

  function createConnection(port, host) {
    var remote = U.hostname(port, host),
        channel = createChannel(remote.port, remote.host);
    return new Stream(channel, null, remote.hostname());
  }

  U.inherits(Stream, U.EventEmitter);
  function Stream(channel, name, peer) {
    U.EventEmitter.call(this);
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
    emitMessages(Api, channel, this);
    return this;
  };

  Stream.prototype.setKeepAlive = function() {
    this.getSocket().setKeepAlive();
    return this;
  };

  Stream.prototype.toString = function() {
    return '#<Stream ' + this.identity() + '>';
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

  Stream.prototype.Error = function(err, status, orig) {
    if (typeof status == 'object') {
      orig = status;
      status = undefined;
    }

    err = Api.Error(err, status, orig);
    return orig ? this.reply(orig, err) : this.send(err);
  };

  Stream.prototype.Source = function(next) {
    return this.dm(Api.Source(), next);
  };

  Stream.prototype.Ok = function(orig) {
    return this.reply(orig, Api.OK());
  };

  Stream.prototype.Push = function(quantum) {
    return this.dm(Api.Push(quantum));
  };

  Stream.prototype.Subscribe = function(app, channel) {
    return this.dm(Api.Subscribe(app, channel));
  };

  Stream.prototype.Update = function(entries) {
    return this.dm(new Api.Update(entries));
  };

  Stream.prototype.Cancel = function(app, channel) {
    return this.dm(new Api.Cancel(app, channel));
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