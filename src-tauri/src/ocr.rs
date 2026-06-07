// Windows.Media.Ocr integration for screen text extraction.
// Falls back to empty text on non-Windows platforms so the build still succeeds.

#[cfg(windows)]
pub fn ocr_rgba(width: u32, height: u32, rgba: &[u8]) -> Result<String, String> {
    use windows::Globalization::Language;
    use windows::Graphics::Imaging::{BitmapDecoder, BitmapEncoder};
    use windows::Media::Ocr::OcrEngine;
    use windows::Storage::Streams::InMemoryRandomAccessStream;

    // Encode the raw RGBA buffer into an in-memory PNG so BitmapDecoder can consume it.
    let stream = InMemoryRandomAccessStream::new().map_err(|e| e.to_string())?;
    let encoder = BitmapEncoder::CreateAsync(BitmapEncoder::PngEncoderId().map_err(|e| e.to_string())?, &stream)
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    encoder
        .SetPixelData(
            windows::Graphics::Imaging::BitmapPixelFormat::Rgba8,
            windows::Graphics::Imaging::BitmapAlphaMode::Premultiplied,
            width,
            height,
            96.0,
            96.0,
            rgba,
        )
        .map_err(|e| e.to_string())?;
    encoder.FlushAsync().map_err(|e| e.to_string())?.get().map_err(|e| e.to_string())?;

    // Rewind the stream and decode it back as a SoftwareBitmap for OCR.
    stream.Seek(0u64).map_err(|e| e.to_string())?;
    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;
    let software_bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    // Prefer the user's preferred language but fall back to en-US.
    let engine = match OcrEngine::TryCreateFromUserProfileLanguages() {
        Ok(engine) => engine,
        Err(_) => {
            let lang = Language::CreateLanguage(&windows::core::HSTRING::from("en-US"))
                .map_err(|e| e.to_string())?;
            OcrEngine::TryCreateFromLanguage(&lang).map_err(|e| e.to_string())?
        }
    };

    let result = engine
        .RecognizeAsync(&software_bitmap)
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    let text = result.Text().map_err(|e| e.to_string())?;
    Ok(text.to_string_lossy())
}

#[cfg(not(windows))]
pub fn ocr_rgba(_width: u32, _height: u32, _rgba: &[u8]) -> Result<String, String> {
    Err("OCR is only supported on Windows in this build".to_string())
}

pub fn categorize_activity(app_name: &str, _text: &str) -> &'static str {
    let lower = app_name.to_lowercase();
    if lower.contains("code")
        || lower.contains("studio")
        || lower.contains("intellij")
        || lower.contains("pycharm")
        || lower.contains("webstorm")
        || lower.contains("sublime")
        || lower.contains("vim")
        || lower.contains("rider")
    {
        "coding"
    } else if lower.contains("chrome")
        || lower.contains("firefox")
        || lower.contains("edge")
        || lower.contains("safari")
        || lower.contains("brave")
        || lower.contains("opera")
    {
        "browsing"
    } else if lower.contains("slack")
        || lower.contains("discord")
        || lower.contains("teams")
        || lower.contains("whatsapp")
        || lower.contains("telegram")
        || lower.contains("messenger")
    {
        "chatting"
    } else if lower.contains("word")
        || lower.contains("notion")
        || lower.contains("notepad")
        || lower.contains("obsidian")
        || lower.contains("docs")
    {
        "writing"
    } else if lower.contains("excel") || lower.contains("sheet") || lower.contains("calc") {
        "analyzing"
    } else if lower.contains("youtube") || lower.contains("netflix") || lower.contains("spotify") {
        "media"
    } else {
        "general"
    }
}
