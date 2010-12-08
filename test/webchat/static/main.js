
////////////////////////////////////////////////////////////////////////

$(document).ready(function() {
  var relay = new relayio.RelayClient("test",["write_key", "read_key"]);
  relay.connect(function (global_chan, private_chan) {

    console.log(global_chan);

    global_chan.send("Hello Global Channel");

    global_chan.on("client-enter", function (client) {
      console.log(client.getName() + " has entered global, I shall greet them!");
      client.send("Hello Client " + client.getName());
      client.send("Hello Client " + client.getName());
      client.send("Hello Client " + client.getName());
      client.send("Hello Client " + client.getName());
    });

    global_chan.on("message", function(mesg) {
      console.log("GOT MESSAGE IB GLOBAL: " + mesg);
    });

    private_chan.on("message", function(mesg) {
      console.log("GOT PRIVATE MESSAGE: " + mesg);
    });

    console.log("I have connected");

    /*
    relay.join("#rabbits", function (err, chan) {
      if (err) throw err;
      chan.send("Hello World", function(err) {
        if (err) throw err;  
      });
    });
    */
  });
});


