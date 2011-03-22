Perms = require("./types/perms");
U = require("./util");
Events = require("events");

// Dispatcher
// The dispatcher manages streams and mailboxes, its takes messages
// from a stream and sends them to mailboxes, it also controls the 
// permissions on mailboxes.
function Dispatcher () {
  var mailboxes = {};
  var servers   = [];
  var routes    = {};
};

// newMailBox - create and register a new mailbox
Dispatcher.prototype.newMailBox = function (label, perms) {
  var p  = Perms.makePermFromString(perm, 0);
  var mb = new MailBox(this, label, p);
  this.mailboxes[label] = mb;
  return mb
};

// collectFrom - tells the dispatcher to collect messages from a stream
// and route them to mailboxes...
Dispatcher.prototype.collectFromClient = function (route, perms) {
  routes[label] = { "route": route, "perms": perms };
  return this;
};

// MailBox
// a mail box is a collection of subscribers messages get fed into a mailbox
// and then sent to the subscribers of the mailbox.  The mailbox expects legal 
// message from the dispatcher, though the permissions for the mailbox are stored
// in the mailbox object itself.
function MailBox (parent, label, defaultPerm) {
  this.parent      = parent;
  this.label       = label;
  this.defaultPerm = defaultPerm || 0;
  this.clientPerms = {};
  this.subscriber  = [];
};

// changeGlobalMode - changes the global permissions mask for this mailbox.
MailBox.prototype.setDefaultPerms = function (permstr) {
  Perm.makeMaskFromString(permstr)(this.defaultPerm);
  return this;
};

// addClient - add a member to the mail box, members with read perms
// will recieve messages from this mailbox (and a stream should be provided).
// Members with write perms can write to this mailbox. The mail box does need
// to confirm that a subscriber has read perms when they are added.
MailBox.prototype.setClientPerms = function (client, permstr) {
  var perm = Perm.makePermFromString(permstr, 0);
  this.clientPerms[client.label] = perms;
  return this;
};

MailBox.prototype.addSubscriber = function (client) {
  var perm = this.defaultPerm | (this.clientPerms[client.label] ? this.clientPerms[client.label] : 0)
  if (Perms.canRead(perm)) {
    this.subscribers.push(client);
    return true;
  } else {
    return false;
  }
}

// the Client object simply encapsulates a label and a stream so they can
// be passed to and used by the dispatchr in a more uniform manner.
// Client act as streams.
U.inherits(Client, Events.EventEmitter);
function Client (label, stream) {
  Events.EventEmitter.apply(this);
  this.label = label;
  this.stream = stream;
  proxyEvents(["error","end"], stream, this);
  stream.on("data", function (mesg) {
    mesg.to = label;
    self.emit(mesg);
  });
};


// example ////////////////////////////////////////////

var d = new Dispatcher();

var root = new Client("@root", stream);
var user1 = new Client("@user1", stream);

d.collectFromClient(root , "+rw"); // addes a special global mask for the client
d.collectFromClient(user1);

mb = d.newMailBox("@user1", "+w");
mb.addClient(user1, "+r");

mb = d.newMailbox("#channel");
mb.setClientPerms(user1, "+r");  // user1 can read from this channel
mb.setClientPerms(user2, "+w");  // user2 can write to this channel

mb.addSubscriber(user1) // return true
mb.addSubscriber(user2) // returns false (cannot subscribe)

// root can read and write to this channel
mb.removeClient("@user3");  // user3 will not long recieve message for this mailbox
mb.editAllMembers("r");     // makes all users readonly

mb.intercept("Leave", handler); // intercepts all Leave messages and passes them to the handler



