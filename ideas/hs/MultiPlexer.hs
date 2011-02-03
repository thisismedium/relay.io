{-# LANGUAGE CPP, OverloadedStrings #-}
import Control.Concurrent.Chan
import Control.Concurrent 
import Control.Monad (forever)
import Control.Monad.State
import Data.Binary.Get
import Data.Binary.Put
import Data.Bits
import Data.ByteString.Internal (c2w)
import Data.ByteString as BS hiding (map, filter, foldl', foldl, putStrLn)
import Data.Word
import Debug.Trace
import Network (listenOn, withSocketsDo, accept, PortID(..), Socket)
import System (getArgs)
import System.IO (hSetBuffering, hGetLine, hPutStrLn, BufferMode(..), Handle)
import Data.Maybe

import qualified Data.ByteString.Lazy as BL hiding (map)
import qualified Data.List (take, drop, foldl)
import qualified Data.Map as M

type ChannelId = Int
data MultiPlexMessage = Mesg [ChannelId] BS.ByteString
                      | End [ChannelId]
                      deriving (Show, Read)
                        
data ChannelObject = CO {
  channelId  :: ChannelId,
  inputPipe  :: Chan Message,
  outputPipe :: Chan MultiPlexMessage
} 
                     
data Message = Message BS.ByteString
             | EOF
             deriving (Show, Read)

#define MODE_MESG 1
#define MODE_END  2

withMultiSockServer port onChannel = do
  sock <- listenOn (PortNumber port)
  forever $ do 
    (handle,_,_) <- accept sock
    hSetBuffering handle NoBuffering
    outPipe <- newChan
    forkIO $ do
      dispatchChannels handle outPipe (M.empty :: M.Map ChannelId ChannelObject)
    forkIO $ forever $ do
      mesg <- readChan outPipe
      BL.hPut handle $ runPut (makeMesg mesg)
      
  where 
    dispatchChannels handle outPipe channels = do
      mesg <- runReader handle 
      case mesg of
        Mesg chans mesg -> do
          let missing = filter (\x-> isNothing (M.lookup x channels)) chans
          nchans <- forM missing $ \m-> do
            pipe <- newChan
            let chan = CO m pipe outPipe
            forkIO $ onChannel chan
            return (m, chan)
          let channels' = M.union channels (M.fromList nchans)
          forM chans $ \chan -> do
            let chan' = M.lookup chan channels'
            case chan' of 
              Just ch -> writeChan (inputPipe ch) (Message mesg)
              Nothing   -> return ()
          dispatchChannels handle outPipe channels'
        End chans -> do
          forM chans $ \chan -> do
            let chan' = M.lookup chan channels
            case chan' of 
              Just ch -> writeChan (inputPipe ch) EOF
              Nothing -> return ()
          dispatchChannels handle outPipe (foldl (\a b-> M.delete b a) channels chans)
          
          
    runReader handle = do
      bs <- BL.hGetContents handle
      return $ runGet modeReader bs
    
    modeReader = do
      mode <- getWord8
      trace ("Mode reader: " ++ (show mode)) $ case mode of
        MODE_MESG -> mesgReader
        MODE_END  -> endReader
        _         -> error $ "Invalid Mode: " ++ (show mode)

    mesgReader = do
      nOfChannels <- getWord16be
      mesgLength  <- getWord16be
      channels    <- forM [1..nOfChannels] $ const getWord32be
      message     <- trace ("Channels: " ++ show channels) $ getByteString (fromIntegral mesgLength)
      return $ Mesg (map fromIntegral channels) message
    
    endReader = do
      chan <- getWord16be >>= return . fromIntegral
      return $ End [chan]
      
    makeMesg (Mesg channels content) = do
      putWord8 (fromIntegral MODE_MESG)
      putWord16be (fromIntegral $ Prelude.length channels)
      putWord16be (fromIntegral $ BS.length content)
      forM channels $ \chan -> putWord32be (fromIntegral chan)
      putByteString content
      
    makeMesg (End channels) = do
      putWord8 (fromIntegral MODE_MESG)
      forM channels $ \chan -> putWord32be (fromIntegral chan)
      return ()
      
w2int :: Int -> [Int] -> Int
w2int n (x:xs) = let n' = n `shift` 8 
                 in w2int (x .|. n') xs
w2int n []     = n

chunkInto n [] = []
chunkInto n list = Data.List.take n list : chunkInto n (Data.List.drop n list)

readMessage chan = readChan (inputPipe chan)
writeMessage chan mesg = do
  writeChan (outputPipe chan) (Mesg [(channelId chan)] (BS.pack $ map c2w mesg))

main = do
  withMultiSockServer 8124 $ \chan-> do 
    putStrLn "Starting Channel"
    forever $ do
      mesg <- readMessage chan
      case mesg of 
        Message m -> do
          print $ "Message is " ++ (show m)
          writeMessage chan ("Got your message, Thanks!")
        EOF -> do 
          putStrLn "END"
          myThreadId >>= killThread        

    