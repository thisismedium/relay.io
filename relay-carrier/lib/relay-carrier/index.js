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
  pool.addConnection(new MultiplexedSocket(net.createConnection(8124, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(8124, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(8124, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(8124, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(8124, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(8124, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(8124, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(8124, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(8124, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(8124, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(8124, "localhost")));
  pool.addConnection(new MultiplexedSocket(net.createConnection(8124, "localhost")));

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

  var port = process.argv[3] ? process.argv[3] : "8000";
  var host = process.argv[2] ? process.argv[2] : "0.0.0.0";

  console.log(" + Relay Carrier listening at: " + host + ":" + port);
  httpServer.listen(port, host);

}

// process.on('uncaughtException', function (err) {
//   console.log('Caught exception: ' + err);
// });
