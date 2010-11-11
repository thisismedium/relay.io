var pack   = require("./pack").pack;
var Buffer = require("buffer").Buffer;
var event  = require("events");
var api    = require("./api");

function passEvent(event, from, to) {
  from.on(event,function() { 
    to.emit(event, arguments);
  });
}

function assert(pred, mesg) {
  if (pred)
    return true;
  else
    throw mesg
}

function SocketChannel (id, stream) {

  var self = this;

  this.getId = function () { return id }

  this.destroy = function () { };

  this.write = function (obj) { 
    var json = JSON.stringify(obj.dump())
    self.writeRaw(json)
  }

  this.writeRaw = function (json) {
    console.log("Channel: " + id + " Writing: " + json);
    var bufA = new Buffer(Buffer.byteLength(json) + 4,'binary');
    var bufB = new Buffer(pack('nn',id,Buffer.byteLength(json)),'binary');
    bufB.copy(bufA,0,0);
    var bufC = new Buffer(json);
    bufC.copy(bufA,4,0);    
    doWrite(bufA);
  }

  function doWrite (buf) {
    // this does not seem to work at for some reason :(
    if (stream.writeable !== false) {
      try {
        stream.write(buf);
      } catch (e) {
        
      }
    }      
  }

};

SocketChannel.prototype = event.EventEmitter.prototype;

function ApplicationSocketLink (stream) {

  var self = this;

  var current_channel = 48;

  var channels = {};

  var chan_id_header_size   = 2;
  var mesg_size_header_size = 2;
  var header_size  = chan_id_header_size + mesg_size_header_size;

  var header_bytes_read, header, waiting, queue, queue_written, chan_id;

  stream.removeAllListeners("data");

  function reset () {
    header_bytes_read = 0;
    header = new Buffer(header_size, 'binary');
    waiting = 0;
    chan_id = 0;
  };

  reset();

  stream.on("data", function (data) {
    console.log(data.toString('utf8'));
    function aux (data) {

      if (header_bytes_read < header_size) {
        for (var i = 0; header_bytes_read < header_size && i < data.length; i++){
          header[header_bytes_read] = data[i];
          header_bytes_read += 1;          
        }
        data = data.slice(i,data.length);
      }

      if (header_bytes_read == header_size) {

        if (waiting == 0) {

          for (var i = 0; i < chan_id_header_size; i++) {
            chan_id = chan_id << 8;
            chan_id = header[i] | chan_id;
          }

          for (; i < chan_id_header_size + mesg_size_header_size; i++) {
            waiting = waiting << 8;
            waiting = header[i] | waiting;
          }
          console.log(waiting);
          queue = new Buffer(waiting, 'binary');
          queue_written = 0;
        }

        var over  = data.length - waiting;
        var dataA = data.slice(0, over > 0 ? waiting : data.length);

        dataA.copy(queue, queue_written, 0, dataA.length);
        queue_written += dataA.length;
        waiting       -= dataA.length;
        console.log(waiting);
        if (waiting == 0) {
  
          try {
            var json = JSON.parse(queue.toString('utf8'));
          } catch (e) {
            console.log(queue.toString('utf8'));
            self.emit("error")
          }

          var chan = channels[chan_id];
          if (chan == undefined) {
            console.log("Creating new channel: " + chan_id);
            if (chan_id > current_channel) current_channel = chan_id;
            chan = new SocketChannel(chan_id, stream);
            self.emit("channel", chan);
            channels[chan_id] = chan;
          }
          process.nextTick(function() {
            if (json) chan.emit("data", api.constructResponse(json));
          });
          
          reset();

          if (over > 0) {
            var leftover = data.slice(data.length-over, data.length);
            if (leftover.length > 0) aux(leftover);
          }

        }
      }
    }
    aux(data);  
  });

  function emitToAllChannels (signal) {
    for (channel in channels) {
      if (channels.hasOwnProperty(channel)) {
        channels[channel].emit(signal);
      }
    }
  };

  this.newChannel = function () {
    current_channel += 1;
    var chan = new SocketChannel(current_channel, stream);
    channels[current_channel] = chan;
    return chan;
  };

  stream.on("close",function(){ emitToAllChannels ("close") });
  stream.on("end"  ,function(){ emitToAllChannels ("end") });
  stream.on("error",function(){ emitToAllChannels ("error") });

  stream.on("connect",function(){ self.emit("connect"); emitToAllChannels ("connect") });

  this.end     = function () { stream.end() }
  this.destroy = function () { stream.destroy() }

};
ApplicationSocketLink.prototype = event.EventEmitter.prototype;
exports.ApplicationSocketLink = ApplicationSocketLink;
