// # log.js #
//
// Collect statistics from JSON streams. Each stream must emit these
// events:
//
//   .on('data', function(obj, nbytes))
//   .on('write', function(obj, nbytes))
//
// where `obj` is the (unserialized) JSON object written and `nbytes`
// is the length of the serialized object in bytes.
//
// A Log is the driver. It listens to streams and collects stats. At
// each heartbeat, its stats are emitted and reset. It's a bit like
// the map in a map-reduce.
//
// A Top (e.g. unix `top` command) can collect statistics emitted from
// a Log and aggregate them. It's a bit like a reduce.
//
// For example:
//
//     var log = new Log(['from', 'to']),
//         top = new Top(log).heartbeat(1000);
//
//     server.on('connection', function(stream) {
//       log.bind(stream);
//       stream.on('close', function() {
//         log.unbind(stream);
//       });
//     });
//
//     top.on('update', function() {
//       var total = this.total;
//       console.log('i/o: %d/%d', total.bytesIn, total.bytesOut);
//     });
//
//     top.start();

define(['exports', './util'], function(exports, U) {

  exports.Log = Log;
  exports.Top = Top;

  
  // ## Log ##
  //
  // A log binds to JSON streams and collects statistics about them
  // over a heartbeat interval. At each interval, the stats are
  // emitted and reset.
  //
  // The type of stream it binds to must support `data` and `write`
  // events. See 'relay/stream'.

  U.inherits(Log, U.EventEmitter);
  function Log(criteria) {
    U.EventEmitter.call(this);

    var self = this;

    this.criteria = criteria;
    this.total = null;
    this.delay = null;
    this.interval = null;

    this.onRead =  function(obj, len) { self.total.read(obj, len); };
    this.onWrite = function(obj, len) { self.total.write(obj, len); };
  }

  Log.prototype.add = function(stream) {
    stream
      .on('data', this.onRead)
      .on('write', this.onWrite);
    return this;
  };

  Log.prototype.remove = function(stream) {
    stream
      .removeListener('data', this.onRead)
      .removeListener('write', this.onWrite);
    return this;
  };

  Log.prototype.stats = function() {
    return this.total;
  };

  Log.prototype.makeStats = function() {
    return new Stats(this.criteria);
  };

  Log.prototype.start = function() {
    if (!this.total) {
      this.total = this.makeStats();
      if (this.interval)
        clearInterval(this.interval);
      if (this.delay) {
        var self = this;
        setInterval(function() { self.rotate(); }, this.delay);
      }
    }
    return this;
  };

  Log.prototype.stop = function() {
    if (this.interval)
      clearInterval(this.interval);
    if (this.total)
      this.emit('stats', stats.stop());
    this.total = this.interval = null;
    return this;
  };

  Log.prototype.rotate = function() {
    var stats = this.total;
    this.total = this.makeStats();
    this.emit('stats', stats.stop());
    return this;
  };

  Log.prototype.heartbeat = function(delay) {
    this.delay = delay;
    return this;
  };

  
  // ## Stats ##
  //
  // A collection of statistics over some time interval. If `criteria`
  // is specified, keep an i/o tally unique values of these properties
  // in the stream.
  //
  // For example, if `criteria` is `["to", "from"]`, and these objects
  // passed through a stream:
  //
  //     ('write', { "from": "a", "to": "b", ... }, 10)
  //     ('data', { "from": "b", "to": "a", ... }, 20)
  //
  // The stats object would look like this:
  //
  //     {
  //       bytesIn: 20,
  //       bytesOut: 10,
  //       _in:  { from: { a: 0, b: 20 }, to: { a: 20, b: 0 } },
  //       _out: { from: { a: 10, b: 0 }, to: { a: 0, b: 10 } }
  //     }

  function Stats(criteria) {
    this.started = Date.now();
    this.stopped = undefined;

    this.criteria = criteria || [];
    this.bytesIn = 0;
    this.bytesOut = 0;
    this._in = { };
    this._out = { };

    var self = this;
    this.criteria.forEach(function(name) {
      self._in[name] = {};
      self._out[name] = {};
    });
  }

  Stats.prototype.stats = function() {
    return this;
  };

  Stats.prototype.delta = function() {
    return ((this.stopped || Date.now()) - this.started) / 1000;
  };

  Stats.prototype.average = function() {
    var delta = this.delta();
    return {
      delta: delta,
      bytesIn: Math.round(this.bytesIn / delta),
      bytesOut: Math.round(this.bytesOut / delta)
    };
  };

  Stats.prototype.read = function(obj, len) {
    var criterium, value, probe;

    this.bytesIn += len;
    for (criterium in this._in) {
      value = obj[criterium] || '';
      if ((probe = this._in[criterium][value]) === undefined) {
        this._in[criterium][value] = 0;
        this._out[criterium][value] = 0;
      }
      this._in[criterium][value] += len;
    }

    return this;
  };

  Stats.prototype.write = function(obj, len) {
    var criterium, value, probe;

    this.bytesOut += len;
    for (criterium in this._in) {
      value = obj[criterium] || '';
      if ((probe = this._in[criterium][value]) === undefined) {
        this._in[criterium][value] = 0;
        this._out[criterium][value] = 0;
      }
      this._out[criterium][value] += len;
    }

    return this;
  };

  Stats.prototype.stop = function() {
    this.stopped = Date.now();
    return this;
  };

  Stats.prototype.update = function(stats) {
    this.bytesIn += stats.bytesIn;
    this.bytesOut += stats.bytesOut;

    for (var criterium in this._in) {
      extendSums(this._in[criterium], stats._in[criterium]);
      extendSums(this._out[criterium], stats._out[criterium]);
    }

    return this;
  };

  function extendSums(a, b) {
    for (var key in b)
      a[key] = (a[key] || 0) + b[key];
    return a;
  }

  
  // ## Top ##

  // Aggregate a log over time. This is similar in spirit to the unix
  // `top` command. The log's hearbeat drives a top, which always
  // keeps the last stats object emitted from the log and a grand
  // total.
  //
  // If `averages`  is given,  it should be  an array of  intervals in
  // seconds (e.g. [300, 3600] for 5 minutes and an hour). Stats that
  // fall into those windows will be kept in a list for later
  // inspection.

  U.inherits(Top, U.EventEmitter);
  function Top(log, averages) {
    U.EventEmitter.call(this);

    var self = this;

    this.total = null;
    this.last = null;
    this.average = {};

    (this.log = log)
      .on('stats', function(stats) { self.update(stats); });

    (averages || []).forEach(function(secs) {
      self.average[secs] = null;
    });
  }

  Top.prototype.makeStats = function() {
    return this.log.makeStats();
  };

  Top.prototype.start = function() {
    if (!this.total)
      this.reset();
    this.log.start();
    return this;
  };

  Top.prototype.stop = function() {
    this.total = this.last = null;

    for (var secs in this.average)
      this.average[secs] = null;

    return this;
  };

  Top.prototype.reset = function() {
    this.total = this.makeStats();
    this.last = this.makeStats();

    for (var secs in this.average)
      this.average[secs] = new Average(this, secs);

    return this;
  };

  Top.prototype.update = function(stats) {
    var self = this;

    this.last = stats;
    this.total.update(stats);

    for (var secs in this.average)
      this.average[secs].update(stats);

    this.emit('update');
    return this;
  };

  
  // ## Average ##

  // Collect a running list of Stats objects for some time
  // interval. This can be used to calculate useful statistics over
  // the interval later.

  function Average(top, secs) {
    this.top = top;
    this.time = secs * 1000;
    this.queue = [];
  }

  Average.prototype.update = function(stats) {
    var bound = stats.stopped - this.time,
        queue = this.queue;

    queue.push(stats);
    for (var i = 0, l = queue.length;
         i < l && queue[i].started < bound;
         i++);
    queue.splice(0, i);

    return this;
  };

  Average.prototype.stats = function() {
    var seed = this.top.makeStats().stop(),
        size = this.queue.length;

    if (size == 0)
      return seed;

    seed.started = this.queue[0].started;
    seed.stopped = this.queue[size - 1].stopped;

    this.each(function(stats) {
      seed.update(stats);
    });

    return seed;
  };

  Average.prototype.each = function(fn) {
    this.queue.forEach(fn);
    return this;
  };

  Average.prototype.avgRate = function() {
    var total = this.queue.length,
        stats,
        delta = 0,
        rateIn = 0,
        rateOut = 0;

    this.each(function(stats) {
      delta = stats.delta();
      rateIn += stats.bytesIn / delta;
      rateOut += stats.bytesOut / delta;
    });

    console.log('avgRate', rateIn, rateOut, total);

    return {
      total: total,
      bytes: Math.round((rateIn + rateOut) / total, 2),
      bytesIn: Math.round(rateIn / total, 2),
      bytesOut: Math.round(rateOut / total, 2)
    };
  };

});