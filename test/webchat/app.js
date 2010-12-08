var WebSocketWrapper      = require("relay-core/utils/websocket").WebSocketWrapper;
var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;
var HttpStreamServer      = require("http-stream").HttpStreamServer;


var net    = require("net");    
var http   = require("http");   
var static = require("node-static");

function simpleServer (request, response) {
    request.addListener('end', function () {
      file.serve(request, response);
    });
}

var masterConnection = new ApplicationSocketLink(net.createConnection(8124, "localhost"));
var file             = new(static.Server)('./static');
var httpServer       = http.createServer(simpleServer);
var httpStreamServer = new HttpStreamServer(httpServer);
var wsServer         = new WebSocketWrapper(httpServer);

httpServer.listen(8080, "0.0.0.0");

// proxy websocket connection directly to our backend...

function proxy(sock) {
  console.log("GOT CONNECTION");
  var chan = masterConnection.newChannel();
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

// process.on('uncaughtException', function (err) {
//   console.log('Caught exception: ' + err);
// });
