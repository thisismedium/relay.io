var net    = require('net');
var events = require('events');
var pack   = require('./pack');

var Buffer = require('buffer').Buffer;

exports.test = function test(n) {
  var b = new Buffer(pack.pack('n',n), 'binary');
  console.log(b)
  for (var out = 0, i = 0; i < b.length; i++) {
    var out = out << 8;
    var out = out | b[i];
  }
  console.log(out);
  return out
}

function PlexyChannel (number, parent) {
  this.getNumber = function () { return number }
  this.write = function (data) {
    var n = zpad(number+"")
    parent.stream.write(n + data);
  };
};

PlexyChannel.prototype = events.EventEmitter.prototype;

function PlexyStream (stream, parent) {
  var maxchan = 1;
  var channels = {};
  var self = this;
  this.stream = stream;
  stream.on('data', function (data) {
    var chan = zpad(data.slice(0,2));
    if (typeof(channels[chan]) == "undefined") {
      if (parent) {
        channels[chan] = new PlexyChannel(chan, self);
        parent.emit("connection", channels[chan]);
      } else {
        throw ("Message recieved on an undefined channel")
      }
    } 
    process.nextTick(function(){ 
      channels[chan].emit('data', data);
    });
  });
  this.newChannel = function () {
    var next = zpad(""+maxchan++);
    var chan = new PlexyChannel(next, self);
    channels[next] = chan;
    return chan
  };
  this.close = function () { stream.end() };  
};

function PlexyServer () {
  var self = this;
  var server = net.createServer(function (stream) {
    return (new PlexyStream(stream, self));
  });
  this.listen = function (port, host) { server.listen(port, host) }
}
PlexyServer.prototype = events.EventEmitter.prototype;

function PlexyClient (port, host) {
  var stream = net.createConnection(port, host);
  return (new PlexyStream(stream));
}

exports.PlexyClient = PlexyClient
exports.PlexyServer = PlexyServer


