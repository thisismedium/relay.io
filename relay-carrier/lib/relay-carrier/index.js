var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;
var HttpStreamServer      = require("http-stream").HttpStreamServer;
var MultiplexedSocket     = require("relay-core/multiplex").MultiplexedSocket;
var U                     = require("relay-core/util");
var WebSocketWrapper      = require("relay-core/utils/websocket").WebSocketWrapper;
var Events                = require("events");
var Http                  = require("http");
var Iterators             = require("iterators");
var Net                   = require("net");
var Path                  = require("path");
var ServerMedium          = require("servermedium");
var Static                = require("node-static");

// Have serverMedium determine which settings file
// to load and 'require' it.
var settings = ServerMedium.requireHostSettings();

// ServerMedium should report any errors to the console.
ServerMedium.reportErrors()

var args = U.withProcessArguments()
  .alias("--user","-u")
  .alias("--verbose", "-v")
  .onFlag("-u", function (obj) {
    obj.user = this.nextArgument();
    return obj;
  })
  .onFlag("-v", function (obj) {
    obj.verbose = true;
    return obj
  })
  .parse();

// The connection pool keeps a list of connections to the backend
// servers and keeps them balanced.
function ConnectionPool () {
  var connections = [];
  var self = this;

  this.addConnection = function (connection) {
    connections.push(connection);
    connection.on("error", function (e) {
      console.log("Error:" + e);
    });

    function a1 (e) {
      self.removeConnection(connection);
    }

    connection.on("end",   a1);
    connection.on("close", a1);
    connection.on("error", a1);
    return this;
  };

  this.removeConnection = function (con) {
    var connections = Iterators.fold(function(a, b){
      if (b == con) return a;
      else a.append(b);
    }, [], connections);
    if (connections.length == 0) {
      this.emit("empty");
    }
  };
  this.getConnection = function () {
    // TODO: just returns a random connection (for now).
    return connections[Math.floor(Math.random() * connections.length)]
  };
};
ConnectionPool.prototype = Events.EventEmitter.prototype;

exports.app = function () {

  var pool = new ConnectionPool();

  // TODO: These should not be hard coded in here...
  pool.addConnection(new MultiplexedSocket(Net.createConnection(4011, "localhost")))

  pool.on("empty", function () {
    console.log(" - No connections left, I shall die");
    process.exit();
  })

  var file             = new(Static.Server)(Path.join(__dirname, 'client'));
  var httpServer       = Http.createServer(simpleServer);
  var httpStreamServer = new HttpStreamServer(httpServer);
  var wsServer         = new WebSocketWrapper(httpServer);

  function simpleServer (request, response) {
    request.addListener('end', function () {
      file.serve(request, response).on("error", function(e) { 
        return false;
      });
    });
  }

  // proxy websocket or http stream connection directly to our backend...

  function proxy(sock) {
    var chan = pool.getConnection().newChannel();
    chan.on("end", function () {
      sock.end();
    });
    chan.on("close", function () {
      sock.end();
    });
    chan.on("data", function (data) {
      console.log(" < DATA FROM SERVER: " + data);
      sock.send(data);
    });
    sock.on("message", function (data) {
      console.log(" > DATA FROM BROWSER: " + data);
      chan.write(data);
    });
    sock.on("end", function () {
      console.log("SOCKET ENDED");
      chan.end();
    });
    sock.on("close", function () {
      console.log("SOCKET CLOSED");
      chan.end();
    });
  }

  httpStreamServer.on("connection", function (sock) {
    console.log("Got an HTTP stream connection");
    proxy(sock);
  });

  wsServer.on("connection", function (sock) {
    console.log("Got a Websocket connection");
    proxy(sock);
  });

  var port = args.arguments[3] ? args.arguments[3] : settings.port;
  var host = args.arguments[2] ? args.arguments[2] : settings.host;

  console.log(" + Relay Carrier listening at: " + host + ":" + port);
  httpServer.listen(port, host);

  if (args.flags.user) {
      console.log("Dropping to user: %s", args.flags.user)
    try {
      process.setuid(args.flags.user);
    } catch (err) {
      throw new Error("Could not set user.");
    }
  }

}
