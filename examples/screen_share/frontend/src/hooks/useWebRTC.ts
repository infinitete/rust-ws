import { useState, useRef, useCallback, useEffect } from 'react';
import { ClientMessage, ServerMessage, UserInfo } from '../types';

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

interface UseWebRTCProps {
  username: string;
  sendMessage: (msg: ClientMessage) => void;
}

export const useWebRTC = ({ username, sendMessage }: UseWebRTCProps) => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const usersRef = useRef<UserInfo[]>([]);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const sendMessageRef = useRef(sendMessage);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const flushPendingCandidates = useCallback(async (peerUsername: string, pc: RTCPeerConnection) => {
    const queued = pendingCandidatesRef.current.get(peerUsername) || [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error(`Failed to add queued ICE candidate for ${peerUsername}:`, e);
      }
    }
    pendingCandidatesRef.current.delete(peerUsername);
  }, []);

  const closePeer = useCallback((peerUsername: string) => {
    const pc = peersRef.current.get(peerUsername);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      peersRef.current.delete(peerUsername);
    }
    pendingCandidatesRef.current.delete(peerUsername);
    setRemoteStreams((prev) => {
      const newMap = new Map(prev);
      newMap.delete(peerUsername);
      return newMap;
    });
  }, []);

  const createPeerConnection = useCallback((peerUsername: string) => {
    if (peersRef.current.has(peerUsername)) {
      console.warn(`Peer connection for ${peerUsername} already exists, closing it.`);
      closePeer(peerUsername);
    }

    const pc = new RTCPeerConnection(STUN_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessageRef.current({
          type: 'ICE_CANDIDATE',
          to: peerUsername,
          candidate: JSON.stringify(event.candidate),
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received track from ${peerUsername}`);
      const [remoteStream] = event.streams;
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.set(peerUsername, remoteStream);
        return newMap;
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn(`Connection to ${peerUsername} ${pc.connectionState}`);
      }
    };

    peersRef.current.set(peerUsername, pc);
    return pc;
  }, [closePeer]);

  const handleServerMessage = useCallback(async (msg: ServerMessage) => {
    try {
      switch (msg.type) {
        case 'JOINED':
          setUsers(msg.users);
          {
            const sharingUsers = msg.users.filter(u => u.is_sharing && u.username !== username);
            for (const sharer of sharingUsers) {
              console.log(`Requesting offer from sharer: ${sharer.username}`);
              sendMessageRef.current({ type: 'REQUEST_OFFER', to: sharer.username });
            }
          }
          break;

        case 'USER_JOINED':
          setUsers(msg.users);
          if (localStreamRef.current) {
            const pc = createPeerConnection(msg.username);
            localStreamRef.current.getTracks().forEach(track => {
              if (localStreamRef.current) pc.addTrack(track, localStreamRef.current);
            });
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendMessageRef.current({
              type: 'OFFER',
              to: msg.username,
              sdp: JSON.stringify(offer),
            });
          }
          break;

        case 'USER_LEFT':
          setUsers(msg.users);
          closePeer(msg.username);
          break;

        case 'OFFER':
          {
            const sdp = JSON.parse(msg.sdp);
            const pc = createPeerConnection(msg.from);
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await flushPendingCandidates(msg.from, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendMessageRef.current({
              type: 'ANSWER',
              to: msg.from,
              sdp: JSON.stringify(answer),
            });
          }
          break;

        case 'ANSWER':
          {
            const pc = peersRef.current.get(msg.from);
            if (pc && pc.signalingState === 'have-local-offer') {
              const sdp = JSON.parse(msg.sdp);
              await pc.setRemoteDescription(new RTCSessionDescription(sdp));
              await flushPendingCandidates(msg.from, pc);
            }
          }
          break;

        case 'ICE_CANDIDATE':
          {
            const pc = peersRef.current.get(msg.from);
            const candidate = JSON.parse(msg.candidate);
            if (pc && pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              const queue = pendingCandidatesRef.current.get(msg.from) || [];
              queue.push(candidate);
              pendingCandidatesRef.current.set(msg.from, queue);
            }
          }
          break;

        case 'REQUEST_OFFER':
          if (localStreamRef.current) {
            console.log(`Received request for offer from: ${msg.from}`);
            const pc = createPeerConnection(msg.from);
            localStreamRef.current.getTracks().forEach(track => {
              if (localStreamRef.current) pc.addTrack(track, localStreamRef.current);
            });
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendMessageRef.current({
              type: 'OFFER',
              to: msg.from,
              sdp: JSON.stringify(offer),
            });
          }
          break;
          
        case 'SHARING_STARTED':
          setUsers(prev => prev.map(u => 
            u.username === msg.username ? { ...u, is_sharing: true } : u
          ));
          break;

        case 'SHARING_STOPPED':
          setUsers(prev => prev.map(u => 
            u.username === msg.username ? { ...u, is_sharing: false } : u
          ));
          closePeer(msg.username);
          break;
      }
    } catch (e) {
      console.error('Error handling signaling message:', msg.type, e);
    }
  }, [username, createPeerConnection, closePeer, flushPendingCandidates]);

  const startSharing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      setLocalStream(stream);
      localStreamRef.current = stream;
      
      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };

      sendMessageRef.current({ type: 'START_SHARING' });

      for (const user of usersRef.current) {
        if (user.username === username) continue;
        
        const pc = createPeerConnection(user.username);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendMessageRef.current({
          type: 'OFFER',
          to: user.username,
          sdp: JSON.stringify(offer),
        });
      }

    } catch (err) {
      console.error("Error starting screen share:", err);
    }
  }, [createPeerConnection, username]);

  const stopSharing = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      localStreamRef.current = null;
      sendMessageRef.current({ type: 'STOP_SHARING' });
      
      peersRef.current.forEach((pc) => {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      });
      peersRef.current.clear();
      pendingCandidatesRef.current.clear();
      setRemoteStreams(new Map());
    }
  }, []);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peersRef.current.forEach(pc => {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      });
    };
  }, []);

  return {
    users,
    localStream,
    remoteStreams,
    startSharing,
    stopSharing,
    handleServerMessage
  };
};
