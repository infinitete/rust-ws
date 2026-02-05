use rsws::{Config, Connection, HandshakeRequest, HandshakeResponse, Message, Role};
use std::error::Error;
use std::net::SocketAddr;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::{broadcast, mpsc};

use crate::room::TransferRoom;
use crate::types::{ClientMessage, FileTransfer, ServerMessage};

pub async fn handle_connection(
    mut stream: TcpStream,
    room: TransferRoom,
    addr: SocketAddr,
    max_file_size: u64,
    chunk_size: u32,
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
    let mut broadcast_rx = room.subscribe();

    let (binary_tx, mut binary_rx) = mpsc::channel::<Vec<u8>>(64);
    let (signal_tx, mut signal_rx) = mpsc::channel::<ServerMessage>(64);

    loop {
        tokio::select! {
            result = conn.recv() => {
                match result {
                    Ok(Some(Message::Text(text))) => {
                        if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                            if let Some(user) = handle_client_message(
                                client_msg,
                                &room,
                                &username,
                                addr,
                                &binary_tx,
                                &signal_tx,
                                max_file_size,
                                chunk_size,
                            ).await {
                                username = Some(user);
                            }
                        } else {
                            eprintln!("  [{}] Failed to parse message: {}", addr, text);
                        }
                    }
                    Ok(Some(Message::Binary(data))) => {
                        if let Some(ref user) = username {
                            if let Err(e) = handle_binary_chunk(user, data, &room, addr).await {
                                eprintln!("  [{}] Binary chunk error: {}", addr, e);
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
            result = broadcast_rx.recv() => {
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
            Some(data) = binary_rx.recv() => {
                if let Err(e) = conn.send(Message::binary(data)).await {
                    eprintln!("  [{}] Binary send error: {}", addr, e);
                    break;
                }
            }
            Some(msg) = signal_rx.recv() => {
                if let Ok(json) = serde_json::to_string(&msg) {
                    if let Err(e) = conn.send(Message::text(json)).await {
                        eprintln!("  [{}] Signal send error: {}", addr, e);
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

#[allow(clippy::too_many_arguments)]
async fn handle_client_message(
    msg: ClientMessage,
    room: &TransferRoom,
    username: &Option<String>,
    addr: SocketAddr,
    binary_tx: &mpsc::Sender<Vec<u8>>,
    signal_tx: &mpsc::Sender<ServerMessage>,
    max_file_size: u64,
    chunk_size: u32,
) -> Option<String> {
    match msg {
        ClientMessage::Join { username: user } => {
            println!("  [{}] User '{}' joining", addr, user);
            room.register_binary_sender(&user, binary_tx.clone()).await;
            room.register_signal_sender(&user, signal_tx.clone()).await;

            let config_msg = ServerMessage::ServerConfig {
                max_file_size,
                chunk_size,
            };
            let _ = signal_tx.send(config_msg).await;

            room.add_user(user.clone(), addr).await;
            Some(user)
        }
        ClientMessage::FileOffer {
            to,
            file_id,
            filename,
            size,
            chunk_size,
            checksum,
        } => {
            if let Some(ref from) = username {
                println!(
                    "  [{}] File offer: {} -> {} ({}, {} bytes, sha256: {})",
                    addr,
                    from,
                    to,
                    filename,
                    size,
                    &checksum[..16]
                );

                if size > max_file_size {
                    let msg = ServerMessage::FileError {
                        file_id: file_id.clone(),
                        error: format!("File too large: {} bytes (max: {})", size, max_file_size),
                    };
                    room.send_signal_to_user(from, msg).await;
                    return None;
                }

                if !room.user_exists(&to).await {
                    let msg = ServerMessage::FileError {
                        file_id: file_id.clone(),
                        error: format!("User '{}' not found", to),
                    };
                    room.send_signal_to_user(from, msg).await;
                    return None;
                }

                let transfer = FileTransfer::new(
                    file_id.clone(),
                    from.clone(),
                    to.clone(),
                    filename.clone(),
                    size,
                    chunk_size,
                );

                if let Err(e) = room.create_transfer(transfer).await {
                    let msg = ServerMessage::FileError {
                        file_id: file_id.clone(),
                        error: e,
                    };
                    room.send_signal_to_user(from, msg).await;
                    return None;
                }

                let offer_msg = ServerMessage::FileOfferReceived {
                    from: from.clone(),
                    file_id,
                    filename,
                    size,
                    checksum,
                };
                room.send_signal_to_user(&to, offer_msg).await;
            }
            None
        }
        ClientMessage::FileAccept { from, file_id } => {
            if let Some(ref to) = username {
                println!("  [{}] File accepted: {} <- {}", addr, to, from);
                let msg = ServerMessage::FileAccepted {
                    file_id,
                    to: to.clone(),
                };
                room.send_signal_to_user(&from, msg).await;
            }
            None
        }
        ClientMessage::FileReject { from, file_id } => {
            if let Some(ref _to) = username {
                println!("  [{}] File rejected: {}", addr, file_id);
                let msg = ServerMessage::FileRejected {
                    file_id: file_id.clone(),
                };
                room.send_signal_to_user(&from, msg).await;
                room.cleanup_transfer(&file_id).await;
            }
            None
        }
        ClientMessage::FileChunkAck {
            file_id,
            chunk_index,
        } => {
            if let Some(transfer) = room.get_transfer(&file_id).await {
                let ack_msg = ServerMessage::FileChunkAck {
                    file_id,
                    chunk_index,
                };
                room.send_signal_to_user(&transfer.from, ack_msg).await;
            }
            None
        }
    }
}

async fn handle_binary_chunk(
    sender: &str,
    data: Vec<u8>,
    room: &TransferRoom,
    addr: SocketAddr,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    if data.len() < 20 {
        return Err("Binary chunk too short (minimum 20 bytes)".into());
    }

    let file_id_bytes = &data[0..16];
    let hex: String = file_id_bytes.iter().map(|b| format!("{:02x}", b)).collect();
    let file_id = format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    );

    if let Some(transfer) = room.get_transfer(&file_id).await {
        if transfer.from != sender {
            return Err("Unauthorized sender for transfer".into());
        }

        let is_complete = room.record_chunk(&file_id).await?;

        println!(
            "  [{}] Chunk for {} -> {} ({}/{})",
            addr,
            file_id,
            transfer.to,
            transfer.chunks_received + 1,
            transfer.total_chunks
        );

        room.send_binary_to_user(&transfer.to, data).await;

        if is_complete {
            println!("  [{}] Transfer complete: {}", addr, file_id);
            let complete_msg = ServerMessage::FileComplete {
                file_id: file_id.clone(),
            };
            room.send_signal_to_user(&transfer.from, complete_msg.clone())
                .await;
            room.send_signal_to_user(&transfer.to, complete_msg).await;
            room.cleanup_transfer(&file_id).await;
        }
    } else {
        return Err(format!("Transfer not found: {}", file_id).into());
    }

    Ok(())
}
