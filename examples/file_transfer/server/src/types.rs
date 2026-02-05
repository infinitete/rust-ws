use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ClientMessage {
    Join {
        username: String,
    },
    FileOffer {
        to: String,
        file_id: String,
        filename: String,
        size: u64,
        chunk_size: u32,
        checksum: String,
    },
    FileAccept {
        from: String,
        file_id: String,
    },
    FileReject {
        from: String,
        file_id: String,
    },
    FileChunkAck {
        file_id: String,
        chunk_index: u32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ServerMessage {
    ServerConfig {
        max_file_size: u64,
        chunk_size: u32,
    },
    UserJoined {
        username: String,
        users: Vec<String>,
    },
    UserLeft {
        username: String,
        users: Vec<String>,
    },
    FileOfferReceived {
        from: String,
        file_id: String,
        filename: String,
        size: u64,
        checksum: String,
    },
    FileAccepted {
        file_id: String,
        to: String,
    },
    FileRejected {
        file_id: String,
    },
    FileChunkAck {
        file_id: String,
        chunk_index: u32,
    },
    FileComplete {
        file_id: String,
    },
    FileError {
        file_id: String,
        error: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone)]
pub struct FileTransfer {
    pub file_id: String,
    pub from: String,
    pub to: String,
    #[allow(dead_code)]
    pub filename: String,
    #[allow(dead_code)]
    pub size: u64,
    #[allow(dead_code)]
    pub chunk_size: u32,
    pub chunks_received: u32,
    pub total_chunks: u32,
}

impl FileTransfer {
    pub fn new(
        file_id: String,
        from: String,
        to: String,
        filename: String,
        size: u64,
        chunk_size: u32,
    ) -> Self {
        let total_chunks = ((size as f64) / (chunk_size as f64)).ceil() as u32;
        Self {
            file_id,
            from,
            to,
            filename,
            size,
            chunk_size,
            chunks_received: 0,
            total_chunks,
        }
    }

    pub fn is_complete(&self) -> bool {
        self.chunks_received >= self.total_chunks
    }
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct Client {
    pub username: String,
    pub addr: SocketAddr,
}
