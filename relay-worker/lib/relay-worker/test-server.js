var plexy = require("./plexy");
myServer = new plexy.PlexyServer();
myServer.on("connection", function(sock) {
  console.log("I got a connection!");
  sock.on("data", function(data){ 
    console.log(sock.getNumber() + " got some data!");
    sock.write("Thanks I got your data");
  });
});

myServer.listen(5000, 'localhost')

