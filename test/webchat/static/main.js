$(document).ready(function() {
  
  var channel = "#global";

  function updateChannel (ch) {
    channel = ch;
    $("#channel").text(ch);
  };

  function updateMesgPane (dat) {
      $("#messages").append(dat);
      var pane = document.getElementById("messages");
      pane.scrollTop = pane.scrollHeight
    }

  function addUserToPane (channelId, clientId) {
    updateUserPane("<div class='user "+clientId+"'>" + channelId + "/@" + clientId + "</div>");
  };
  function removeFromUserPane (clientId) {
    $("#users ."+clientId).hide();
    };

  function updateUserPane (dat) {
    $("#users").append(dat);
  };

  var callbacks = {};

  function addCallback (id, callback) {
    if (typeof(callbacks[id]) == "undefined") {
      callbacks[id] = [];
    }
    callbacks[id].push(callback);
  }

  var ws = new WebSocket("ws://magic:8080");
  ws.addEventListener("message",function(mesg) {
    // console.log(mesg.data);
    var json = JSON.parse(mesg.data);
    if (json.type == "Welcome") {
      // ws.send('{"type":"Join", "body":"#sanders"}');
      $("#username").text(json.body);
      ws.send(JSON.stringify({"type": "GetStatus", "body": "#global"}));
    }

    if (json.mesgId && callbacks[json.mesgId]) {
      for (var i = 0; i < callbacks[json.mesgId].length; i++) {
        callbacks[json.mesgId][i](json);
      }
    }

    if (json.type == "Message") {
      updateMesgPane("<pre class='mesg'>" + json.from + " -> " + json.to + ": " + json.body + "</pre>")
    }

    if (json.type == "ClientEnter") {
      if (json.body.channelId == channel)
        addUserToPane(json.body.channelId, json.body.clientId);
    }

    if (json.type == "ClientExit") {
      removeFromUserPane(json.body.clientId);
    }


    if (json.type == "ResourceStatus") {
      $("#users").html("");
      for (var i = 0; i < json.clients.length; i++) {
        addUserToPane(json.channel, json.clients[i]);
      }
    }
    if (json.type == "Error") {
      updateMesgPane("<pre class='mesg error'>Error: " + json.body + "</pre>")
    }


  });
  ws.addEventListener("open", function () {
    ws.send(JSON.stringify({"type":"Hello",
                            "body":"test", 
                            "keys": ["read_key","write_key"] }));
  });

  $("#send").click(sendUserInput);
  $("#user-input").keypress(function(e) {
    if (e.keyCode == 13) {
      sendUserInput();
    }
  });


var matchCommand = new RegExp("^/(JOIN|join|LEAVE|leave) ?(.*)?");
function sendUserInput () {
    var input = $("#user-input").val();
    var command = input.match(matchCommand);
    if (command) {
      var com = command[1].toLowerCase();
      var rest = command[2];
      if (com == "join") {
        var mid = "TEST" + rest;
        ws.send(JSON.stringify({"type": "Join",
                                "mesgId": mid,
                                "body": rest }));
        addCallback(mid, function (mesg) {
          if (mesg.type != "Error") {
            updateChannel(rest);
            ws.send(JSON.stringify({"type": "GetStatus", "body": rest}));
          }          
        });
      }
      if (com == "leave") {
        ws.send(JSON.stringify({"type": "Exit", "body": channel}));
        updateChannel("#global");
        ws.send(JSON.stringify({"type": "GetStatus", "body": "#global"}));
      }

    } else {
      ws.send(JSON.stringify({"type":"Message","to": channel, "from":"@me","body": input }));
    }
    $("#user-input").val("");
  }

});
