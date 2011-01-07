var WebSocketWrapper      = require("relay-core/utils/websocket").WebSocketWrapper;
var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;
var HttpStreamServer      = require("http-stream").HttpStreamServer;
var net                   = require("net");         
var http                  = require("http");
var path                  = require("path");        
var static                = require("node-static"); 

function ConnectionPool () {
  var connections = [];
  this.addConnection = function (connection) {
    connections.push(connection);
    connection.on("error", function (e) {
      console.log(e);
    });
    function a1 () {
      self.removeConnection(connection);
    }
    connection.on("close", a1);
    connection.on("error", a1);
  };
  this.removeConnection = function (con) {
    
    };
};

exports.app = function () {

  var masterConnection = [new ApplicationSocketLink(net.createConnection(8124, "localhost")), 
                          new ApplicationSocketLink(net.createConnection(8124, "localhost"))];

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
    console.log("GOT CONNECTION");
    var chan = masterConnection[Math.floor(Math.random() * masterConnection.length)].newChannel();
    chan.on("end", function () {
      sock.close();
    });
    chan.on("data", function (data) {
      console.log(" < DATA FROM SERVER: " + JSON.stringify(data.dump()));
      sock.send(JSON.stringify(data.dump()));
    });
    sock.on("message", function (data) {
      console.log(" > DATA FROM BROWSER: " + data);
      chan.writeRaw(data);
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
