define(['exports', 'assert', './util', './stream', './protocol'],
function(exports, Assert, U, Stream, P) {

  exports.App = App;
  exports.createClient = createClient;
  exports.Client = Client;
  exports.message = message;

  
  // ## Application ##

  var HELLO_TIMEOUT = 10000;

  U.inherits(App, U.EventEmitter);
  function App(id) {
    U.EventEmitter.call(this);

    this.id = id;
    this.clients = {};
    this.waiting = {};

    var self = this;

    this.onMessage = function(obj) { self.dispatch(this, obj); };
    this.onClose = function() { self.disconnect(this); };

    P.use(this, P.Server);
  }

  App.prototype.toString = function() {
    return '#<App ' + this.id + '>';
  };

  // ### Dispatch and Routing ###

  App.prototype.dispatch = function(client, obj) {
    var msg = validateMessage(client, obj);
    if (msg && !this.emit(msg.type, msg, client))
      this.broadcast(msg);
    return this;
  };

  App.prototype.broadcast = function(msg) {
    return this.eachOther(msg.client, function(other) {
      msg.sendTo(other);
    });
  };

  App.prototype.eachOther = function(client, fn) {
    for (var id in this.clients) {
      if (id != client.id)
        fn(this.clients[id], id, this);
    }
    return this;
  };

  // ### Connections ###

  App.prototype.connect = function(client) {
    if (client.id in this.clients)
      throw new Error('Client ' + client + ' is already connected to ' + this + '.');

    client
      .on('data', this.onMessage)
      .on('close', this.onClose);

    this.wait(client, HELLO_TIMEOUT, this.onClose);

    return this;
  };

  App.prototype.disconnect = function(client) {
    if (client.id in this.clients) {
      delete this.clients[client.id];
      this.eachOther(client, function(other) {
        other.sendTo('disconnect', client.name);
      });
    }
    return this;
  };

  App.prototype.fail = function(msg, reason) {
    sendError(msg.client, 400, reason, msg.orig);
    return this.terminate(msg.client);
  };

  App.prototype.terminate = function(client) {
    client.end();
    return this;
  };

  // ### Sessions ###

  App.prototype.startSession = function(client, name) {
    this.stopWaiting(client);
    this.clients[client.id] = client.startSession(name);
    return this;
  };

  // FIXME: replace `wait/stopWaiting` with an App-wide check-idle
  // interval.

  App.prototype.wait = function(client, seconds, callback) {
    var self = this;

    this.waiting[client.id] = setTimeout(function() {
      self.stopWaiting(client);
      callback();
    }, seconds * 1000);

    return this;
  };

  App.prototype.stopWaiting = function(client) {
    var probe = this.waiting[client.id];
    if (probe) {
      cancelTimeout(probe);
      delete this.waiting[client.id];
    }
    return this;
  };

  function validateMessage(client, obj) {
    var err;

    try {
      return P.parseMessage(client, obj);
    } catch (err) {
      badRequest(client, err, obj);
      return null;
    }
  }

  function badRequest(client, reason, msg) {
    return sendError(client, 400, reason, msg);
  }

  function unauthorized(client, reason, msg) {
    return sendError(client, 403, reason, msg);
  }

  function sendError(client, status, reason, msg) {
    P.message(client, 'error')
      .data({ reason: reason, message: message })
      .sendTo(client, status);
  }

  
  // ## Client ##

  function createClient(name, port, host) {
    return (new Client(Stream.createConnection(port, host), name));
  }

  U.inherits(Client, U.EventEmitter);
  function Client(stream, name) {
    U.EventEmitter.call(this);

    this.id = U.gensym();
    this.stream = stream;
    this.session = null;

    U.proxyEvents(
      ['connect', 'secure', 'data', 'end', 'timeout', 'error', 'close'],
      stream,
      this);
  }

  Client.prototype.toString = function() {
    var id = this.id,
        session = this.session || '(unknown)';

    return '#<Client ' + id + ' ' + session + '>';
  };

  Client.prototype.write = function(obj) {
    return this.stream.write(obj);
  };

  Client.prototype.end = function() {
    this.stream.end();
    return this;
  };

  Client.prototype.startSession = function(name, id) {
    this.session = new Session(name, id);
    console.log('%s: session started', this);
    return this;
  };

  Client.prototype.hasSession = function() {
    return !!this.session;
  };

  Client.prototype.sid = function() {
    Assert.ok(this.hasSession(), 'No active session.');
    return this.session.id;
  };

  
  // ## Session ##

  function Session(name, id) {
    this.name = name;
    this.id = id || U.gensym();
  }

  Session.prototype.toString = function() {
    return '#<Session ' + this.name + ' (' + this.id + ')>';
  };

});