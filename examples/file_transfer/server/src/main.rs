mod handler;
mod room;
mod types;

use clap::Parser;
use room::TransferRoom;
use tokio::net::TcpListener;

#[derive(Parser, Debug)]
#[command(name = "file_transfer_server")]
#[command(about = "WebSocket file transfer server", long_about = None)]
struct Args {
    #[arg(long, default_value = "127.0.0.1")]
    host: String,

    #[arg(short, long, default_value_t = 8081)]
    port: u16,

    #[arg(long, default_value_t = 500)]
    max_file_mb: u64,

    #[arg(long, default_value_t = 64)]
    chunk_kb: u32,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    let addr = format!("{}:{}", args.host, args.port);
    let max_file_size = args.max_file_mb * 1024 * 1024;
    let chunk_size = args.chunk_kb * 1024;

    println!("🚀 File transfer server starting on ws://{}", addr);
    println!("   Max file size: {} MB", args.max_file_mb);
    println!("   Chunk size: {} KB", args.chunk_kb);

    let room = TransferRoom::new(256);
    let listener = TcpListener::bind(&addr).await?;

    println!("✅ Server ready, waiting for connections...");

    loop {
        let (stream, addr) = listener.accept().await?;
        println!("📱 New connection from {}", addr);

        let room = room.clone();
        tokio::spawn(async move {
            if let Err(e) =
                handler::handle_connection(stream, room, addr, max_file_size, chunk_size).await
            {
                eprintln!("❌ [{}] Connection error: {}", addr, e);
            }
            println!("👋 [{}] Disconnected", addr);
        });
    }
}
