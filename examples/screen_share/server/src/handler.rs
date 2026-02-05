use rsws::{Config, Connection, HandshakeRequest, HandshakeResponse, Message, Role};
use std::error::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::broadcast;

use crate::room::{RoomManager, RoomMessage};
use crate::types::{ClientMessage, ServerMessage};

pub async fn handle_connection(
    mut stream: TcpStream,
    room_manager: RoomManager,
    addr: std::net::SocketAddr,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let mut reader = BufReader::new(&mut stream);
    let mut request_bytes = Vec::new();

    loop {
        let mut line = String::new();
        reader.read_line(&mut line).await?;
        request_bytes.extend_from_slice(line.as_bytes());
        if line == "\r\n" {
            break;
        }
    }

    let request = HandshakeRequest::parse(&request_bytes)?;
    request.validate()?;

    let response = HandshakeResponse::from_request(&request);
    let mut response_bytes = Vec::new();
    let _ = response.write(&mut response_bytes);
    stream.write_all(&response_bytes).await?;

    println!("  [{}] Handshake complete", addr);

    let config = Config::server();
    let mut conn = Connection::new(stream, Role::Server, config);

    let mut username: Option<String> = None;
    let mut room_id: Option<String> = None;
    let mut rx: Option<broadcast::Receiver<RoomMessage>> = None;

    loop {
        tokio::select! {
            result = conn.recv() => {
                match result {
                    Ok(Some(Message::Text(text))) => {
                        if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                            match client_msg {
                                ClientMessage::Join { username: user, room_id: rid } => {
                                    println!("  [{}] User '{}' joining room '{}'", addr, user, rid);
                                    let room = room_manager.get_or_create_room(&rid).await;
                                    let (_, receiver) = room.add_user(user.clone()).await;

                                    let users = room.get_users().await;
                                    let joined_msg = ServerMessage::Joined {
                                        username: user.clone(),
                                        room_id: rid.clone(),
                                        users,
                                    };

                                    if let Ok(json) = serde_json::to_string(&joined_msg) {
                                        let _ = conn.send(Message::text(json)).await;
                                    }

                                    username = Some(user);
                                    room_id = Some(rid);
                                    rx = Some(receiver);
                                }
                                ClientMessage::StartSharing => {
                                    if let (Some(ref user), Some(ref rid)) = (&username, &room_id) {
                                        println!("  [{}] User '{}' started sharing", addr, user);
                                        let room = room_manager.get_or_create_room(rid).await;
                                        room.set_sharing(user, true).await;
                                    }
                                }
                                ClientMessage::StopSharing => {
                                    if let (Some(ref user), Some(ref rid)) = (&username, &room_id) {
                                        println!("  [{}] User '{}' stopped sharing", addr, user);
                                        let room = room_manager.get_or_create_room(rid).await;
                                        room.set_sharing(user, false).await;
                                    }
                                }
                                ClientMessage::Offer { to, sdp } => {
                                    if let (Some(ref from), Some(ref rid)) = (&username, &room_id) {
                                        let room = room_manager.get_or_create_room(rid).await;
                                        let msg = ServerMessage::Offer {
                                            from: from.clone(),
                                            sdp,
                                        };
                                        room.send_targeted(&to, msg).await;
                                    }
                                }
                                ClientMessage::Answer { to, sdp } => {
                                    if let (Some(ref from), Some(ref rid)) = (&username, &room_id) {
                                        let room = room_manager.get_or_create_room(rid).await;
                                        let msg = ServerMessage::Answer {
                                            from: from.clone(),
                                            sdp,
                                        };
                                        room.send_targeted(&to, msg).await;
                                    }
                                }
                                ClientMessage::IceCandidate { to, candidate } => {
                                    if let (Some(ref from), Some(ref rid)) = (&username, &room_id) {
                                        let room = room_manager.get_or_create_room(rid).await;
                                        let msg = ServerMessage::IceCandidate {
                                            from: from.clone(),
                                            candidate,
                                        };
                                        room.send_targeted(&to, msg).await;
                                    }
                                }
                                ClientMessage::RequestOffer { to } => {
                                    if let (Some(ref from), Some(ref rid)) = (&username, &room_id) {
                                        let room = room_manager.get_or_create_room(rid).await;
                                        let msg = ServerMessage::RequestOffer {
                                            from: from.clone(),
                                        };
                                        room.send_targeted(&to, msg).await;
                                    }
                                }
                            }
                        }
                    }
                    Ok(Some(Message::Close(_))) => {
                        println!("  [{}] Close frame received", addr);
                        break;
                    }
                    Ok(Some(_)) => {}
                    Ok(None) => {
                        println!("  [{}] Connection closed", addr);
                        break;
                    }
                    Err(e) => {
                        eprintln!("  [{}] Receive error: {}", addr, e);
                        break;
                    }
                }
            }
            result = async {
                match &mut rx {
                    Some(receiver) => receiver.recv().await,
                    None => std::future::pending().await,
                }
            } => {
                match result {
                    Ok(room_msg) => {
                        let should_send = match &room_msg {
                            RoomMessage::Broadcast(_) => true,
                            RoomMessage::Targeted { to, .. } => {
                                username.as_ref().map(|u| u == to).unwrap_or(false)
                            }
                        };

                        if should_send {
                            let msg = match room_msg {
                                RoomMessage::Broadcast(m) => m,
                                RoomMessage::Targeted { message, .. } => message,
                            };
                            if let Ok(json) = serde_json::to_string(&msg) {
                                if let Err(e) = conn.send(Message::text(json)).await {
                                    eprintln!("  [{}] Send error: {}", addr, e);
                                    break;
                                }
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        eprintln!("  [{}] Lagged {} messages", addr, n);
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        break;
                    }
                }
            }
        }
    }

    if let (Some(user), Some(rid)) = (username, room_id) {
        println!("  [{}] User '{}' leaving room '{}'", addr, user, rid);
        let room = room_manager.get_or_create_room(&rid).await;
        room.remove_user(&user).await;
        room_manager.cleanup_empty_room(&rid).await;
    }

    Ok(())
}
