use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

use crate::types::{ServerMessage, UserInfo};

#[derive(Debug, Clone)]
pub enum RoomMessage {
    Broadcast(ServerMessage),
    Targeted { to: String, message: ServerMessage },
}

struct RoomInner {
    users: HashMap<String, UserInfo>,
    tx: broadcast::Sender<RoomMessage>,
}

#[derive(Clone)]
pub struct Room {
    inner: Arc<RwLock<RoomInner>>,
}

impl Room {
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity);
        Self {
            inner: Arc::new(RwLock::new(RoomInner {
                users: HashMap::new(),
                tx,
            })),
        }
    }

    pub async fn add_user(&self, username: String) -> (ServerMessage, broadcast::Receiver<RoomMessage>) {
        let mut inner = self.inner.write().await;
        let user_info = UserInfo {
            username: username.clone(),
            is_sharing: false,
        };
        inner.users.insert(username.clone(), user_info);
        let users: Vec<UserInfo> = inner.users.values().cloned().collect();
        let rx = inner.tx.subscribe();

        let msg = ServerMessage::UserJoined {
            username,
            users,
        };
        let _ = inner.tx.send(RoomMessage::Broadcast(msg.clone()));
        (msg, rx)
    }

    pub async fn remove_user(&self, username: &str) -> ServerMessage {
        let mut inner = self.inner.write().await;
        inner.users.remove(username);
        let users: Vec<UserInfo> = inner.users.values().cloned().collect();

        let msg = ServerMessage::UserLeft {
            username: username.to_string(),
            users,
        };
        let _ = inner.tx.send(RoomMessage::Broadcast(msg.clone()));
        msg
    }

    pub async fn set_sharing(&self, username: &str, is_sharing: bool) -> Option<ServerMessage> {
        let mut inner = self.inner.write().await;
        if let Some(user) = inner.users.get_mut(username) {
            user.is_sharing = is_sharing;
            let msg = if is_sharing {
                ServerMessage::SharingStarted {
                    username: username.to_string(),
                }
            } else {
                ServerMessage::SharingStopped {
                    username: username.to_string(),
                }
            };
            let _ = inner.tx.send(RoomMessage::Broadcast(msg.clone()));
            Some(msg)
        } else {
            None
        }
    }

    pub async fn send_targeted(&self, to: &str, message: ServerMessage) {
        let inner = self.inner.read().await;
        let _ = inner.tx.send(RoomMessage::Targeted {
            to: to.to_string(),
            message,
        });
    }

    pub async fn get_users(&self) -> Vec<UserInfo> {
        let inner = self.inner.read().await;
        inner.users.values().cloned().collect()
    }
}

#[derive(Clone)]
pub struct RoomManager {
    rooms: Arc<RwLock<HashMap<String, Room>>>,
    capacity: usize,
}

impl RoomManager {
    pub fn new(capacity: usize) -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
            capacity,
        }
    }

    pub async fn get_or_create_room(&self, room_id: &str) -> Room {
        let mut rooms = self.rooms.write().await;
        rooms
            .entry(room_id.to_string())
            .or_insert_with(|| Room::new(self.capacity))
            .clone()
    }

    pub async fn cleanup_empty_room(&self, room_id: &str) {
        let mut rooms = self.rooms.write().await;
        if let Some(room) = rooms.get(room_id) {
            if room.get_users().await.is_empty() {
                rooms.remove(room_id);
            }
        }
    }
}
