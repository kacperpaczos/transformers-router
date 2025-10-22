/**
 * Image Embedding Adapter using CLIP (Contrastive Language-Image Pretraining)
 */

import type { EmbeddingAdapter, EmbeddingResult } from './EmbeddingAdapter';
import type { VectorModality } from '../../../core/types';

export class ImageEmbeddingAdapter implements EmbeddingAdapter {
  private initialized = false;
  private pipeline: any = null;

  getSupportedModalities(): VectorModality[] {
    return ['image'];
  }

  canHandle(file: File): boolean {
    const imageTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'image/bmp', 'image/tiff', 'image/svg+xml'
    ];
    return imageTypes.some(type => file.type.startsWith(type));
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Dynamically import Transformers.js
      const { pipeline } = await import('@huggingface/transformers');

      // Initialize CLIP pipeline for image embeddings
      this.pipeline = await pipeline('image-to-text', 'openai/clip-vit-base-patch32', {
        device: this.getPreferredDevice(),
      });

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize image embedding adapter: ${error}`);
    }
  }

  async process(file: File): Promise<EmbeddingResult> {
    await this.ensureInitialized();

    const startTime = performance.now();

    try {
      // Convert File to ImageData or process directly
      const imageData = await this.fileToImageData(file);

      // Process through CLIP pipeline
      const output = await this.pipeline(imageData, {
        return_tensors: 'pt',
      });

      // Extract embedding
      const vector = this.extractEmbedding(output);

      const processingTime = performance.now() - startTime;

      return {
        vector,
        metadata: {
          modality: 'image',
          originalSize: file.size,
          processedSize: imageData.width * imageData.height * 4, // RGBA bytes
          processingTimeMs: processingTime,
        },
      };
    } catch (error) {
      throw new Error(`Image processing failed: ${error}`);
    }
  }

  async processText(text: string): Promise<Float32Array> {
    await this.ensureInitialized();

    // For image adapter, we can use CLIP text encoder for text-to-image similarity
    try {
      const { pipeline } = await import('@huggingface/transformers');
      const textPipeline = await pipeline('feature-extraction', 'openai/clip-vit-base-patch32', {
        device: this.getPreferredDevice(),
      });

      const output = await textPipeline(text);

      return this.extractTextEmbedding(output);
    } catch (error) {
      throw new Error(`Text processing failed: ${error}`);
    }
  }

  async dispose(): Promise<void> {
    if (this.pipeline) {
      // Cleanup pipeline resources
      this.pipeline = null;
    }
    this.initialized = false;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private getPreferredDevice(): 'webgpu' | 'wasm' {
    // Check WebGPU availability
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      return 'webgpu';
    }
    return 'wasm'; // Fallback to WASM
  }

  private async fileToImageData(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      img.onload = () => {
        // Resize image to CLIP expected size (224x224 for ViT-Base)
        const targetSize = 224;
        canvas.width = targetSize;
        canvas.height = targetSize;

        // Calculate scaling to maintain aspect ratio
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const offsetX = (targetSize - scaledWidth) / 2;
        const offsetY = (targetSize - scaledHeight) / 2;

        // Clear canvas and draw resized image
        ctx.fillStyle = '#000000'; // Black padding like CLIP preprocessing
        ctx.fillRect(0, 0, targetSize, targetSize);
        ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

        const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
        resolve(imageData);
      };

      img.onerror = () => reject(new Error('Failed to load image'));

      const url = URL.createObjectURL(file);
      img.src = url;

      // Cleanup object URL after loading
      const originalOnload = img.onload;
      img.onload = function(this: HTMLImageElement, ev: Event) {
        URL.revokeObjectURL(url);
        return originalOnload?.call(this);
      };
    });
  }

  private extractEmbedding(output: any): Float32Array {
    // Extract image embedding from CLIP output
    if (output && output.image_embeds) {
      return new Float32Array(output.image_embeds.data);
    }

    if (output && output.logits_per_image) {
      // Alternative extraction method
      const logits = output.logits_per_image;
      return new Float32Array(logits.data.slice(0, logits.dims[logits.dims.length - 1]));
    }

    throw new Error('Unable to extract image embedding from model output');
  }

  private extractTextEmbedding(output: any): Float32Array {
    // Extract text embedding from CLIP output
    if (output && output.text_embeds) {
      return new Float32Array(output.text_embeds.data);
    }

    if (output && output.logits_per_text) {
      // Alternative extraction method
      const logits = output.logits_per_text;
      return new Float32Array(logits.data.slice(0, logits.dims[logits.dims.length - 1]));
    }

    throw new Error('Unable to extract text embedding from model output');
  }
}
