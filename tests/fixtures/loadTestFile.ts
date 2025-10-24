/**
 * Helper function to load test files
 */
import fs from 'fs';
import path from 'path';

export async function loadTestFile(filename: string): Promise<File> {
  const filePath = path.join(__dirname, filename);
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filename);
  const name = path.basename(filename);
  
  // Determine MIME type based on extension
  let type: string;
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      type = 'image/jpeg';
      break;
    case '.png':
      type = 'image/png';
      break;
    case '.gif':
      type = 'image/gif';
      break;
    case '.webp':
      type = 'image/webp';
      break;
    case '.bmp':
      type = 'image/bmp';
      break;
    case '.tiff':
      type = 'image/tiff';
      break;
    case '.mp3':
      type = 'audio/mpeg';
      break;
    case '.wav':
      type = 'audio/wav';
      break;
    case '.ogg':
      type = 'audio/ogg';
      break;
    case '.mp4':
      // Check if it's in audio folder for audio MP4
      if (filename.includes('audio/')) {
        type = 'audio/mp4';
      } else {
        type = 'video/mp4';
      }
      break;
    case '.aac':
      type = 'audio/aac';
      break;
    case '.flac':
      type = 'audio/flac';
      break;
    case '.txt':
      type = 'text/plain';
      break;
    case '.pdf':
      type = 'application/pdf';
      break;
    default:
      type = 'application/octet-stream';
  }
  
  return new File([buffer], name, { type });
}
