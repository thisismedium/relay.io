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
  plain sockets; the job of send message from the socket to the right clients is left
  up to the ApplicationSocketLink.  

  Multisession sockets are useful in relay because an http proxy might have a many clients 
  but only needs one socket open to the backend proccess.  The ApplicationSocketLink also
  has the important quality of being able to send a single message to many channels at once.
  This should prevent the backend from having to send the same message more then once. The 
  downside is that workers must organize the virtual sockets its handling specifically to 
  take advantage of the many to one socket, this module provides some useful utility functions
  to make this easier namely 'groupChannelsBySocket'.

 */
function ApplicationSocketLink (stream) {

  var self = this;
  var channels = {};
  var chan_list_header_width = 2;
  var chan_id_width   = 2;
  var mesg_length_header_width = 2;

  var max_channel_id = 1 << (8 * chan_id_width);
  var header_size  = chan_list_header_width + mesg_length_header_width;
  var header_bytes_read, header, waiting, queue, queue_written, chan_id, number_of_channels;

  stream.removeAllListeners("data");

  function reset () {
    header_bytes_read = 0;
    header = new Buffer(header_size, 'binary');
    waiting = 0;
    number_of_channels = 0;
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
  read 4 bytes
  A = parse channel list size
  B = parse message size
  Y = (A * 2) + B
  read Y bytes
  ----------------------------

  */

  stream.on("data", function (data) {
    function aux (data) {

      // we need to have all of the header data available 
      // before we proceed.

      if (header_bytes_read < header_size) {
        debug("Reading headers");
        for (var i = 0; header_bytes_read < header_size && i < data.length; i++){
          header[header_bytes_read] = data[i];
          header_bytes_read += 1;          
        }
        data = data.slice(i,data.length);
      }


      if (header_bytes_read == header_size) {

        // at this point we should have read all the bytes needed
        // to parse the packet header....

        if (waiting == 0) {

          // for (var i = 0; i < chan_id_width; i++) {
          //   chan_id = chan_id << 8;
          //   chan_id = header[i] | chan_id;
          // }
          debug("Parsing headers");
          for (var i = 0; i < chan_list_header_width; i++) {
            number_of_channels = number_of_channels << 8;
            number_of_channels = header[i] | number_of_channels;
          }
          for (; i < chan_list_header_width + mesg_length_header_width; i++) {
            waiting = waiting << 8;
            waiting = header[i] | waiting;
          }
          debug("The message size is: " + waiting);
          waiting += (number_of_channels * chan_id_width);
          debug("Number of channels: " + number_of_channels);
          debug("Waiting for: " + waiting);
          queue = new Buffer(waiting, 'binary');
          queue_written = 0;
        }

        // We now know how much data we are waiting for, so let read it in
        // and copy it into a new buffer.

        var over  = data.length - waiting;
        var dataA = data.slice(0, over > 0 ? waiting : data.length);

        dataA.copy(queue, queue_written, 0, dataA.length);
        queue_written += dataA.length;
        waiting       -= dataA.length;

        debug("Still waiting for: " + waiting);

        if (waiting == 0) {
          debug("Done waiting");
          debug(queue.toString());
          // we need to parse out our channel list:
          var chan_list = [];
          for (var i = 0; i < number_of_channels; i++) {
            debug("Parsing");
            var n_chan = 0;
            n_chan = queue[i * chan_id_width] | n_chan;
            n_chan = n_chan << 8;
            n_chan = queue[(i * chan_id_width) + 1] | n_chan;
            chan_list.push(n_chan)
          }

          debug(chan_list);
          queue = queue.slice(i * chan_id_width, queue.length);
          
          debug(queue.toString());
          
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
              if (json) chan.emit("data", api.constructResponse(json));
            });
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
    debug("Creating channel " + nid);
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
      debug("WRITING TO " + chans.length + " CHANNELS");
      var bufA = new Buffer(Buffer.byteLength(json) + header_size + (chan_id_width * chans.length),'binary');
      var bufB = new Buffer(pack('nn',chans.length, Buffer.byteLength(json)),'binary');
      debug("HEADER: ");
      debug(bufB);
      bufB.copy(bufA,0,0);

      var bufD = new Buffer(chans.length * chan_id_width, 'binary');
      for (var i = 0; i < chans.length; i++) {
        debug("CHAN ID IS: " + chans[i].getId());
        (new Buffer(pack('n', chans[i].getId()), 'binary')).copy(bufD, i * chan_id_width, 0)
      };
      debug("CHAN-LIST: ");
      bufD.copy(bufA, header_size, 0);
      debug(bufD);

      var bufC = new Buffer(json);
      bufC.copy(bufA,header_size + (chan_id_width * chans.length),0);    
      // debug(bufA.toString());
      debug("MESSAGE: ");
      debug(bufA);
      doWrite(bufA);
      debug("END WRITE");
    }

    function doWrite (buf) {
      debug("WRITING TO SOCKET: " + buf);
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
