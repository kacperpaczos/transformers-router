/**
 * Basic OCR Example with Transformers Router
 * 
 * This example demonstrates how to use the OCR functionality
 * to recognize text from images using Tesseract.js.
 */

import { createAIProvider } from 'transformers-router';

async function main() {
  console.log('🚀 Initializing OCR Provider...');
  
  // Create AI provider with OCR configuration
  const provider = createAIProvider({
    ocr: {
      language: 'eng', // English language
      performanceMode: 'quality'
    }
  });

  console.log('✅ OCR Provider initialized');

  try {
    // Example 1: Recognize text from URL
    console.log('\n📷 Recognizing text from URL...');
    const urlResult = await provider.recognize('https://example.com/sample-image.jpg', {
      includeBbox: true,
      includeConfidence: true,
      autoLanguage: true,
      allowedLanguages: ['eng','pol','deu','spa','fra','ita'],
      detectionMinTextLength: 20,
      detectionMaxCandidates: 5,
      autoPSM: true,
      autoWhitelist: true
    });
    
    console.log('📝 Extracted text:', urlResult.text);
    console.log('🎯 Confidence:', urlResult.confidence);
    if (urlResult.words) {
      console.log('📦 Words with bounding boxes:', urlResult.words.length);
    }

    // Example 2: Recognize text from File object
    console.log('\n📁 Recognizing text from File...');
    const file = new File(['...'], 'document.jpg', { type: 'image/jpeg' });
    const fileResult = await provider.recognize(file, {
      language: 'eng',
      includeBbox: true,
      psm: 6 // Page Segmentation Mode
    });
    
    console.log('📝 File text:', fileResult.text);
    console.log('🎯 File confidence:', fileResult.confidence);

    // Example 3: Recognize text from Base64 data URL
    console.log('\n🔤 Recognizing text from Base64...');
    const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const base64Result = await provider.recognize(base64Image, {
      language: ['eng', 'pol'], // Multiple languages
      includeBbox: true,
      includeConfidence: true,
      oem: 3 // OCR Engine Mode
    });
    
    console.log('📝 Base64 text:', base64Result.text);
    console.log('🎯 Base64 confidence:', base64Result.confidence);

    // Example 4: Advanced OCR with custom parameters
    console.log('\n⚙️ Advanced OCR with custom parameters and auto-language...');
    const advancedResult = await provider.recognize('https://example.com/complex-image.jpg', {
      // leave language undefined to let autoLanguage kick in
      autoLanguage: true,
      allowedLanguages: ['eng','pol','fra','ita','spa'],
      includeBbox: true,
      includeConfidence: true,
      psm: 1, // Automatic page segmentation with OSD
      oem: 3  // Default OCR Engine Mode
    });
    
    console.log('📝 Advanced text:', advancedResult.text);
    console.log('🎯 Advanced confidence:', advancedResult.confidence);
    console.log('🌐 Used language:', advancedResult.usedLanguage);
    console.log('📊 Detected languages:', advancedResult.detectedLanguages);
    
    if (advancedResult.words) {
      console.log('📦 Detected words:');
      advancedResult.words.forEach((word, index) => {
        console.log(`  ${index + 1}. "${word.text}" (confidence: ${word.confidence}%, bbox: ${word.bbox.x0},${word.bbox.y0}-${word.bbox.x1},${word.bbox.y1})`);
      });
    }

    if (advancedResult.lines) {
      console.log('📄 Detected lines:');
      advancedResult.lines.forEach((line, index) => {
        console.log(`  ${index + 1}. "${line.text}" (confidence: ${line.confidence}%)`);
      });
    }

  } catch (error) {
    console.error('❌ OCR Error:', error.message);
    console.error('Stack:', error.stack);
  }

  console.log('\n🎉 OCR Examples completed!');
}

// Run the example
main().catch(console.error);
