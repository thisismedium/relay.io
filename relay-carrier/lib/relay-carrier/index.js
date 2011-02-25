var WebSocketWrapper      = require("relay-core/utils/websocket").WebSocketWrapper;
var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;
var MultiplexedSocket     = require("relay-core/multiplex").MultiplexedSocket;
var HttpStreamServer      = require("http-stream").HttpStreamServer;
var net                   = require("net");
var http                  = require("http");
var path                  = require("path");
var static                = require("node-static");
var it                    = require("iterators");
var events                = require("events");
var servermedium          = require("servermedium");
var settings              = servermedium.requireHostSettings();
var U                     = require("relay-core/util");

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
    connection.on("end", a1);
    connection.on("close", a1);
    connection.on("error", a1);
  };
  this.removeConnection = function (con) {
    var connections = it.fold(function(a, b){
      if (b == con) return a;
      else a.append(b);
    }, [], connections);
    if (connections.length == 0) {
      this.emit("empty");
    }
  };
  this.getConnection = function () {
    // just return a random connection (for now).
    return connections[Math.floor(Math.random() * connections.length)]
  };
};
ConnectionPool.prototype = events.EventEmitter.prototype;

exports.app = function () {

  var pool = new ConnectionPool();

  // TODO: These should not be hard coded in here...
  pool.addConnection(new MultiplexedSocket(net.createConnection(4011, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(4011, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(4011, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(4011, "localhost")));

  pool.on("empty", function () {
    console.log(" - No connections left, I shall die");
    process.exit();
  })

  var file             = new(static.Server)(path.join(__dirname, 'client'));
  var httpServer       = http.createServer(simpleServer);
  var httpStreamServer = new HttpStreamServer(httpServer);
  var wsServer         = new WebSocketWrapper(httpServer);

  function simpleServer (request, response) {
    request.addListener('end', function () {
      file.serve(request, response).on("error", function(e) { console.log("ERROR::") ; console.log(e) });
    });
  }

  // proxy websocket connection directly to our backend...

  function proxy(sock) {
    var chan = pool.getConnection().newChannel();
    chan.on("end", function () {
      sock.end();
    });
    chan.on("data", function (data) {
      //console.log(" < DATA FROM SERVER: " + data);
      sock.send(data);
    });
    sock.on("message", function (data) {
      //console.log(" > DATA FROM BROWSER: " + data);
      chan.writeRaw(data);
    });
    sock.on("end", function () {
      chan.end();
    });
    sock.on("close", function () {
      chan.end();
    });
  }

  httpStreamServer.on("connection", proxy);
  wsServer.on("connection", proxy);

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

// process.on('uncaughtException', function (err) {
//   console.log('Caught exception: ' + err);
// });
