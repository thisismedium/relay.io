var plexy = require("./plexy");

var client = plexy.PlexyClient(5000, "localhost");

var chan2 = client.newChannel();
chan2.on("data", function (data){ console.log("I GOT SOME DATA ON Channel #2") ; chan1.write("Hello from channel 1")})

var chan1 = client.newChannel();
chan1.on("data", function (data){ console.log("I GOT SOME DATA ON Channel #1"); chan2.write("Hello from channel 2") })
chan1.write("Hello from channel 1");

