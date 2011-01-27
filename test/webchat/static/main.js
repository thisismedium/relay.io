var RELAY_CARRIER_HOST = [["localhost", 8000]]
////////////////////////////////////////////////////////////////////////

var command_history = [];
var hist_pointer = 0;

function fixName (name) { 
  return name.replace(/[@#\/]/g,"_") 
};

function addUser(chan, name) {
  $("#user-pane").append("<div class='user "+fixName(name)+"'>" + chan + "/" + name+"</div>");
};
function removeUser(name) {
  $(".user." + fixName(name)).remove();
};

function addMessage(message, to, from) {
  $("#messages").append("<pre class='mesg'>"+from.getName()+": "+message+"</pre>");
  var pane = document.getElementById("messages");
  pane.scrollTop = pane.scrollHeight
}
function resetUI() {
  $("#messages").html("")
  $("#user-pane").html("")
};
var current_chan;

function setupChan(chan, callback) {
  resetUI();
  if(current_chan) {
    current_chan.removeAllListeners("client-enter");
    current_chan.removeAllListeners("client-exit");
    current_chan.removeAllListeners("message");
  }
  chan.getStatus(function(err, users) {
    $("#channel").text(chan.getName());
    for (var i = 0; i < users.length; i++) {
      addUser(chan.getName(),  users[i].getName());
    }

    chan.on("client-enter", function (user) {
      addUser(chan.getName(), user.getName());
    });
    
    chan.on("client-exit", function(user) {
      removeUser(user.getName());
    });
    
    chan.on("message", function (mesg, from) {
      addMessage(mesg, chan.getName(),from);
    });
    current_chan = chan;
    if (callback) callback(chan);
  });
};

$(document).ready(function() {
  $("#user-input").focus(function(){$(this).addClass("hover")});
  $("#user-input").blur(function(){$(this).removeClass("hover")});
  var relay = new relayio.RelayClient("test",["a37d0b8e-2152-4f64-9b0b-1ae7c39d1da7", 
                                              "1e39e158-3cb8-4bee-bb07-26b71702c471", 
                                              "812af3d1-288d-4469-8160-8cbaa4774539"]);
  relay.connect(function (global_chan, private_chan) {
    $("#username").text(relay.getClientId());
    setupChan(global_chan, function() {});
    $("#send").click(sendUserInput);
    $("#user-input").keypress(function(e) {
      if (e.keyCode == 13) {
        sendUserInput();
      }
      if (e.keyCode == 38) {
        var com;
        if (com = command_history[--hist_pointer])
          $("#user-input").val(com);
      }
      if (e.keyCode == 40) {
        var com;
        if (com = command_history[++hist_pointer])
          $("#user-input").val(com);
      }

    });
    var matchCommand = new RegExp("^/(JOIN|join|LEAVE|leave) ?(.*)?");

    function sendUserInput () {
      var input = $("#user-input").val();
      if (!input) return 0;
      var command = input.match(matchCommand);
      if (command) {
        var com = command[1].toLowerCase();
        var rest = command[2];
        if (com == "join") {
          relay.join(rest, function (err, chan) {
            if (err) throw err;
            setupChan(chan);
          });
        }
        if (com == "leave") {
          current_chan.exit(function() {
            setupChan(global_chan);
          });
        }
      } else {
        current_chan.send(input);
      }
      command_history.push(input);
      hist_pointer = command_history.length;
      $("#user-input").val("");
    }
    
});
});


