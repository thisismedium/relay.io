// Dispatcher
// The dispatcher manages streams and mailboxes, its takes messages
// from a stream and sends them to mailboxes, it also controls the 
// permissions on mailboxes.

function Dispatcher () {
  var mailboxes = {};
  var servers   = [];
  var routes    = {};
}

Dispatcher.prototype.newMailbox = function (label) {
  var mb = new MailBox(this, label);
  this.mailboxes[label] = mb
  return mb
};

Dispatcher.prototype.collectFrom = function (label, stream, perms) {
  var route = new Route(label, stream, perms);
  routes[label] = route;
  return route;
};

// MailBox
// a mail box is a collection of subscribers messages get fed into a mailbox
// and then sent to the subscribers of the mailbox.  The mailbox expects only
// legal messages to be placed inside it.

function MailBox (parent, label) {
  this.parent = parent;
  this.label  = label;
};

function Route () {


  };

// example

var d = new Dispatcher();

d.collectFrom(socket, "@root", "+rw");
d.collectFrom(socket, "@user1");

mb = d.newMailbox("@user1");
mb.addMember("@user1", "+r", socket);
mb.registerReciever(socket);
mb.changeGlobalMode("+w");


mb = d.newMailbox("#channel");
mb.addMember("@user1", "+r", socket);  // user1 can read from this channel
mb.addMember("@user2", "+w");          // user2 can write to this channel

// root can read and write to this channel
mb.removeMember("@user3");  // user3 will not long recieve message for this mailbox
mb.editAllMembers("r");     // makes all users readonly

mb.intercept("Leave", handler); // intercepts all Leave messages and passes them to the handler



