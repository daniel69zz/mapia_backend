import { Module } from '@nestjs/common';
import { IMAGE_ANALYZER } from './ai.types';
import { VertexGeminiService } from './vertex-gemini.service';

/**
 * Módulo de IA. Expone un `IImageAnalyzer` bajo el token IMAGE_ANALYZER.
 * Hoy: Vertex AI / Gemini (el mismo servicio cae a AI Studio si
 * GOOGLE_GENAI_USE_VERTEXAI=false y se define GEMINI_API_KEY).
 */
@Module({
  providers: [
    VertexGeminiService,
    { provide: IMAGE_ANALYZER, useExisting: VertexGeminiService },
  ],
  exports: [IMAGE_ANALYZER],
})
export class AiModule {}
