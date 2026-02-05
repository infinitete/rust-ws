mod handler;
mod room;
mod types;

use room::RoomManager;
use tokio::net::TcpListener;

const ADDR: &str = "127.0.0.1:8080";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🖥️  Screen Share server starting on ws://{}", ADDR);

    let room_manager = RoomManager::new(256);
    let listener = TcpListener::bind(ADDR).await?;

    println!("✅ Server ready, waiting for connections...");

    loop {
        let (stream, addr) = listener.accept().await?;
        println!("📱 New connection from {}", addr);

        let room_manager = room_manager.clone();
        tokio::spawn(async move {
            if let Err(e) = handler::handle_connection(stream, room_manager, addr).await {
                eprintln!("❌ [{}] Connection error: {}", addr, e);
            }
            println!("👋 [{}] Disconnected", addr);
        });
    }
}
