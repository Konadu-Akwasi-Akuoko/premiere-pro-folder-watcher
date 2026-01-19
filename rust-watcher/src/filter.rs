use std::path::Path;

const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mov", "avi", "mkv", "wmv", "flv", "webm", "m4v", "mpg", "mpeg", "mxf", "r3d", "braw",
    "ari",
];

const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "wav", "aac", "flac", "ogg", "m4a", "aiff", "aif", "wma",
];

const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "psd", "ai", "eps", "webp", "exr", "dpx",
    "tga", "raw", "cr2",
];

const PROJECT_EXTENSIONS: &[&str] = &["prproj", "mogrt", "xml", "aaf", "edl"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MediaType {
    Video,
    Audio,
    Image,
    Project,
}

pub fn get_media_type(path: &Path) -> Option<MediaType> {
    let extension = path.extension()?.to_str()?.to_lowercase();
    let ext = extension.as_str();

    if VIDEO_EXTENSIONS.contains(&ext) {
        Some(MediaType::Video)
    } else if AUDIO_EXTENSIONS.contains(&ext) {
        Some(MediaType::Audio)
    } else if IMAGE_EXTENSIONS.contains(&ext) {
        Some(MediaType::Image)
    } else if PROJECT_EXTENSIONS.contains(&ext) {
        Some(MediaType::Project)
    } else {
        None
    }
}

pub fn is_media_file(path: &Path) -> bool {
    get_media_type(path).is_some()
}

pub fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.starts_with('.'))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_video_extensions() {
        assert_eq!(
            get_media_type(Path::new("test.mp4")),
            Some(MediaType::Video)
        );
        assert_eq!(
            get_media_type(Path::new("test.MOV")),
            Some(MediaType::Video)
        );
        assert_eq!(
            get_media_type(Path::new("test.mxf")),
            Some(MediaType::Video)
        );
    }

    #[test]
    fn test_audio_extensions() {
        assert_eq!(
            get_media_type(Path::new("test.mp3")),
            Some(MediaType::Audio)
        );
        assert_eq!(
            get_media_type(Path::new("test.WAV")),
            Some(MediaType::Audio)
        );
    }

    #[test]
    fn test_image_extensions() {
        assert_eq!(
            get_media_type(Path::new("test.jpg")),
            Some(MediaType::Image)
        );
        assert_eq!(
            get_media_type(Path::new("test.PNG")),
            Some(MediaType::Image)
        );
        assert_eq!(get_media_type(Path::new("test.psd")), Some(MediaType::Image));
    }

    #[test]
    fn test_project_extensions() {
        assert_eq!(
            get_media_type(Path::new("test.prproj")),
            Some(MediaType::Project)
        );
        assert_eq!(
            get_media_type(Path::new("test.mogrt")),
            Some(MediaType::Project)
        );
    }

    #[test]
    fn test_non_media_files() {
        assert_eq!(get_media_type(Path::new("test.txt")), None);
        assert_eq!(get_media_type(Path::new("test.rs")), None);
        assert_eq!(get_media_type(Path::new("test")), None);
    }

    #[test]
    fn test_is_media_file() {
        assert!(is_media_file(Path::new("video.mp4")));
        assert!(!is_media_file(Path::new("document.txt")));
    }

    #[test]
    fn test_is_hidden() {
        assert!(is_hidden(Path::new(".hidden")));
        assert!(is_hidden(Path::new(".DS_Store")));
        assert!(!is_hidden(Path::new("visible.mp4")));
    }
}
