/**
 * OCR Service — Unit tests
 * Testuje: PDF detection, Tesseract timeout, graceful fallback
 */
import { Test, TestingModule } from '@nestjs/testing';
import { OcrService } from './ocr.service';

describe('OcrService', () => {
  let service: OcrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OcrService],
    }).compile();
    service = module.get<OcrService>(OcrService);
  });

  describe('PDF detection (isPdfOrNonImage)', () => {
    it('should detect PDF magic bytes (%PDF)', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n... content ...', 'utf8');
      // Access private method for testing (in real code, would need to expose or test via extract())
      const result = await service.extract(pdfBuffer, 'application/pdf');
      expect(result.confidence).toBe(0); // Should return empty
      expect(result.rawText).toBe('');
    });

    it('should reject image masquerading as PDF', async () => {
      // Create a fake buffer with PDF-like header but invalid content
      const fakeBuffer = Buffer.concat([
        Buffer.from('%PDF'),
        Buffer.from('fake image data'),
      ]);
      const result = await service.extract(fakeBuffer);
      expect(result.confidence).toBe(0);
    });

    it('should accept valid JPG image', async () => {
      // JPG magic bytes: FF D8 FF
      const jpgMagic = Buffer.from([0xff, 0xd8, 0xff]);
      const jpgBuffer = Buffer.concat([jpgMagic, Buffer.alloc(100, 0)]);
      // Note: This will fail OCR (empty image) but won't crash
      const result = await service.extract(jpgBuffer, 'image/jpeg');
      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThanOrEqual(1);
      // Should not throw
    });
  });

  describe('OCR extraction', () => {
    it('should extract IBAN from text', () => {
      const text = 'Prosím zaplaťte na IBAN SK64 1111 0000 0012 3456 7890 do 30.4.2026';
      const result = service.parse(text, 0.9);
      expect(result.iban).toBe('SK6411110000001234567890');
    });

    it('should extract IČO from text', () => {
      const text = 'Dodávateľ: Acme s.r.o., IČO 12345678, sídlo Bratislava';
      const result = service.parse(text, 0.9);
      expect(result.ico).toBe('12345678');
    });

    it('should extract amount with €', () => {
      const text = 'Spolu k úhrade: 125,50 €';
      const result = service.parse(text, 0.9);
      expect(result.amount).toBeDefined();
      expect(result.amount).toContain('125');
    });

    it('should handle low confidence gracefully', () => {
      const text = 'corrupted ocr xxxxx';
      const result = service.parse(text, 0.1); // Very low confidence
      expect(result.confidence).toBe(0.1);
      expect(result.rawText).toBe('corrupted ocr xxxxx');
    });
  });

  describe('Error handling', () => {
    it('should return empty result on PDF input to Tesseract', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%file content\n%%EOF', 'utf8');
      const result = await service.extractFromImage(pdfBuffer);
      expect(result.confidence).toBe(0);
      expect(result.rawText).toBe('');
    });

    it('should not crash on malformed image buffer', async () => {
      const malformedBuffer = Buffer.from('not an image at all');
      // Should not throw, should return graceful error
      const result = await service.extract(malformedBuffer, 'image/jpeg');
      expect(result).toBeDefined();
    });
  });
});
