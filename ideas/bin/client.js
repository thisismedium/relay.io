define(['relay/application', 'relay/util'],
function(App, U) {

  var name = process.argv[2],
      port = process.argv[3],
      client = App.createClient(name, port),
      input = process.openStdin();

  client
    .on('connect', function() {
      console.log('%s connected.', this);
      client.send('hello', name);
    })
    .on('data', function(msg) {
      console.log('received: %j', msg);
    })
    .on('end', function() {
      quit('Connection closed');
    })
    .on('timeout', function() {
      quit('Connection timed out');
    })
    .on('error', function(err) {
      quit(err, 1);
    });

  U.readlines(input, function(line) {
    var probe = line.match(/^\/(\S+)\s*(.*)$/);
    if (!probe)
      console.log('## Syntax Error ##');
    else
      client.send(probe[1], probe[2]);
  });

  process.on('SIGINT', function() {
    quit('Caught SIGINT');
  });

  function quit(reason, status) {
    console.log('%s, exiting.', reason);
    process.exit(status || 0);
  }

});