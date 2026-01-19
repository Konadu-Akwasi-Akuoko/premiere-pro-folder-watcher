use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "cmd", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Command {
    AddWatch {
        path: String,
        id: String,
    },
    RemoveWatch {
        id: String,
    },
    ListWatches,
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Event {
    FileAdded {
        watch_id: String,
        path: String,
        relative: String,
    },
    DirAdded {
        watch_id: String,
        path: String,
        relative: String,
    },
    FileRemoved {
        watch_id: String,
        path: String,
        relative: String,
    },
    DirRemoved {
        watch_id: String,
        path: String,
        relative: String,
    },
    Ready {
        watch_id: String,
    },
    WatchList {
        watches: Vec<WatchInfo>,
    },
    Error {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        watch_id: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchInfo {
    pub id: String,
    pub path: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_add_watch_command() {
        let cmd = Command::AddWatch {
            path: "/test/path".to_string(),
            id: "watch-1".to_string(),
        };
        let json = serde_json::to_string(&cmd).unwrap();
        assert!(json.contains("\"cmd\":\"ADD_WATCH\""));
        assert!(json.contains("\"path\":\"/test/path\""));
        assert!(json.contains("\"id\":\"watch-1\""));
    }

    #[test]
    fn test_deserialize_add_watch_command() {
        let json = r#"{"cmd":"ADD_WATCH","path":"/test/path","id":"watch-1"}"#;
        let cmd: Command = serde_json::from_str(json).unwrap();
        match cmd {
            Command::AddWatch { path, id } => {
                assert_eq!(path, "/test/path");
                assert_eq!(id, "watch-1");
            }
            _ => panic!("Expected AddWatch command"),
        }
    }

    #[test]
    fn test_serialize_file_added_event() {
        let event = Event::FileAdded {
            watch_id: "watch-1".to_string(),
            path: "/full/path/file.mp4".to_string(),
            relative: "file.mp4".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"event\":\"FILE_ADDED\""));
        assert!(json.contains("\"watch_id\":\"watch-1\""));
    }

    #[test]
    fn test_serialize_error_without_watch_id() {
        let event = Event::Error {
            message: "Something went wrong".to_string(),
            watch_id: None,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(!json.contains("watch_id"));
    }

    #[test]
    fn test_serialize_error_with_watch_id() {
        let event = Event::Error {
            message: "Permission denied".to_string(),
            watch_id: Some("watch-1".to_string()),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"watch_id\":\"watch-1\""));
    }
}
