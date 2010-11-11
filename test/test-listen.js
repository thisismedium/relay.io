
var net = require("net");
var ApplicationSocketLink = require("relay-core/utils").ApplicationSocketLink;

var sock = net.createConnection(8124,"localhost");

var master_connection = new ApplicationSocketLink(sock);
var connection = master_connection.newChannel();
var client_id = "";
connection.on("data", function(data) {
  try {
    if (data.getType() == "Hello") {
      client_id = data.getBody();
      connection.writeRaw(JSON.stringify({"type": "Join",
                                          "body": "#" + process.argv[2]}));
    }
    if (data.getType() == "Message" && data.getFrom() != "@master" && data.getFrom() != client_id && data.getFrom() != undefined) {
      setTimeout(function () { connection.writeRaw(JSON.stringify({"type": "Message",
                                                                   "to"  : data.getFrom(),
                                                                   "body": "Dear friend, thank you so much for the message!"}));
      }, 1);
     console.log(data.dump()); 
    }

  } catch (er) {
    console.log("Bad Message: " + er + "\n in messages:" + data.dump())
  }
});

connection.on("connect", function(){
  connection.writeRaw(JSON.stringify({"type":"Hello",
                                      "body":"test"})); 
});
