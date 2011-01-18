// # Log Traffic #
//
// This example demonstrates how a Log and Top are used.
//
// An associated shell script pipes a `tcpdump` into this script's
// standard input. An EventEmitter and `U.readlines(stdin)` convert
// the `tcpdump` output into a simulated JSON stream (see
// relay/stream.js).
//
// The log collects individual events into a Stats object for the
// duration of its hearbeat. When the Top receives a stats object, it
// updates its aggregate and emits an `update` event.

define(['relay/log', 'relay/util'], function(Log, U) {

  var addr = process.argv[2],

      // Simulate a real stream with an EventEmitter.
      stream = new U.EventEmitter(),

      // Watch for `from` and `to` properties of events in the
      // stream. Set the heartbeat to 1 second.
      log = new Log.Log(['from', 'to'])
        .add(stream)
        .heartbeat(1000),

      // Summarize the log. When called this way, the most recent
      // stats, a 5 minute average, and a total of stats will be kept.
      top = new Log.Top(log, [300]);

  // Show updated stats each time the Top instance updates
  // itself. This is driven by the log's heartbeat.
  top.on('update', function() {
    var last = this.last,
        total = this.total,
        avg = total.average();

    console.log('i/o last: %d/%d avg: %d/%d total: %d/%d time: %d',
      last.bytesIn, last.bytesOut,
      avg.bytesIn, avg.bytesOut,
      total.bytesIn, total.bytesOut,
      avg.delta
    );
  });

  // Start collecting statistics.
  top.start();

  // This driver loop simulates a real stream. Packets sent to this
  // computer's address are considered `data` events. Packets sent
  // from this computer's address are considered `write` events.
  U.readlines(process.openStdin(), function(line) {
    var probe = line.match(/IP (\S+)\.\d+ > (\S+)\.\d+.+length (\d+)/),
        name = null;

    if (probe && probe[1] == addr)
      name = 'write';
    else if (probe && probe[2] == addr)
      name = 'data';

    if (name)
      stream.emit(name, { from: probe[1], to: probe[2] }, parseInt(probe[3]));
  });

  process.on('SIGINT', function() {
    var stats = top.average[300].stats(),
        avg = stats.average(),
        rate = top.average[300].avgRate();

    console.log('\n## 5 Minute Breakdown ##\n');

    var tally = [];
    for (var key in stats._in['from']) {
      tally.push({
        key: key,
        bytesIn: stats._in['from'][key] + stats._in['to'][key],
        bytesOut: stats._out['from'][key] + stats._out['to'][key]
      });
    }

    tally.sort(function(a, b) {
      var ta = a.bytesIn + a.bytesOut,
          tb = a.bytesOut + b.bytesOut;
      return (ta < tb) ? -1 : (ta == tb) ? 0 : 1;
    });

    tally.forEach(function(entry) {
      console.log('%s i/o: %d/%d', entry.key, entry.bytesIn, entry.bytesOut);
    });

    console.log('');
    console.log('total i/o:    %d/%d', stats.bytesIn, stats.bytesOut);
    console.log('avg i/o:      %d/%d', avg.bytesIn, avg.bytesOut);
    console.log('avg rate i/o: %d/%d', rate.bytesIn, rate.bytesOut);
    console.log('avg load:     %d', rate.bytes);
    console.log('interval:     %d seconds', avg.delta);
    console.log('');

    process.exit(0);
  });

});