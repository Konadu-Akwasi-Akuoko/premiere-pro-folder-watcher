use clap::Parser;
use folder_watcher::server::Server;
use log::info;

#[derive(Parser, Debug)]
#[command(name = "folder-watcher")]
#[command(about = "File system watcher for Premiere Pro folder watching plugin")]
#[command(version)]
struct Args {
    #[arg(short, long, default_value_t = 9847)]
    port: u16,

    #[arg(short, long, default_value_t = 500)]
    debounce_ms: u64,
}

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let args = Args::parse();

    info!(
        "Starting folder-watcher on port {} with {}ms debounce",
        args.port, args.debounce_ms
    );

    let server = Server::new(args.port, args.debounce_ms);

    if let Err(e) = server.run() {
        log::error!("Server error: {}", e);
        std::process::exit(1);
    }
}
