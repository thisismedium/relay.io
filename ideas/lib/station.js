define(['exports', './util', './application', './stream'],
function(exports, U, A, S) {

  exports.createServer = createServer;
  exports.Server = Server;

  function createServer(name) {
    return new Server(name);
  }

  U.inherits(Server, U.EventEmitter);
  function Server(name) {
    U.EventEmitter.call(this);

    var self = this;

    this.name = name;
    this.app = new A.App(name);
    this.server = S.createServer(function(s) { self.connect(s); });
  }

  Server.prototype.toString = function() {
    return '#<Station ' + this.name + '>';
  };

  Server.prototype.listen = function() {
    this.server.listen.apply(this.server, arguments);
    return this;
 };

  Server.prototype.connect = function(stream) {
    var self = this,
        client = new A.Client(stream);

    console.log('%s: connect %s', this, client);

    stream
      .on('end', function() { self.disconnect(client); })
      .on('timeout', function() { self.timeout(client); })
      .on('error', function(e) { self.error(client, e); });

    this.app.connect(client);

    return this;
  };

  Server.prototype.disconnect = function(client) {
    console.log('%s: disconnect %s', this, client);
    this.app.disconnect(client);
    client.end();
    return this;
  };

  Server.prototype.timeout = function(client) {
    console.log('%s: timeout %s', this, client);
    return this.disconnect(client);
  };

  Server.prototype.error = function(client, err) {
    console.log('%s: error %s (%s)', this, client, err);
    return this.disconnect(client);
  };

});