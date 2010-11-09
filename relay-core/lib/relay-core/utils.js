var Buffer = require("buffer").Buffer;
var event = require("events");

function passEvent(event, from, to) {
  from.on(event,function() { 
    to.emit.apply(event, arguments) 
  });
}

function SocketReStreamer (stream) {
  var self = this;
  var waiting = 0;
  var buffer = "";
  stream.setEncoding("binary");
  stream.on("data", function (buf) {
    console.log("Got Data");
    console.log("\twaiting: " + waiting);
    if (waiting == 0) {
      waiting = buf[0].charCodeAt(0) | waiting;
      waiting = waiting << 8;
      waiting = buf[1].charCodeAt(1) | waiting;
      buf = buf.slice(2,buf.length);
    }
    console.log("\twaiting: " + waiting);
    buffer += buf.toString('utf8');
    waiting -= buf.length;
    console.log("\twaiting: " + waiting);
    if (waiting <= 0) {
      waiting = 0;
      self.emit("data", new Buffer(buffer));
      buffer = ""
    }
  });

  passEvent("close", this, stream);
  passEvent("end", this, stream);

  this.end = function () { socket.end() }
  this.destroy = function () { socket.end() }
  this.write   = function (x) { 
    var buf = new Buffer(x.length + 2);
    var buf
    socket.write(x) 
  }

};
SocketReStreamer.prototype = event.EventEmitter.prototype;

exports.SocketReStreamer = SocketReStreamer;
