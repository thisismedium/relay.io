var http   = require("http");   
var static = require("node-static");
function simpleServer (request, response) {
    request.addListener('end', function () {
      file.serve(request, response);
    });
}
var file             = new(static.Server)('./static');
var httpServer       = http.createServer(simpleServer);
httpServer.listen(process.argv[2], "0.0.0.0");
