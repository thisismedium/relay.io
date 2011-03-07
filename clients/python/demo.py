from relayclient import *
import json

class ChanWatcher:
    def __init__(self, chan):
        self.chan = chan
        self.chan.on("Message", self.writeMessage)
        chan.send({
            "type": "Introduce",
            "name": "master"
        });
        
    def writeMessage(self, mesg, _):
        print "Got message from %s: " % self.chan.address,
        print mesg

class ChatMaster:

    def __init__(self):
        self.clientNames = {}
        self.client = RelayClient()
        self.client.connect("test", "1e39e158-3cb8-4bee-bb07-26b71702c471", self.connectHandler)

    def messageHandler (self, mesg, sender):
        if mesg.has_key("type") and mesg["type"] == "Introduce":
            self.clientNames[sender.address] = sender.address
            sender.send(json.loads(self.clientNames))
            print self.clientNames
        else:
            print "GOT MESSAGE"
            print mesg

    def joinHandler (self, chan):
        print " + Joined %s" % chan.address
        ChanWatcher(chan)
        
    def connectHandler (self, globalChan, userChan):
        ChanWatcher(globalChan)
        userChan.on("Message", self.messageHandler)
        self.client.join("#medium", self.joinHandler)
        self.client.join("#talk", self.joinHandler)
        self.client.join("#linux", self.joinHandler)
        self.client.join("#haskell", self.joinHandler)
        
ChatMaster()


