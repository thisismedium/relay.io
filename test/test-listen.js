
var net = require("net");
var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;

var sock = net.createConnection(8124,"localhost");

var master_connection = new ApplicationSocketLink(sock);
var connection  = master_connection.newChannel();
var connection2 = master_connection.newChannel();
var client_id = "";

var x = 0;
function dataHandler(conn,join){
  var z = x + 1;
  x += 1;
  return function(data){
    try {
      if (data.getType() == "Hello") {
        client_id = data.getBody();
        conn.writeRaw(JSON.stringify({"type": "Join",
                                            "body": "#" + join}));
      }
      if (data.getType() == "Message" && data.getFrom() != "@master" && data.getFrom() != client_id && data.getFrom() != undefined) {
        // setTimeout(function () { conn.writeRaw(JSON.stringify({"type": "Message",
        //                                                              "to"  : data.getFrom(),
        //                                                              "body": "Dear friend, thank you so much for the message!"}));
        // }, 1);
        console.log("CLIENT " + z);
        console.log(data.dump()); 
      }

    } catch (er) {
      console.log("Bad Message: " + er + "\n in messages:" + data.dump());
    }
  }
}


connection.on("data", dataHandler(connection, [process.argv[2]]));
connection2.on("data", dataHandler(connection2, [process.argv[3]]));

connection.on("connect", function(){
  connection.writeRaw(JSON.stringify({"type":"Hello",
                                      "body":"test"})); 
});

connection2.on("connect", function(){
  connection2.writeRaw(JSON.stringify({"type":"Hello",
                                       "body":"test"})); 
});
