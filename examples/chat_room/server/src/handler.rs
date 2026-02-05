use rsws::{Config, Connection, HandshakeRequest, HandshakeResponse, Message, Role};
use std::error::Error;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

use crate::room::ChatRoom;
use crate::types::{ClientMessage, ServerMessage};

pub async fn handle_connection(
    mut stream: TcpStream,
    room: ChatRoom,
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
    let mut rx = room.subscribe();

    loop {
        tokio::select! {
            result = conn.recv() => {
                match result {
                    Ok(Some(Message::Text(text))) => {
                        if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                            match client_msg {
                                ClientMessage::Join { username: user } => {
                                    println!("  [{}] User '{}' joining", addr, user);
                                    username = Some(user.clone());
                                    let _msg = room.add_user(user).await;
                                }
                                ClientMessage::Chat { content } => {
                                    if let Some(ref user) = username {
                                        let timestamp = SystemTime::now()
                                            .duration_since(UNIX_EPOCH)
                                            .unwrap()
                                            .as_secs()
                                            .to_string();
                                        let msg = ServerMessage::Chat {
                                            username: user.clone(),
                                            content,
                                            timestamp,
                                        };
                                        room.broadcast(msg);
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
            result = rx.recv() => {
                match result {
                    Ok(msg) => {
                        if let Ok(json) = serde_json::to_string(&msg) {
                            if let Err(e) = conn.send(Message::text(json)).await {
                                eprintln!("  [{}] Send error: {}", addr, e);
                                break;
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

    if let Some(user) = username {
        println!("  [{}] User '{}' leaving", addr, user);
        room.remove_user(&user).await;
    }

    Ok(())
}

use tokio::sync::broadcast;
