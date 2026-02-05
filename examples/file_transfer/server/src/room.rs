use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, RwLock};

use crate::types::{Client, FileTransfer, ServerMessage};

/// Message type for routing binary data and signaling to specific users
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum RoomMessage {
    /// Signaling message (broadcast or targeted)
    Signal(ServerMessage),
    /// Binary chunk to forward to a specific user
    Binary { to: String, data: Vec<u8> },
    /// Acknowledgment to forward to sender
    Ack {
        to: String,
        file_id: String,
        chunk_index: u32,
    },
}

#[derive(Clone)]
pub struct TransferRoom {
    users: Arc<RwLock<HashMap<String, Client>>>,
    transfers: Arc<RwLock<HashMap<String, FileTransfer>>>,
    /// Maps username to their binary message sender
    binary_senders: Arc<RwLock<HashMap<String, mpsc::Sender<Vec<u8>>>>>,
    /// Maps username to their signaling message sender
    signal_senders: Arc<RwLock<HashMap<String, mpsc::Sender<ServerMessage>>>>,
    tx: broadcast::Sender<ServerMessage>,
}

impl TransferRoom {
    pub fn new(capacity: usize) -> Self {
        let (tx, _rx) = broadcast::channel(capacity);
        Self {
            users: Arc::new(RwLock::new(HashMap::new())),
            transfers: Arc::new(RwLock::new(HashMap::new())),
            binary_senders: Arc::new(RwLock::new(HashMap::new())),
            signal_senders: Arc::new(RwLock::new(HashMap::new())),
            tx,
        }
    }

    pub async fn add_user(&self, username: String, addr: SocketAddr) -> ServerMessage {
        let mut users = self.users.write().await;
        users.insert(
            username.clone(),
            Client {
                username: username.clone(),
                addr,
            },
        );
        let users_vec: Vec<String> = users.keys().cloned().collect();
        drop(users);

        let msg = ServerMessage::UserJoined {
            username,
            users: users_vec,
        };
        let _ = self.tx.send(msg.clone());
        msg
    }

    pub async fn remove_user(&self, username: &str) -> ServerMessage {
        let mut users = self.users.write().await;
        users.remove(username);
        let users_vec: Vec<String> = users.keys().cloned().collect();
        drop(users);

        // Clean up senders
        {
            let mut binary_senders = self.binary_senders.write().await;
            binary_senders.remove(username);
        }
        {
            let mut signal_senders = self.signal_senders.write().await;
            signal_senders.remove(username);
        }

        let msg = ServerMessage::UserLeft {
            username: username.to_string(),
            users: users_vec,
        };
        let _ = self.tx.send(msg.clone());
        msg
    }

    pub async fn register_binary_sender(&self, username: &str, tx: mpsc::Sender<Vec<u8>>) {
        let mut senders = self.binary_senders.write().await;
        senders.insert(username.to_string(), tx);
    }

    pub async fn register_signal_sender(&self, username: &str, tx: mpsc::Sender<ServerMessage>) {
        let mut senders = self.signal_senders.write().await;
        senders.insert(username.to_string(), tx);
    }

    pub async fn send_binary_to_user(&self, username: &str, data: Vec<u8>) -> bool {
        let senders = self.binary_senders.read().await;
        if let Some(tx) = senders.get(username) {
            tx.send(data).await.is_ok()
        } else {
            false
        }
    }

    pub async fn send_signal_to_user(&self, username: &str, msg: ServerMessage) -> bool {
        let senders = self.signal_senders.read().await;
        if let Some(tx) = senders.get(username) {
            tx.send(msg).await.is_ok()
        } else {
            false
        }
    }

    pub async fn user_exists(&self, username: &str) -> bool {
        let users = self.users.read().await;
        users.contains_key(username)
    }

    pub async fn create_transfer(&self, transfer: FileTransfer) -> Result<(), String> {
        let mut transfers = self.transfers.write().await;
        if transfers.contains_key(&transfer.file_id) {
            return Err("Transfer already exists".to_string());
        }
        transfers.insert(transfer.file_id.clone(), transfer);
        Ok(())
    }

    pub async fn get_transfer(&self, file_id: &str) -> Option<FileTransfer> {
        let transfers = self.transfers.read().await;
        transfers.get(file_id).cloned()
    }

    pub async fn record_chunk(&self, file_id: &str) -> Result<bool, String> {
        let mut transfers = self.transfers.write().await;
        if let Some(transfer) = transfers.get_mut(file_id) {
            transfer.chunks_received += 1;
            Ok(transfer.is_complete())
        } else {
            Err("Transfer not found".to_string())
        }
    }

    pub async fn cleanup_transfer(&self, file_id: &str) {
        let mut transfers = self.transfers.write().await;
        transfers.remove(file_id);
    }

    #[allow(dead_code)]
    pub fn broadcast(&self, msg: ServerMessage) {
        let _ = self.tx.send(msg);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ServerMessage> {
        self.tx.subscribe()
    }
}
