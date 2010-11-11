var ApplicationSocketLink = require("relay-core/utils").ApplicationSocketLink;
var net = require("net");

var master_connection = new ApplicationSocketLink(net.createConnection(8124,"localhost"));

var connection = master_connection.newChannel();

connection.on("data", function(data) {
  console.log("DATA: " + data);
  if (data.getType() == "Hello") {
    setInterval(function () { connection.writeRaw(JSON.stringify({"type": "Message",
                                                                 "to"  : "#" + process.argv[2],
                                                                 "from": "@me",
                                                                 "body": "Hello World: " + Math.random(0,1)})) 
    }, 1);
  }

  console.log(data.dump());
  
});

console.log(connection);

master_connection.on("connect", function(){
  console.log("CONNECT");
  connection.writeRaw(JSON.stringify({"type":"Hello",
                                   "body":"test"})); 
});
