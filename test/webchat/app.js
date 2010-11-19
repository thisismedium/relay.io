var WebSocketWrapper      = require("relay-core/utils/websocket").WebSocketWrapper;
var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;

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
var wsServer         = new WebSocketWrapper(httpServer);

httpServer.listen(8080, "0.0.0.0");

// proxy websocket connection directly to our backend...
wsServer.on("connection", function(sock) {
  var chan = masterConnection.newChannel();
  chan.on("end", function () {
    sock.close();
  });
  chan.on("data", function (data) {
    sock.send(JSON.stringify(data.dump()));
  });
  sock.on("message", function (data) {
    chan.writeRaw(data);
  });
  sock.on("close", function () {
    chan.end();
  });
});
