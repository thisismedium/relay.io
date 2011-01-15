define(['exports', './util', './stream'],
function(exports, U, Stream) {

  exports.App = App;
  exports.createClient = createClient;
  exports.Client = Client;

  
  // ## Application ##

  var HELLO_TIMEOUT = 10;

  U.inherits(App, U.EventEmitter);
  function App(id) {
    U.EventEmitter.call(this);

    this.id = id;
    this.clients = {};
    this.waiting = {};

    var self = this;

    this.inSandbox = function(obj) { self.sandbox(this, obj); };
    this.onMessage = function(obj) { self.dispatch(this, obj); };
    this.onClose = function() { self.disconnect(this); };
  }

  App.prototype.toString = function() {
    return '#<App ' + this.id + '>';
  };

  App.prototype.connect = function(client) {
    if (client.id in this.clients)
      throw new Error('Client ' + client + ' is already connected to ' + this + '.');

    client
      .on('data', this.inSandbox)
      .on('close', this.onClose);

    this.wait(client, HELLO_TIMEOUT, this.onClose);

    return this;
  };

  App.prototype.disconnect = function(client) {
    if (client.id in this.clients) {
      delete this.clients[client.id];
      this.eachOther(client, function(other) {
        other.send('disconnect', client.name);
      });
    }
    return this;
  };

  App.prototype.sandbox = function(client, obj) {
    if (validMessage(client, obj) && obj.type != 'hello')
      unauthorized(client, 'You never said "hello".', obj);
    else
      this.startSession(client, obj);
    return this;
  };

  App.prototype.startSession = function(client, obj) {
    this.stopWaiting(client);

    (this.clients[client.id] = client)
      .removeListener('data', this.inSandbox)
      .on('data', this.onMessage)
      .startSession(obj.data)
      .send('welcome');

    return this.eachOther(client, function(other) {
      other.send('connect', client.name);
    });
  };

  App.prototype.dispatch = function(client, obj) {
    if (validMessage(client, obj) && !this.emit(obj.type, obj, client))
      this.eachOther(client, function(other) {
        other.write(obj);
      });
  };

  App.prototype.eachOther = function(client, fn) {
    for (var id in this.clients) {
      if (id != client.id)
        fn(this.clients[id], id, this);
    }
    return this;
  };

  App.prototype.wait = function(client, seconds, callback) {
    var self = this;

    this.waiting[client.id] = setTimeout(function() {
      self.stopWaiting(client);
      callback();
    }, seconds * 1000);

    return this;
  };

  App.prototype.stopWaiting = function(client) {
    delete this.waiting[client.id];
    return this;
  };

  function validMessage(client, obj) {
    if (!obj.type)
      badRequest(client, 'Missing required "type" property.', obj);
    return !!obj.type;
  }

  function badRequest(client, reason, msg) {
    return sendError(client, 400, reason, msg);
  }

  function unauthorized(client, reason, msg) {
    return sendError(client, 403, reason, msg);
  }

  function sendError(client, status, reason, msg) {
    return client.write({
      type: 'error',
      status: status,
      data: { reason: reason, message: message }
    });
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
    this.name = name;

    U.proxyEvents(
      ['connect', 'secure', 'end', 'data', 'timeout', 'error', 'close'],
      stream,
      this);
  }

  Client.prototype.toString = function() {
    var id = this.id,
        name = this.name || 'unknown';

    return '#<Client ' + id + ' (' + name + ')>';
  };

  Client.prototype.send = function(type, data) {
    if (data === undefined)
      data = null;
    this.write({ type: type, data: data });
    return this;
  };

  Client.prototype.write = function(obj) {
    return this.stream.write(obj);
  };

  Client.prototype.end = function() {
    this.stream.end();
    return this;
  };

  Client.prototype.startSession = function(name) {
    this.name = name;
    console.log('%s: session started.', this);
    return this;
  };

  
  // ## Message ##

  function Message(client, msg) {
    this.sender = client;
    this.data = msg;
  }

  Message.prototype.toString = function() {
    var id = this.client.id,
        type = this.data.type;
    return '#<Message from: ' + id + ' type: ' + type + '>';
  };

});