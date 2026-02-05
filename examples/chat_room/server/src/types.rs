use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ClientMessage {
    Join { username: String },
    Chat { content: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ServerMessage {
    UserJoined {
        username: String,
        users: Vec<String>,
    },
    UserLeft {
        username: String,
        users: Vec<String>,
    },
    Chat {
        username: String,
        content: String,
        timestamp: String,
    },
    Error {
        message: String,
    },
}
