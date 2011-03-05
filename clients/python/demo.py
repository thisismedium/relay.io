from relayclient import *
import json

class ChatMaster:

    def __init__(self):
        self.clientNames = {}
        self.client = RelayClient()
        self.client.connect(self.connectHandler)

    def messageHandler (self, mesg, sender):
        if mesg.has_key("type") and mesg["type"] == "Introduce":
            self.clientNames[sender.address] = sender.address
            sender.send(json.loads(self.clientNames))
            print self.clientNames
        else:
            print "GOT MESSAGE"
            print mesg

    def connectHandler (self, globalChan, userChan):
        print isinstance(globalChan, RelayChannel)
        globalChan.onMessage(self.messageHandler)
        userChan.onMessage(self.messageHandler)
        self.client.join("#medium", lambda x: x)
        


ChatMaster()


