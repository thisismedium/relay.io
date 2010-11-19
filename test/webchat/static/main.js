$(document).ready(function() {
  
  var channel = "#global";

  function updateChannel (ch) {
    channel = ch;
    $("#channel").text(ch);
  };

  var ws = new WebSocket("ws://magic:8080");
  ws.addEventListener("message",function(mesg) {
    //    console.log(mesg.data);
    var json = JSON.parse(mesg.data);
    if (json.type == "Welcome") {
      // ws.send('{"type":"Join", "body":"#sanders"}');
      $("#username").text(json.body);
    }
    if (json.type == "Message") {
      $("#messages").text($("#messages").text() + json.from + " -> " + json.to + ": " + json.body + "\n" );
      var pane = document.getElementById("messages");
      pane.scrollTop = pane.scrollHeight
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


var matchCommand = new RegExp("^/(JOIN|join) (.*)");
function sendUserInput () {
    var input = $("#user-input").val();
    var command = input.match(matchCommand);
    if (command) {
      var com = command[1].toLowerCase();
      var rest = command[2];
      if (com == "join") {
        updateChannel(rest);
        ws.send(JSON.stringify({"type": "Join",
                                "body": rest }));
      }
    } else {
      ws.send(JSON.stringify({"type":"Message","to": channel, "from":"@me","body": input }));
    }
    $("#user-input").val("");
  }

});
