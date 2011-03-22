function Dispatcher () {

  var mailboxes = {};
  var servers   = {};

}

Dispatcher.prototype.newMailbox = function (label) {
  var mb = new MailBox(this, label);
  this.mailboxes[label] = mb
  return mb
};

function MailBox (parent, label) {
  this.parent = parent;
  this.label  = label;
}

// example

var d = new Dispatcher();

d.registerUser("@root", socket, "+rw");
d.registerUser("@user1", socket);

mb = d.newMailbox("@user1");
mb.addMember("@user1", "+r", socket);
mb.registerReciever(socket);
mb.changeGlobalMode("+w");


mb = d.newMailbox("#channel");
mb.addMember("@user1", "+r", socket)  // user1 can read from this channel
mb.addMember("@user2", "+w") // user2 can write to this channel
// root can read and write to this channel
mb.removeMember("@user3");  // user3 will not long recieve message for this mailbox
mb.editAllMembers("r"); // makes all users readonly

mb.intercept("Leave", handler) // intercepts all Leave messages and passes them to the handler



