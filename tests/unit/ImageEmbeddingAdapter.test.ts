import { ImageEmbeddingAdapter } from '../../src/app/vectorization/adapters/ImageEmbeddingAdapter';

describe('ImageEmbeddingAdapter', () => {
  let adapter: ImageEmbeddingAdapter;

  // Mock canvas and image for testing
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: jest.fn((contextType?: string) => ({
      fillStyle: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
      getImageData: jest.fn(() => ({
        data: new Uint8ClampedArray(224 * 224 * 4), // RGBA
        width: 224,
        height: 224,
      })),
    })),
    toDataURL: jest.fn(() => 'data:image/png;base64,mock'),
  };

  const mockImage = {
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    src: '',
    width: 100,
    height: 100,
  };

  beforeEach(() => {
    adapter = new ImageEmbeddingAdapter();

    // Mock global objects
    global.Image = jest.fn(() => mockImage) as any;
    global.document = {
      createElement: jest.fn((tagName: string) => {
        if (tagName === 'canvas') return mockCanvas;
        if (tagName === 'img') return mockImage;
        return {};
      }),
    } as any;
  });

  afterEach(async () => {
    await adapter.dispose();
    jest.clearAllMocks();
  });

  describe('Modality Support', () => {
    it('should support image modality', () => {
      const modalities = adapter.getSupportedModalities();
      expect(modalities).toContain('image');
    });

    it('should handle image files', () => {
      const imageFile = new File(['image content'], 'test.jpg', {
        type: 'image/jpeg',
      });
      expect(adapter.canHandle(imageFile)).toBe(true);
    });

    it('should handle various image formats', () => {
      const formats = ['image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];
      formats.forEach(format => {
        const file = new File(['content'], `test.${format.split('/')[1]}`, { type: format });
        expect(adapter.canHandle(file)).toBe(true);
      });
    });

    it('should reject non-image files', () => {
      const audioFile = new File(['audio content'], 'test.mp3', {
        type: 'audio/mpeg',
      });
      expect(adapter.canHandle(audioFile)).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(adapter.initialize()).resolves.not.toThrow();
    });

    it('should handle multiple initializations', async () => {
      await adapter.initialize();
      await expect(adapter.initialize()).resolves.not.toThrow();
    });
  });

  describe('Image Processing', () => {
    beforeEach(async () => {
      await adapter.initialize();

      // Mock successful image loading
      mockImage.onload = () => {};
    });

    it('should process image file successfully', async () => {
      // Create a simple test image (1x1 pixel PNG)
      const pngHeader = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, // Color type, etc.
        0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT
        0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // Compressed data
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82, // IEND
      ]);

      const imageFile = new File([pngHeader], 'test.png', { type: 'image/png' });

      // Mock canvas operations
      const mockCtx = mockCanvas.getContext('2d');
      (mockCtx as any).getImageData.mockReturnValue({
        data: new Uint8ClampedArray(224 * 224 * 4),
        width: 224,
        height: 224,
      });

      const result = await adapter.process(imageFile);

      expect(result).toBeDefined();
      expect(result.vector).toBeInstanceOf(Float32Array);
      expect(result.vector.length).toBeGreaterThan(0);
      expect(result.metadata.modality).toBe('image');
      expect(result.metadata.originalSize).toBe(imageFile.size);
      expect(result.metadata.processingTimeMs).toBeGreaterThan(0);
    });

    it('should resize images to expected dimensions', async () => {
      const imageFile = new File(['fake image'], 'test.png', { type: 'image/png' });

      // Mock image with different dimensions
      Object.defineProperty(mockImage, 'width', { value: 512 });
      Object.defineProperty(mockImage, 'height', { value: 256 });

      // Mock canvas context
      const mockCtx = mockCanvas.getContext();
      (mockCtx as any).getImageData.mockReturnValue({
        data: new Uint8ClampedArray(224 * 224 * 4),
        width: 224,
        height: 224,
      });

      const result = await adapter.process(imageFile);
      expect(result.metadata.processedSize).toBe(224 * 224 * 4); // RGBA bytes
    });

    it('should handle image loading errors', async () => {
      const imageFile = new File(['invalid'], 'test.png', { type: 'image/png' });

      // Mock image loading failure
      mockImage.onerror = () => {};

      await expect(adapter.process(imageFile)).rejects.toThrow();
    });

    it('should throw error when not initialized', async () => {
      const uninitializedAdapter = new ImageEmbeddingAdapter();
      const imageFile = new File(['image'], 'test.png', { type: 'image/png' });

      await expect(uninitializedAdapter.process(imageFile)).rejects.toThrow();
    });
  });

  describe('Text Processing', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should process text for similarity', async () => {
      const result = await adapter.processText('test description');

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate consistent embeddings for same text', async () => {
      const result1 = await adapter.processText('test');
      const result2 = await adapter.processText('test');

      expect(result1).toEqual(result2);
    });

    it('should generate different embeddings for different text', async () => {
      const result1 = await adapter.processText('test1');
      const result2 = await adapter.processText('test2');

      expect(result1).not.toEqual(result2);
    });
  });

  describe('Canvas Operations', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should create canvas with correct dimensions', async () => {
      const imageFile = new File(['fake'], 'test.png', { type: 'image/png' });

      // Mock successful image load
      mockImage.onload = () => {};

      await adapter.process(imageFile);

      expect(mockCanvas.width).toBe(224);
      expect(mockCanvas.height).toBe(224);
    });

    it('should handle canvas context errors', async () => {
      const imageFile = new File(['fake'], 'test.png', { type: 'image/png' });

      // Mock canvas without context
      (mockCanvas.getContext as jest.Mock).mockReturnValue(null);

      await expect(adapter.process(imageFile)).rejects.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should dispose without errors', async () => {
      await adapter.initialize();
      await expect(adapter.dispose()).resolves.not.toThrow();
    });

    it('should handle multiple dispose calls', async () => {
      await adapter.initialize();
      await adapter.dispose();
      await expect(adapter.dispose()).resolves.not.toThrow();
    });

    it('should cleanup pipeline on dispose', async () => {
      await adapter.initialize();
      await adapter.dispose();

      const imageFile = new File(['image'], 'test.png', { type: 'image/png' });
      await expect(adapter.process(imageFile)).rejects.toThrow();
    });
  });
});
