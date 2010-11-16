var pack   = require("./utils/pack").pack;
var Buffer = require("buffer").Buffer;
var event  = require("events");
var api    = require("./api");

var DEBUG = false;
function debug (st) {
  if (DEBUG) console.log(st);
}

/*
  # ApplicationSocketLink
  
  ApplicataionSocketLink has the job of organizing a socket into multiple sessions
  a session is reffered to as channel.  The idea is that we should be able to divide
  a socket into several channels and work with these channels as if they where simply
  plain sockets; the job of sending message from the socket to the right clients is left
  up to the ApplicationSocketLink.  

  Multisession sockets are useful in relay because an http proxy might have a many clients 
  but only needs one socket open to the backend proccess.  The ApplicationSocketLink also
  has the important quality of being able to send a single message to many channels at once.
  This should prevent the backend from having to send the same message more than once. The 
  downside is that workers must organize the virtual sockets its handling specifically to 
  take advantage of the many to one transfer, this module provides some useful utility functions
  to make this easier namely 'groupChannelsBySocket'.

 */
function ApplicationSocketLink (stream) {

  var MODE_MESG = 1;
  var MODE_END  = 2;

  var self = this;
  var channels = {};
  var mode_header_width = 1;
  var chan_list_header_width = 2;
  var chan_id_width   = 2;
  var mesg_length_header_width = 2;

  var max_channel_id = 1 << (8 * chan_id_width);
  var header_size  = chan_list_header_width + mesg_length_header_width;
  var header_bytes_read, header, waiting, queue, queue_written, chan_id, number_of_channels, mode;

  stream.removeAllListeners("data");

  function reset () {
    header_bytes_read = 0;
    header = new Buffer(header_size, 'binary');
    waiting = 0;
    number_of_channels = 0;
    mode = undefined;
    gotoMode(getModeReader);
  };

  reset();

  /*
  The fun starts here, we need to read in a header which contains the
  size of the channels list and the body of the message.
 
  The channel list header part is 2 bytes wide and represents the number of channels 
  that the message will be sent to.

  The size of the body is also 2 bytes wide and simply indicates the size in bytes of
  the messages body.

  We must first collect the head in total and then calculate the amount of data to read
  after the header so to break it down it looks a bit like this...

  -----------------------------
  read 1 byte (the mode byte)
  |
  ` read 4 bytes
    A = parse channel list size
    B = parse message size
    Y = (A * 2) + B
    read Y bytes
  ----------------------------

  */

  function gotoMode (mode, data) {
    console.log(mode);
    stream.removeAllListeners("data");
    stream.on("data", mode);
    if (data) stream.emit("data", data);
  };

  function getModeReader (data) {
    var cbs = {};
    cbs[MODE_MESG] = mesgModeReader;
    cbs[MODE_END]  = endModeReader;
    var mode = data[0];
    debug("Mode is: " + mode);
    gotoMode(cbs[mode], data.slice(1, data.length));
  };

  function endModeReader (data) {
    // gotoMode(mesgHeaderReader(function () {
      

    //   }),data)
  };

  function mesgHeaderReader(next) {
    return function (data) {
      if (header_bytes_read < header_size) {
        for (var i = 0; header_bytes_read < header_size && i < data.length; i++){
          header[header_bytes_read] = data[i];
          header_bytes_read += 1;          
        }
        data = data.slice(i,data.length);
      } 
      if (header_bytes_read == header_size) {
        for (var i = 0; i < chan_list_header_width; i++) {
          number_of_channels = number_of_channels << 8;
          number_of_channels = header[i] | number_of_channels;
        }
        for (; i < chan_list_header_width + mesg_length_header_width; i++) {
          waiting = waiting << 8;
          waiting = header[i] | waiting;
        }
        waiting += (number_of_channels * chan_id_width);
        queue = new Buffer(waiting, 'binary');
        queue_written = 0;
        gotoMode(next, data);     
      }
    }
  }

  function mesgModeReader (data) {
    debug("Reading a message");

    // we need to have all of the header data available 
    // before we proceed.

    gotoMode(mesgHeaderReader(function (data) {

      debug("Waiting for: " + waiting);

      // We now know how much data we are waiting for, so let read it in
      // and copy it into a new buffer.

      var over  = data.length - waiting;
      var dataA = data.slice(0, over > 0 ? waiting : data.length);

      dataA.copy(queue, queue_written, 0, dataA.length);
      queue_written += dataA.length;
      waiting       -= dataA.length;

      debug("Waiting for: " + waiting);
      debug("queue: " + queue.toString());
      if (waiting == 0) {
        debug("Done waiting");
        // we need to parse out our channel list:
        var chan_list = [];
        for (var i = 0; i < number_of_channels; i++) {
          var n_chan = 0;
          for (var k = (i * chan_id_width); k < (i * chan_id_width) + chan_id_width; k++) {
            n_chan = n_chan << 8;
            n_chan = queue[k] | n_chan;
          }
          chan_list.push(n_chan)
            }

        queue = queue.slice(i * chan_id_width, queue.length);
          
        try {
          var json = JSON.parse(queue.toString('utf8'));
        } catch (e) {
          self.emit("error");
        }

        chan_list.forEach(function(chan_id) {
          var chan = channels[chan_id];
          if (chan == undefined) {
            chan = new SocketChannel(chan_id);
            self.emit("channel", chan);
            channels[chan_id] = chan;
          }
          process.nextTick(function() {
            if (json) chan.emit("data", api.constructMessage(json));
          });
        });
          
        reset();

        if (over > 0) {
          var leftover = data.slice(data.length-over, data.length);
          if (leftover.length > 0) self.emit("data", leftover);
        }
      }
    }), data);
             
  };

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
  stream.on("error",function error (e){ debug(e); debug(e.stack); emitToAllChannels ("error") });

  stream.on("connect",function(){ self.emit("connect"); emitToAllChannels ("connect") });

  this.end     = function () { stream.end() }
  this.destroy = function () { stream.destroy() }

  ////////////////////////////////////////////////////////////////////////

  function SocketChannel (id) {

    var self = this;

    this.toString = function () {
      return "<SocketChannel #" + id + ">"
    };

    this.getId = function () { return id };

    this.getSocket = function () { return stream };

    this.end = this.destroy = function () { 
      removeChannel(id);
    };

    this.write = function (obj) { 
      var json = JSON.stringify(obj.dump())
      self._write([this], json)
    }

    this.multiWrite = function (chans, obj) {
      self._write(chans, JSON.stringify(obj.dump()));
    }

    this.writeRaw = function (str) { self._write([this], str); }

    this._write = function (chans, json) {

      var bufA = new Buffer(Buffer.byteLength(json) + mode_header_width + header_size + (chan_id_width * chans.length),'binary');

      var bufB = new Buffer(pack('Cnn', MODE_MESG, chans.length, Buffer.byteLength(json)),'binary');
      bufB.copy(bufA,0,0);

      var bufD = new Buffer(chans.length * chan_id_width, 'binary');
      for (var i = 0; i < chans.length; i++) {
        (new Buffer(pack('n', chans[i].getId()), 'binary')).copy(bufD, i * chan_id_width, 0)
      };
      bufD.copy(bufA, bufB.length, 0);

      var bufC = new Buffer(json);
      bufC.copy(bufA,bufB.length + bufD.length,0);    
      doWrite(bufA);
    }

    function doWrite (buf) {
      // this does not seem to work at for some reason :(
      if (stream.writeable !== false) {
        try {
          debug(buf);
          debug(buf.toString());
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


exports.groupChannelsBySocket = function groupChannelsBySocket (channels) {
  var grouped = [];
  function addToGroup (chan) {
    for (var i = 0; i < grouped.length; i++) {
      if (grouped[i][0].getSocket() == chan.getSocket()) {
        grouped[i].push(chan);
        return true;
      }
    }
    return false;
  }
  for (var i = 0; i < channels.length; i++) {
    if (!addToGroup(channels[i])) {
      grouped.push([channels[i]]);
    }
  }
  return grouped
};
