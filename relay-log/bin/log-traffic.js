// # Log Traffic #
//
// This example demonstrates how a Log is used.
//
// An associated shell script pipes a `tcpdump` into this script's
// standard input. An EventEmitter and `U.readlines(stdin)` convert
// the `tcpdump` output to simulate a stream.
//
// The log collects individual events into a Stats object for the
// duration of its hearbeat. At each heartbeat tick, and the stats are
// folded into an aggregate and an `update` event is emitted.

define(['relay-log/log', 'relay-log/archive', 'relay-core/util'],
function(Log, Archive, U) {

  var addr = process.argv[2],
      stream = new U.EventEmitter();

  
  // ## Important Part ##

  // A log is set up. It keeps the last update, a total tally, and
  // a 5 minute average. The `map` method takes events from `stream` and adds
  // them to the log.

  var log = new Log.Log([300]).bind(stream, 'example');

  log.map(function(ev) {
    this.log(ev.type + '-bytes', ev.nbytes, ev.data.to);
    this.log(ev.type + '-count', 1, ev.data.to);
  });

  log.publishUpdates('traffic@localhost', 8160).start();

  
  // ## Not Important ##

  log.on('update', function(stats) {
    console.log('Bytes I/O: %d/%d', stats.count('read-bytes'), stats.count('write-bytes'));
  });

  // This driver loop simulates a real stream. Packets sent to this
  // computer's address are considered `read` events. Packets sent
  // from this computer's address are considered `write` events.
  U.readlines(process.openStdin(), function(line) {
    var probe = line.match(/IP (\S+)\.\d+ > (\S+)\.\d+.+length (\d+)/),
        name = null;

    if (probe && probe[1] == addr)
      name = 'out';
    else if (probe && probe[2] == addr)
      name = 'in';

    if (name)
      stream.emit(name, { from: probe[1], to: probe[2] }, parseInt(probe[3]));
  });

  process.on('SIGINT', function() {
    var total = log.total(),
        stats = total.data,
        count = stats.count(),
        avgIn = Math.round(count['in-bytes'] / count['in-count']),
        avgOut = Math.round(count['out-bytes'] / count['out-count']);

    console.log('\n## Summary ##');
    console.log('');
    console.log('Bytes I/O:     %d/%d', count['in-bytes'], count['out-bytes']);
    console.log('Messages I/O:  %d/%d', count['in-count'], count['out-count']);
    console.log('Avg Bytes I/O: %d/%d', avgIn, avgOut);
    console.log('Time:          %d seconds', total.delta() / 1000);
    console.log('');

    process.exit(0);
  });

});
