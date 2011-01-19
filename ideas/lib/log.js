// # log.js #
//
// Keep statistics about traffic flowing through streams. Create a
// monitor for your server. For each connection,
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

define(['exports', './util', './mapred'],
function(exports, U, Mr) {

  exports.Monitor = Monitor;

  U.inherits(Monitor, U.EventEmitter);
  function Monitor(averages) {
    U.EventEmitter.call(this);

    var self = this;

    (this.engine = new Mr.ReduceStream('read', 'write'))
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

  Monitor.prototype.bind = function(stream, appId) {
    this.engine.add(stream, new Log(this, appId));
    return this;
  };

  Monitor.prototype.start = function() {
    this.score.start();
    return this;
  };

  Monitor.prototype.reset = function() {
    this.score.reset();
    return this;
  };

  Monitor.prototype.stop = function() {
    this.score.stop();
    return this;
  };

  Monitor.prototype.total = function() {
    return this.score.total;
  };

  Monitor.prototype.heartbeat = function(delay) {
    this.engine.heartbeat(delay);
    return this;
  };

  Monitor.prototype.map = function(fn) {
    this.engine.map(fn);
    return this;
  };

  Monitor.prototype.inject = function(obj) {
    this.engine.inject(obj);
    return this;
  };

  
  // ## Log ##

  function Log(top, appId) {
    this.top = top;
    this.appId = appId;
  }

  Log.prototype.log = function(kind, count, channel) {
    this.top.inject({
      appId: this.appId,
      kind: kind,
      channel: channel || null,
      count: count
    });
    return this;
  };

  
  // ## Stats ##

  function Stats() {
    this.channels = {};
  }

  Stats.prototype.key = function(item) {
    return item.appId + (item.channel) ? '/' + item.channel : '';
  };

  Stats.prototype.channel = function(key) {
    return U.get(this.channels, key, Object);
  };

  Stats.prototype.each = function(fn) {
    for (var key in this.channels)
      fn(this.channels[key], key, this);
    return this;
  };

  Stats.prototype.update = function(item) {
    inc(this.channel(this.key(item)), item.kind, item.count);
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