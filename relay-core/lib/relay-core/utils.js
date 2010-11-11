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

function ApplicationSocketLink (stream) {

  var self = this;

  var channels = {};

  var chan_id_header_size   = 2;
  var mesg_size_header_size = 2;

  var max_channel_id = 1 << (8 * chan_id_header_size);

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
          queue = new Buffer(waiting, 'binary');
          queue_written = 0;
        }

        var over  = data.length - waiting;
        var dataA = data.slice(0, over > 0 ? waiting : data.length);

        dataA.copy(queue, queue_written, 0, dataA.length);
        queue_written += dataA.length;
        waiting       -= dataA.length;
        if (waiting == 0) {
  
          try {
            var json = JSON.parse(queue.toString('utf8'));
          } catch (e) {
            self.emit("error")
              }

          var chan = channels[chan_id];
          if (chan == undefined) {
            chan = new SocketChannel(chan_id);
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

  function getNewChannelId () {
    for (var i = 0; i < max_channel_id; i++) {
      if (!(i in channels)) {
        return i;
      }
    }
  }
  
  this.newChannel = function () {
    var nid = getNewChannelId();
    console.log("Creating channel " + nid);
    var chan = new SocketChannel(nid);
    channels[nid] = chan;
    return chan;
  };

  function removeChannel (id) {
    if (id in channels) 
      delete channels[id];
  };

  stream.on("close",function(){ emitToAllChannels ("close") });
  stream.on("end"  ,function(){ emitToAllChannels ("end") });
  stream.on("error",function(){ emitToAllChannels ("error") });

  stream.on("connect",function(){ self.emit("connect"); emitToAllChannels ("connect") });

  this.end     = function () { stream.end() }
  this.destroy = function () { stream.destroy() }

  ////////////////////////////////////////////////////////////////////////

  function SocketChannel (id) {

    var self = this;

    this.getId = function () { return id }

    this.end = this.destroy = function () { 
      removeChannel(id);
    };



    this.write = function (obj) { 
      var json = JSON.stringify(obj.dump())
      self.writeRaw(json)
    }

    this.writeRaw = function (json) {
      var bufA = new Buffer(Buffer.byteLength(json) + header_size,'binary');
      var bufB = new Buffer(pack('nn',id,Buffer.byteLength(json)),'binary');
      bufB.copy(bufA,0,0);
      var bufC = new Buffer(json);
      bufC.copy(bufA,header_size,0);    
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

};
ApplicationSocketLink.prototype = event.EventEmitter.prototype;
exports.ApplicationSocketLink = ApplicationSocketLink;
