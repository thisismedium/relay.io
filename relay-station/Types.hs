-- This is not a haskell project but the haskell type system is a great
-- system for organizing abstract ideas into a usable structure.

type Id      = Integer
type Address = String

data Message = Message {
      getType      :: String,
      getId        :: Id,
      getSender    :: Address,
      getRecipient :: Address,
      getBody      :: String
    }

-- A Message stream is a stream of messages that can be consumed
-- by a MessageCarrier
data MessageStream = MessageStream {
      next :: IO String,
      send :: String -> IO ()
    }

-- The message carrier takes data off a stream formats it into a message
-- passes them to a handler and then places the message returned by the handler
-- back in the stream for delivery.
type MessageCarrierLoop = MessageStream -> Handler -> IO ()

-- Handler takes messages and return new messages
type Handler = Message -> IO Message

type MessageFormatter = String -> Maybe Message


loads :: String -> Maybe Message
loads = undefined

dumps :: Message -> String
dumps = undefined

badMessage :: Message
badMessage = undefined

carrierLoop :: MessageCarrierLoop
carrierLoop stream handler = do
  incoming  <- next stream
  case loads incoming of
    Just message -> do 
      returnMessage <- handler message
      send stream (dumps returnMessage)
    Nothing -> do
      send stream (dumps badMessage)
  carrierLoop stream handler 



  
main = undefined

