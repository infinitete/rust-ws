use serde::{Deserialize, Serialize};

/// Messages sent from client to server
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ClientMessage {
    /// Join a room with username
    Join { username: String, room_id: String },
    /// Start sharing screen
    StartSharing,
    /// Stop sharing screen
    StopSharing,
    /// Request an offer from a sharer (new user asking for stream)
    RequestOffer { to: String },
    /// WebRTC SDP Offer (targeted to specific peer)
    Offer { to: String, sdp: String },
    /// WebRTC SDP Answer (targeted to specific peer)
    Answer { to: String, sdp: String },
    /// ICE Candidate (targeted to specific peer)
    IceCandidate { to: String, candidate: String },
}

/// Messages sent from server to client
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ServerMessage {
    /// Confirmation of successful join with current room state
    Joined {
        username: String,
        room_id: String,
        users: Vec<UserInfo>,
    },
    /// A new user joined the room
    UserJoined {
        username: String,
        users: Vec<UserInfo>,
    },
    /// A user left the room
    UserLeft {
        username: String,
        users: Vec<UserInfo>,
    },
    /// A user started sharing their screen
    SharingStarted { username: String },
    /// A user stopped sharing their screen
    SharingStopped { username: String },
    /// Request to send an offer to a new user
    RequestOffer { from: String },
    /// WebRTC SDP Offer from another peer
    Offer { from: String, sdp: String },
    /// WebRTC SDP Answer from another peer
    Answer { from: String, sdp: String },
    /// ICE Candidate from another peer
    IceCandidate { from: String, candidate: String },
    /// Error message
    Error { message: String },
}

/// Information about a user in the room
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UserInfo {
    pub username: String,
    pub is_sharing: bool,
}
