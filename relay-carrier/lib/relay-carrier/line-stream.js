var Net      = require("net");
var Event    = require("events");
var Iteratee = require("iteratee");
var Buffer   = require("buffer");
exports.LineStreamServer = LineStreamServer;
exports.LineStreamReader = LineStreamReader;

function LineStreamServer () {
  
  var self = this;

  this.socket = Net.createServer(function (stream) {
    var reader = new LineStreamReader(stream);
    self.emit("connection", reader);
  });
  
  this.listen = function(port, domain) {
    self.socket.listen(port, domain);
  };

}
LineStreamServer.prototype = Event.EventEmitter.prototype;

function LineStreamReader (stream) {
  var self = this;

  stream.on("end", function() {
    self.emit("end");
  });
  stream.on("error", function() {
    self.emit("error");
  });

  var streamE = new Iteratee.StreamEnumerator(stream);
  var readLine = function () {
    streamE.run(Iteratee.readTillChar("\n"), function(line) {
      self.emit("message", line);
      readLine();
    });
  }
  readLine();

  this.send = function (data) {
    stream.write(data.replace("\n","\\n") + "\n");
  };
  this.end = function () {
    stream.end();
  };

}
LineStreamReader.prototype = Event.EventEmitter.prototype;
