
var net = require("net");
var ApplicationSocketLink = require("relay-core/utils").ApplicationSocketLink;

var sock = net.createConnection(8124,"localhost");

var connection = new ApplicationSocketLink(sock);

connection.on("data", function(data) {
  try {
    if (data.getType() == "Hello") {
      connection.writeRaw(JSON.stringify({"type": "Join",
                                          "body": "#" + process.argv[2]}));
    }
    if (data.getType() == "Message" && data.getFrom() != "@master") {
      connection.writeRaw(JSON.stringify({"type": "Message",
                                          "to"  : data.getFrom(),
                                          "body": "Dear friend, thank you so much for the message!"}));
    
    }

  } catch (er) {
    console.log("Bad Message: " + er + "\n in messages:" + data.dump())
  }
  console.log(data.dump());
});

connection.on("connect", function(){
  connection.writeRaw(JSON.stringify({"type":"Hello",
                                      "body":"test"})); 
});
