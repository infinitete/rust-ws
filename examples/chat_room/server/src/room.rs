use crate::types::ServerMessage;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

#[derive(Clone)]
pub struct ChatRoom {
    users: Arc<RwLock<Vec<String>>>,
    tx: broadcast::Sender<ServerMessage>,
}

impl ChatRoom {
    pub fn new(capacity: usize) -> Self {
        let (tx, _rx) = broadcast::channel(capacity);
        Self {
            users: Arc::new(RwLock::new(Vec::new())),
            tx,
        }
    }

    pub async fn add_user(&self, username: String) -> ServerMessage {
        let mut users = self.users.write().await;
        if !users.contains(&username) {
            users.push(username.clone());
        }
        let users_vec = users.clone();
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
        users.retain(|u| u != username);
        let users_vec = users.clone();
        drop(users);

        let msg = ServerMessage::UserLeft {
            username: username.to_string(),
            users: users_vec,
        };
        let _ = self.tx.send(msg.clone());
        msg
    }

    pub fn broadcast(&self, msg: ServerMessage) {
        let _ = self.tx.send(msg);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ServerMessage> {
        self.tx.subscribe()
    }
}
