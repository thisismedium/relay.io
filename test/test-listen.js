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
      stream.write(new api.Join(chan));
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

client1 = new Client(sock, "test", ["read_key"], ["#medium","#message","#test", "#sanders"]);
client2 = new Client(sock, "test", ["read_key"], ["#medium","#message","#test", "#sanders"]);
