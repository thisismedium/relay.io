var network = require("relay-core/network");
var api     = require("relay-core/api");
var net     = require("net");
var event   = require("events");

function Client (socket_link, application, keys, channels) {

  var self = this;
  var stream = socket_link.newChannel();

  var clientId;

  stream.write(new api.Hello(application, keys));

  stream.on("data", function (data) {
    console.log(data.dump());
    self.emit(data.getType(), data);
  });

  self.on("Welcome", function(data){

    clientId = data.getClientId();

    channels.forEach(function (chan) {
      var fork = stream.fork();
      console.log("JOINING");
      fork.write(new api.Join(chan));
      fork.on("data", function(data){
        console.log("FORK #" + stream.getId() + "." + fork.getId());
        console.log(data.dump());
      });
    });

  });

  self.on("Message", function(data){
    console.log(data.dump());
  });

  this.getClientId = function () {
    return clientId;
  }


};
Client.prototype = event.EventEmitter.prototype;

var sock = new network.ApplicationSocketLink(net.createConnection(8124, "localhost"));

client1 = new Client(sock, "test", ["read_key"], ["#medium","#message","#test", "#sanders", "#test2","#test3","test4","#test5"]);
client2 = new Client(sock, "test", ["read_key"], ["#medium","#message","#test", "#sanders"]);
