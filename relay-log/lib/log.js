// # log.js #
//
// Keep statistics about traffic flowing through streams. Monitor a
// server.
//
// ## Target Schema ##
//
// CREATE TABLE log (
//   start   timestamp,
//   stop    timestamp,
//   appId   text,
//   kind    text,
//   channel text,
//   count   int
// );

define(['exports', './util', './mapred', './api'],
function(exports, U, Mr, Api) {

  exports.Log = Log;
  exports.Stats = Stats;

  
  // ## Log ##

  // A log collects statistics about items flowing throw a stream. A
  // server participates with the logger by provinding a `map`
  // procedure that converts real items to log entries.

  // Create a new Log.
  //
  // If the optional `averages` is given, the log will keep track of
  // running averages for these number of seconds in addition to the
  // current and total Stats.
  //
  // + averages - Array of seconds (optional).
  //
  // Returns Log instance.
  U.inherits(Log, U.EventEmitter);
  function Log(averages) {
    U.EventEmitter.call(this);

    var self = this;

    (this.engine = new Mr.ReduceStream('in', 'out'))
      .seed(function() {
        return new Stats();
      })
      .reduce(function(stats, item) {
        stats.update(item);
      });

    (this.score = new Mr.Score(this.engine, averages))
      .on('update', function() {
        self.emit('update', this.last.data, this.last);
      })
      .zero(function() {
        return new Stats();
      })
      .add(function(stats1, stats2) {
        stats1.add(stats2);
      });

    this.heartbeat(1000);
  }

  // Specify a `map` procedure to transform items that are pushed
  // through the logger. Use `inject` to add entries to
  // the log manually.

  Log.prototype.map = function(fn) {
    this.engine.map(fn);
    return this;
  };

  Log.prototype.inject = function(obj) {
    this.engine.inject(obj);
    return this;
  };

  // Start watching events from a stream. As items pass through, the
  // `map` procedure is called with an AppContext as `this`. Use
  // `this.log()` to add entires to the log.

  Log.prototype.bind = function(stream, appId) {
    this.engine.add(stream, new AppContext(this, appId));
    return this;
  };

  // At each heartbeat, the current Stats object is emitted to the
  // reducer and replaced with a fresh one.

  Log.prototype.heartbeat = function(delay) {
    this.engine.heartbeat(delay);
    return this;
  };

  Log.prototype.publishUpdates = function(me, port, host) {
    var self = this,
        ready = false,
        stream,
        buffer;

    function connect() {
      (stream = Api.persistentConnection(port, host))
        .identity(me)
        .on('connect', function() {
           stream.Source(onOk);
        })
        .on('error', function(err) {
          console.log('Log.publishUpdates Error:', err);
        })
        .on('disconnect', function(retry) {
          ready = false;
          console.log('Connection failed, reconnecting in %s seconds', retry / 1000);
        });
    }

    function onOk(mesg) {
      ready = true;
      stream.peer(mesg.from);
      flush();
    }

    function flush() {
      if (buffer) {
        stream.Push(buffer);
        buffer = undefined;
      }
    }

    self.on('update', function(_, quantum) {
      if (ready)
        quantum.data.isEmpty() || stream.Push(quantum);
      else if (buffer)
        buffer.add(quantum);
      else
        buffer = quantum;
    });

    connect();
    return this;
  };

  Log.prototype.start = function() {
    this.score.start();
    return this;
  };

  Log.prototype.reset = function() {
    this.score.reset();
    return this;
  };

  Log.prototype.stop = function() {
    this.score.stop();
    return this;
  };

  Log.prototype.total = function() {
    return this.score.total;
  };

  
  // ## AppContext ##

  // Each server keeps a single log. An AppContext simplifies logging
  // code by closing over an `appId` and making the `channel`
  // optional.

  function AppContext(top, appId) {
    this.top = top;
    this.appId = appId;
  }

  AppContext.prototype.log = function(kind, count, channel) {
    this.top.inject({
      appId: this.appId,
      kind: kind,
      channel: channel || null,
      count: count
    });
    return this;
  };

  
  // ## Stats ##

  function Stats(channels) {
    this.channels = channels || {};
  }

  // As items flow throw a stream, a Stats instance is continually
  // updated. Each item in the stream is mapped to a channel. Stats
  // are kept for each channel in the form of (kind, count) pairs.
  //
  // For example, a Stats object might track a set of channels like
  // this:
  //
  //     {
  //       "#global": { bytesIn: 90, bytesOut: 702, itemsIn: 2, itemsOut: 21 },
  //       "#lobby": { ... },
  //       ...
  //     }

  Stats.prototype.update = function(item) {
    inc(this.channel(this.key(item)), item.kind, item.count);
    return this;
  };

  Stats.prototype.key = function(item) {
    return item.appId + (item.channel ? '/' + item.channel : '');
  };

  Stats.prototype.channel = function(key) {
    return U.get(this.channels, key, Object);
  };

  // Stats are transmitted and received over the wire. The API uses
  // these methods to create and extract the `body` attribute of a
  // message.

  Stats.load = function(data) {
    return new Stats(data);
  };

  Stats.prototype.dump = function() {
    return this.channels;
  };

  // Basic math and query operations are supported here.

  Stats.prototype.isEmpty = function() {
    return U.isEmpty(this.channels);
  };

  Stats.prototype.each = function(fn) {
    for (var key in this.channels)
      fn(this.channels[key], key, this);
    return this;
  };

  Stats.prototype.add = function(other) {
    var self = this;
    other.each(function(chan, key) {
      incAll(self.channel(key), chan);
    });
    return this;
  };

  Stats.prototype.count = function(kind) {
    if (arguments.length == 0) {
      var result = {};
      this.each(function(chan) {
        incAll(result, chan);
      });
      return result;
    }
    else {
      var result = 0;
      this.each(function(chan) {
        result += chan[kind] || 0;
      });
      return result;
    }
  };

  
  // ## Helper Methods ##

  function incAll(a, b) {
    for (var key in b)
      inc(a, key, b[key]);
    return a;
  }

  function inc(obj, key, count) {
    obj[key] = (obj[key] || 0) + count;
    return obj;
  }

});
