var api = require("relay-core/api");
var ApplicationSocketLink = require("relay-core/network").ApplicationSocketLink;
var net = require("net");
var sys = require("sys");

var users = {};

var connection = new ApplicationSocketLink(net.createConnection(8124,"localhost"));

connection.write(new api.HelloRequest("test"));

connection.on("data", function (resp) {
  
  if (resp.getType() == "Hello") {
    var client_id = resp.getBody();
    commandLoop();
  };

  if (resp.getType() == "Message") {
    if (typeof(resp.getBody().dump) != "undefined") {
      var data = resp.getBody().dump();
      if (data.mesg) {
        console.log("\n"+ (users[resp.getFrom()] || resp.getFrom()) + " -> " + resp.getTo() + ":  " + data.mesg); 
        sys.print("> " + buffer);
      } else {
        users[resp.getFrom()] = data.ident
      }
    }
  }
    
});

var buffer = "";

function commandLoop () {
  var stdin = process.openStdin();
  stdin.setEncoding('utf8');
  sys.print("> ");
  stdin.on("data", function (data) {
    buffer += data
    if (data.indexOf("\n")) {
      processCommand(buffer);
      buffer = "";
    }  
  });
}
function processCommand (command) {
  command = command.substr(0,command.length-1);
  var calls = { 
    "join" : function (rest) {
      connection.write(new api.JoinRequest(rest));
    },
    "ident": function (rest) {
      connection.write(new api.MessageRequest("#global", "", {"ident": rest}));
    }}
  
  if (command[0] == "\\") {
    var split = command.indexOf(" ");
    var comm  = command.substr(1, split-1);
    var rest  = command.substr(split);
    console.log(rest);
    calls[comm](rest);
  } else {
    connection.write(new api.MessageRequest("#global", "", {"mesg": command}));
  }
  sys.print("> ");
}
