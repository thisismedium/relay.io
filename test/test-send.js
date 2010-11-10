var ApplicationSocketLink = require("relay-core/utils").ApplicationSocketLink;
var net = require("net");

var connection = new ApplicationSocketLink(net.createConnection(8124,"localhost"));

connection.on("data", function(data) {
  if (data.getType() == "Hello") {
    setInterval(function () { connection.writeRaw(JSON.stringify({"type": "Message",
                                                                 "to"  : "#" + process.argv[2],
                                                                 "from": "@me",
                                                                 "body": "Hello World: " + Math.random(0,1)})) 
    }, 1);
  }

  console.log(data.dump());
  
});



connection.on("connect", function(){
  connection.writeRaw(JSON.stringify({"type":"Hello",
                                   "body":"test"})); 
});
