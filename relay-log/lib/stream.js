define(['exports', 'net', 'relay-core/network', './api', './util'],
function(exports, Net, CoreNet, Api, U) {

  exports.createServer = createServer;
  exports.Server = Server;
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

    this.server = net.createServer(function(stream) {
      var link = new CoreNet.ApplicationSocketLink(stream);
      link.on('channel', function(channel) {
        self.emit('connection', new Stream(channel, link));
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

  
  // ## Client ##

  function createConnection(port, host) {
    var stream = Net.createConnection(port, host),
        link = new CoreNet.ApplicationSocketLink(stream);
    return new Stream(link.newChannel(), link);
  }

  U.inherits(Stream, U.EventEmitter);
  function Stream(channel, link) {
    U.EventEmitter.call(this);

    this.id = U.gensym();
    this.link = link;
    this.channel = channel;

    U.proxyEvents(['end', 'error', 'close', 'data'], this.channel, this);
    routeRpcEvents(Api, this.channel, this);
  }

  Stream.prototype.write = function(obj, callback) {
    return this.channel.write(obj, callback);
  };

  Stream.prototype.source = function() {
    return this.channel.write(new Api.Source());
  };

  Stream.prototype.ok = function(resp) {
    return resp.reply(new Api.OK());
  };

  Stream.prototype.push = function(point) {
    return this.channel.write(new Api.Push(point));
  };

  Stream.prototype.subscribe = function(app, channel) {
    return this.channel.write(new Api.Subscribe(app, channel));
  };

  Stream.prototype.update = function(entries) {
    return this.channel.write(new Api.Update(entries));
  };

  Stream.prototype.cancel = function(app, channel) {
    return this.channel.write(new Api.Cancel(app, channel));
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

    from.bindRpcHandler(hander);
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

});